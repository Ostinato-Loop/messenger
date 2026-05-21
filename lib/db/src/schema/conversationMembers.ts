import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const conversationMembersTable = pgTable("conversation_members", {
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.conversationId, t.userId] }),
]);

export type ConversationMember = typeof conversationMembersTable.$inferSelect;
