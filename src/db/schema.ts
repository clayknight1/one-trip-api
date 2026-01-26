import {
  pgTable,
  uniqueIndex,
  serial,
  text,
  timestamp,
  index,
  foreignKey,
  numeric,
  boolean,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { groups } from "./groups-schema";
import { user } from "./auth-schema";

export const stores = pgTable(
  "stores",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    groupId: integer("group_id"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("idx_stores_group_id").using(
      "btree",
      table.groupId.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [groups.id],
      name: "stores_group_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const listItems = pgTable(
  "list_items",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    quantity: integer("quantity").default(1),
    notes: text(),
    needed: boolean().default(true),
    purchased: boolean().default(false),
    purchasedBy: text("purchased_by"),
    purchasedAt: timestamp("purchased_at", {
      withTimezone: true,
      mode: "string",
    }),
    isOptional: boolean("is_optional").default(false),
    storeId: integer("store_id"),
    addedBy: text("added_by"),
    position: integer().default(0),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("idx_list_items_added_by").using(
      "btree",
      table.addedBy.asc().nullsLast().op("int4_ops")
    ),
    index("idx_list_items_purchased").using(
      "btree",
      table.purchased.asc().nullsLast().op("bool_ops")
    ),
    index("idx_list_items_store_id").using(
      "btree",
      table.storeId.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.purchasedBy],
      foreignColumns: [user.id],
      name: "list_items_purchased_by_fkey",
    }),
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [stores.id],
      name: "list_items_store_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.addedBy],
      foreignColumns: [user.id],
      name: "list_items_added_by_fkey",
    }),
  ]
);

export const groupMembers = pgTable(
  "group_members",
  {
    userId: text("user_id").notNull(),
    groupId: integer("group_id").notNull(),
    role: text().default("MEMBER"),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "group_members_user_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [groups.id],
      name: "group_members_group_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.userId, table.groupId],
      name: "group_members_pkey",
    }),
  ]
);

export const invites = pgTable(
  "invites",
  {
    id: serial("id").primaryKey().notNull(),

    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),

    // who created the invite (must be a member/admin in your app logic)
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // URL token
    code: text("code").notNull(),

    // Email-bound invite (recommended). nullable so you can support “share link” later.
    email: text("email"),
    emailNormalized: text("email_normalized"),

    // keep it text like your groupMembers.role for now
    role: text("role").notNull().default("MEMBER"),

    // lifecycle
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
      mode: "string",
    }),
    acceptedBy: text("accepted_by").references(() => user.id, {
      onDelete: "set null",
    }),

    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("invites_code_ux").on(t.code),
    index("invites_group_id_idx").on(t.groupId),
    index("invites_email_norm_idx").on(t.emailNormalized),
    index("invites_expires_at_idx").on(t.expiresAt),
  ]
);
