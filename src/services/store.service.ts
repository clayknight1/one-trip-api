import { and, eq } from "drizzle-orm";
import { groupMembers, stores } from "../db";
import db from "../lib/data";
import { HTTPException } from "hono/http-exception";

export async function addStore(name: string, groupId: number, userId: string) {
  if (!name) {
    throw new HTTPException(400, { message: "Name is required" });
  }
  if (!groupId) {
    throw new HTTPException(400, { message: "No active group" });
  }
  await assertUserInGroup(userId, groupId);

  const [store] = await db
    .insert(stores)
    .values({
      name: name,
      groupId,
    })
    .returning({ id: stores.id, name: stores.name });
  return store;
}

export async function assertUserInGroup(
  userId: string,
  groupId: number
): Promise<void> {
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.userId, userId), eq(groupMembers.groupId, groupId))
    )
    .limit(1);

  if (rows.length === 0) {
    throw new HTTPException(403, { message: "User is not in this group" });
  }
}
