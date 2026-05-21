import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const messageTypeEnum = pgEnum("message_type", ["text", "image", "audio", "file", "system"]);

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  type: messageTypeEnum("type").notNull().default("text"),
  content: text("content"),
  mediaUrl: text("media_url"),
  replyToId: integer("reply_to_id"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, isDeleted: true, editedAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
