import { betterAuth } from "better-auth";
import { bearer, createAuthMiddleware } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "./data";
import { groupMembers, groups, invites, user as userTable } from "../db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const baseURL = process.env.BETTER_AUTH_URL;
if (process.env.NODE_ENV === "production" && !baseURL) {
  throw new Error("BETTER_AUTH_URL must be set in production");
}

export const auth = betterAuth({
  appName: "One Trip",
  baseURL,
  basePath: "/auth",
  trustedOrigins: [
    ...allowedOrigins,
    "onetripapp://",
    "exp://", // Trust all Expo URLs (prefix matching)
    "exp://**", // Trust all Expo URLs (wildcard matching)
    "exp://192.168.*.*:*/**", // Trust 192.168.x.x IP range with any port and path
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [bearer(), expo()],
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
  },
  telemetry: {
    enabled: false,
  },
  logger: {
    level: process.env.NODE_ENV === "production" ? "error" : "debug",
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith("/sign-up/email")) {
        return;
      }
      const inviteCode = ctx.headers?.get("X-INVITE-CODE") ?? null;
      if (inviteCode) {
        const { email } = ctx.body;
        const [invite] = await db
          .select()
          .from(invites)
          .where(eq(invites.code, inviteCode))
          .limit(1);

        if (!invite) {
          throw new HTTPException(400, { message: "Invalid invite code" });
        }
        const signupEmailNormalized = String(email ?? "")
          .trim()
          .toLowerCase();

        if (!invite.emailNormalized) {
          throw new HTTPException(400, {
            message: "Invite is not email-bound",
          });
        }

        if (invite?.emailNormalized !== signupEmailNormalized) {
          throw new HTTPException(403, {
            message: "Invite email does not match",
          });
        }

        if (!!invite.acceptedAt) {
          throw new HTTPException(409, {
            message: "Invite has already been used",
          });
        }

        if (!!invite.revokedAt) {
          throw new HTTPException(410, { message: "Invite has been revoked" });
        }
        const emailStr = String(email ?? "");
        const emailValidation =
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailStr);
        if (!emailValidation) {
          throw new HTTPException(400, { message: "Invalid email format" });
        }
        const expiresAtDate = new Date(invite.expiresAt);
        const now = new Date();
        if (expiresAtDate < now) {
          throw new HTTPException(410, { message: "Invitation has expired" });
        }
        ctx.context.invite = invite;
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith("/sign-up/email")) {
        return;
      }

      const newSession = ctx.context.newSession;
      const user = newSession?.user;
      if (!user) {
        return;
      }

      await db.transaction(async (tx) => {
        const invite = ctx.context.invite ?? null;
        if (invite) {
          await tx
            .insert(groupMembers)
            .values({
              userId: user.id,
              groupId: invite.groupId,
              role: "MEMBER",
            })
            .onConflictDoNothing();

          await tx
            .update(userTable)
            .set({ activeGroupId: invite.groupId })
            .where(eq(userTable.id, user.id));

          const consumed = await tx
            .update(invites)
            .set({
              acceptedAt: sql`now()`,
              acceptedBy: user.id,
            })
            .where(
              and(
                eq(invites.id, invite.id),
                isNull(invites.acceptedAt),
                isNull(invites.revokedAt),
                gt(invites.expiresAt, sql`now()`),
              ),
            )
            .returning({ id: invites.id });

          if (consumed.length === 0) {
            throw new HTTPException(409, {
              message: "Invite could not be consumed (expired/used/revoked).",
            });
          }
        } else {
          const [group] = await tx
            .insert(groups)
            .values({
              name: user.name ? `${user.name}'s Group` : "My First Group",
            })
            .returning();

          await tx.insert(groupMembers).values({
            userId: user.id,
            groupId: group.id,
            role: "ADMIN",
          });

          await tx
            .update(userTable)
            .set({ activeGroupId: group.id })
            .where(eq(userTable.id, user.id));
        }
      });
    }),
  },
});
//Add return type when schema is in
export async function getCurrentUserFromHeaders(reqHeaders: Headers) {
  const session = await auth.api.getSession({ headers: reqHeaders });

  return session?.user ?? null;
}

export async function getCurrentUserIdOrNull(
  reqHeaders: Headers,
): Promise<string | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  return session?.user?.id ?? null;
}
