import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  sessionString: text("session_string").notNull(),
  apiId: integer("api_id").notNull(),
  apiHash: text("api_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transferJobs = pgTable("transfer_jobs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id"),
  sourceGroupId: text("source_group_id").notNull(),
  targetGroupId: text("target_group_id").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").default(0),
  total: integer("total").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertTransferJobSchema = createInsertSchema(transferJobs).omit({ id: true, createdAt: true });

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type TransferJob = typeof transferJobs.$inferSelect;
export type InsertTransferJob = z.infer<typeof insertTransferJobSchema>;
