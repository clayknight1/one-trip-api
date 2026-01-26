import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const groups = pgTable("groups", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
});
