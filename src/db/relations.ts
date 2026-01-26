import { relations } from "drizzle-orm/relations";
import { listItems, stores, groupMembers } from "./schema";
import { user } from "./auth-schema";
import { groups } from "./groups-schema";

export const listItemsRelations = relations(listItems, ({ one }) => ({
  user_purchasedBy: one(user, {
    fields: [listItems.purchasedBy],
    references: [user.id],
    relationName: "listItems_purchasedBy_users_id",
  }),
  store: one(stores, {
    fields: [listItems.storeId],
    references: [stores.id],
  }),
  user_addedBy: one(user, {
    fields: [listItems.addedBy],
    references: [user.id],
    relationName: "listItems_addedBy_users_id",
  }),
}));

export const usersRelations = relations(user, ({ many }) => ({
  listItems_purchasedBy: many(listItems, {
    relationName: "listItems_purchasedBy_users_id",
  }),
  listItems_addedBy: many(listItems, {
    relationName: "listItems_addedBy_users_id",
  }),
  groupMembers: many(groupMembers),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  listItems: many(listItems),
  group: one(groups, {
    fields: [stores.groupId],
    references: [groups.id],
  }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  stores: many(stores),
  groupMembers: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  user: one(user, {
    fields: [groupMembers.userId],
    references: [user.id],
  }),
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
}));
