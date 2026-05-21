import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const otpRequestsTable = pgTable("otp_requests", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OtpRequest = typeof otpRequestsTable.$inferSelect;
