import { and, eq } from "drizzle-orm";
import { groupMembers, invites, user } from "../db";
import db from "../lib/data";
import { HTTPException } from "hono/http-exception";

export type InviteToGroupResult = {
  url: string;
  code: string;
  expiresAt: string;
};

export async function getMembers(groupId: number) {
  if (!groupId)
    throw new HTTPException(400, { message: "No active group selected" });

  const rows = await db
    .select()
    .from(groupMembers)
    .innerJoin(user, eq(groupMembers.userId, user.id))
    .where(eq(groupMembers.groupId, groupId));

  return rows;
}

export async function inviteToGroup(
  email: string,
  userId: string,
  activeGroupId: number
): Promise<InviteToGroupResult> {
  const code = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 7
  ).toISOString();
  const emailNormalized = email.trim().toLowerCase();
  if (!activeGroupId) {
    throw new HTTPException(400, { message: "No active group" });
  }

  const isMember = await db
    .select({ ok: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, activeGroupId)
      )
    )
    .limit(1);

  if (!isMember.length) {
    throw new HTTPException(400, { message: "Not a member of this group" });
  }

  await db.insert(invites).values({
    groupId: activeGroupId,
    email,
    emailNormalized,
    code,
    createdBy: userId,
    expiresAt,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8081";
  const url = `${baseUrl}/invite/${code}`;

  return { url, code, expiresAt };
}
