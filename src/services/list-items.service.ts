import db from "../lib/data";
import { and, eq } from "drizzle-orm";
import { groupMembers, listItems, stores } from "../db";
import { HTTPException } from "hono/http-exception";

export async function addItem(name: string, userId: string, storeId: number) {
  const hasAccess = await assertUserHasStoreAccess(userId, storeId);
  if (!hasAccess) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
  const [created] = await db
    .insert(listItems)
    .values({
      name: name,
      addedBy: userId,
      storeId: storeId,
      needed: true,
    })
    .returning({
      id: listItems.id,
      name: listItems.name,
      storeId: listItems.storeId,
    });

  return created;
}

export async function updateItem(
  itemId: number,
  storeId: number,
  purchased: boolean,
  userId: string
) {
  const hasAccess = await assertUserHasStoreAccess(userId, storeId);
  if (!hasAccess) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
  const purchasedAt = purchased ? new Date().toISOString() : null;
  const purchasedBy = purchased ? userId : null;
  const updated = await db
    .update(listItems)
    .set({
      purchased,
      purchasedAt,
      purchasedBy,
    })
    .where(and(eq(listItems.id, itemId), eq(listItems.storeId, storeId)))
    .returning({ id: listItems.id });

  if (updated.length === 0) {
    throw new HTTPException(404, { message: "Not Found" });
  }

  return updated;
}

export async function deleteItem(
  itemId: number,
  storeId: number,
  userId: string
) {
  const hasAccess = await assertUserHasStoreAccess(userId, storeId);
  if (!hasAccess) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
  const deleted = await db
    .delete(listItems)
    .where(and(eq(listItems.id, itemId), eq(listItems.storeId, storeId)))
    .returning({ id: listItems.id });

  if (deleted.length === 0) {
    throw new HTTPException(404, { message: "Not Found" });
  }

  return deleted;
}

export async function assertUserHasStoreAccess(
  userId: string,
  storeId: number
): Promise<boolean> {
  const result = await db
    .select({ id: stores.id })
    .from(stores)
    .innerJoin(groupMembers, eq(stores.groupId, groupMembers.groupId))
    .where(and(eq(stores.id, storeId), eq(groupMembers.userId, userId)))
    .limit(1);

  return result.length > 0;
}
