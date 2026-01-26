import { and, count, eq } from "drizzle-orm";
import db from "../lib/data";
import { groupMembers, listItems, stores } from "../db";
import { HTTPException } from "hono/http-exception";

export type StoreSummary = {
  id: number;
  name: string;
  itemCount: number;
};

export async function getLists(
  userId: string,
  groupId: number
): Promise<StoreSummary[]> {
  if (!groupId) {
    throw new HTTPException(400, { message: "No active group" });
  }

  const rows = await db
    .select({
      id: stores.id,
      name: stores.name,
      itemCount: count(listItems.id).as("itemCount"),
    })
    .from(stores)
    .innerJoin(groupMembers, eq(stores.groupId, groupMembers.groupId))
    .leftJoin(listItems, eq(listItems.storeId, stores.id))
    .where(and(eq(groupMembers.userId, userId), eq(stores.groupId, groupId)))
    .groupBy(stores.id, stores.name)
    .orderBy(stores.name);

  return rows;
}

export async function getList(
  userId: string,
  storeId: number,
  groupId: number
) {
  if (!groupId) {
    throw new HTTPException(400, { message: "No active group" });
  }

  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new HTTPException(400, { message: "Invalid store ID" });
  }
  const rows = await db
    .select()
    .from(stores)
    .innerJoin(groupMembers, eq(stores.groupId, groupMembers.groupId))
    .leftJoin(listItems, eq(listItems.storeId, stores.id))
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(stores.id, storeId),
        eq(stores.groupId, groupId)
      )
    );
  if (rows.length === 0) {
    throw new HTTPException(404, { message: "List not found" });
  }

  const store = rows[0].stores;
  const items = rows[0].list_items
    ? rows.map((item) => {
        const listItem = item.list_items;
        return {
          id: listItem?.id,
          name: listItem?.name,
          purchased: listItem?.purchased,
        };
      })
    : [];
  return {
    ...store,
    listItems: items,
  };
}
