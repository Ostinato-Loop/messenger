import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const callTypeEnum = pgEnum("call_type", ["voice", "video"]);
export const callStatusEnum = pgEnum("call_status", ["pending", "active", "ended", "rejected", "missed", "busy"]);

export const callsTable = pgTable("calls", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  initiatorId: integer("initiator_id").notNull().references(() => usersTable.id),
  respondentId: integer("respondent_id").references(() => usersTable.id),
  type: callTypeEnum("type").notNull().default("voice"),
  status: callStatusEnum("status").notNull().default("pending"),
  roomId: text("room_id").notNull(),
  durationSeconds: integer("duration_seconds"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCallSchema = createInsertSchema(callsTable).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  endedAt: true,
  durationSeconds: true,
  status: true,
});
export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof callsTable.$inferSelect;
