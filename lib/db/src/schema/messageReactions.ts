import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { messagesTable } from "./messages";
import { usersTable } from "./users";

export const messageReactionsTable = pgTable("message_reactions", {
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
]);

export type MessageReaction = typeof messageReactionsTable.$inferSelect;
