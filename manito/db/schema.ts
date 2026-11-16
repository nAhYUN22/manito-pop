import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  adminHash: text("admin_hash").notNull(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
});
