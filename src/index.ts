import { Hono } from "hono";
import { getList, getLists } from "./services/lists.service";
import { getMembers, inviteToGroup } from "./services/members.service";
import { addItem, deleteItem, updateItem } from "./services/list-items.service";
import { HTTPException } from "hono/http-exception";
import { auth } from "./lib/auth";
import db from "./lib/data";
import { user } from "./db";
import { eq } from "drizzle-orm";
import { cors } from "hono/cors";

type AuthContext = {
  userId: string;
  email: string;
  name: string | null;
  activeGroupId: number | null;
};

type Variables = { auth: AuthContext };

const app = new Hono();
const api = new Hono<{ Variables: Variables }>();
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("ALLOWED_ORIGINS must be set in production");
}

app.use(
  "/*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

app.on(["POST", "GET"], "/auth/*", async (c) => {
  return await auth.handler(c.req.raw);
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/db-health", async (c) => {
  try {
    await db.execute("select 1 as ok");
    return c.json({ status: "db-ok" });
  } catch (e: any) {
    console.error("DB ERROR:", e);
    return c.json({ status: "db-fail" }, 500);
  }
});

if (process.env.NODE_ENV === "development") {
  app.use(async (c, next) => {
    const start = Date.now();

    await next();

    const end = Date.now();
    console.log(`Request took ${end - start}ms`);
  });
}

api.use("*", async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const userId = session.user.id;

  const [rows] = await db
    .select({ activeGroupId: user.activeGroupId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  c.set("auth", {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    activeGroupId: rows.activeGroupId ?? null,
  });

  await next();
});

api.get("/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return c.json({ session });
});

api.get("/lists", async (c) => {
  const { userId, activeGroupId } = c.get("auth");
  if (!activeGroupId) {
    throw new HTTPException(400, { message: "No active group selected" });
  }

  const lists = await getLists(userId, activeGroupId);

  return c.json(lists);
});

api.get("/list/:storeId", async (c) => {
  const { userId, activeGroupId } = c.get("auth");
  const storeId = Number(c.req.param("storeId"));
  if (!activeGroupId) {
    throw new HTTPException(400, { message: "No active group selected" });
  }

  const list = await getList(userId, storeId, activeGroupId);

  return c.json(list);
});

api.get("/members", async (c) => {
  const { activeGroupId } = c.get("auth");
  if (!activeGroupId) {
    throw new HTTPException(400, { message: "No active group selected" });
  }
  const members = await getMembers(activeGroupId);

  return c.json(members);
});

api.post("/stores/:storeId/items", async (c) => {
  const { userId } = c.get("auth");
  const storeId = Number(c.req.param("storeId"));
  const { name } = await c.req.json();

  if (!name || typeof name !== "string") {
    throw new HTTPException(400, {
      message: "Name is required and must be a string",
    });
  }

  const result = await addItem(name, userId, storeId);
  return c.json({ success: true, result }, 201);
});

api.patch("/stores/:storeId/item/:itemId", async (c) => {
  const { userId } = c.get("auth");
  const storeId = Number(c.req.param("storeId"));
  const itemId = Number(c.req.param("itemId"));
  const { purchased } = await c.req.json();

  if (!Number.isFinite(itemId)) {
    throw new HTTPException(400, { message: "Invalid item id" });
  }
  if (typeof purchased !== "boolean") {
    throw new HTTPException(400, { message: "purchased must be a boolean" });
  }

  const result = await updateItem(itemId, storeId, purchased, userId);
  return c.json({ success: true, result });
});

api.delete("/stores/:storeId/item/:itemId", async (c) => {
  const { userId } = c.get("auth");
  const storeId = Number(c.req.param("storeId"));
  const itemId = Number(c.req.param("itemId"));

  if (!Number.isFinite(itemId)) {
    throw new HTTPException(400, { message: "Invalid item id" });
  }

  const result = await deleteItem(itemId, storeId, userId);
  return c.json({ success: true, result });
});

api.post("/invite", async (c) => {
  const { userId, activeGroupId } = c.get("auth");
  const body = await c.req.json();
  const email = body?.email;

  if (!activeGroupId) {
    throw new HTTPException(400, { message: "No active group selected" });
  }

  if (typeof email !== "string" || !email.trim()) {
    throw new HTTPException(400, { message: "email is required" });
  }

  const result = await inviteToGroup(email, userId, activeGroupId);
  return c.json({ success: true, result });
});

app.route("/api", api);

export default {
  port: Number(process.env.PORT ?? 3000),
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
