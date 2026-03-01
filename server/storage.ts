import { db } from "./db";
import {
  sessions,
  transferJobs,
  type Session,
  type InsertSession,
  type TransferJob,
  type InsertTransferJob
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Session
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  
  // Transfer Jobs
  createTransferJob(job: InsertTransferJob): Promise<TransferJob>;
  updateTransferJob(id: number, updates: Partial<InsertTransferJob>): Promise<TransferJob>;
  getTransferJobs(): Promise<TransferJob[]>;
  getTransferJob(id: number): Promise<TransferJob | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createSession(session: InsertSession): Promise<Session> {
    const [created] = await db.insert(sessions).values(session).returning();
    return created;
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async createTransferJob(job: InsertTransferJob): Promise<TransferJob> {
    const [created] = await db.insert(transferJobs).values(job).returning();
    return created;
  }

  async updateTransferJob(id: number, updates: Partial<InsertTransferJob>): Promise<TransferJob> {
    const [updated] = await db.update(transferJobs)
      .set(updates)
      .where(eq(transferJobs.id, id))
      .returning();
    return updated;
  }

  async getTransferJobs(): Promise<TransferJob[]> {
    return await db.select().from(transferJobs).orderBy(transferJobs.createdAt);
  }

  async getTransferJob(id: number): Promise<TransferJob | undefined> {
    const [job] = await db.select().from(transferJobs).where(eq(transferJobs.id, id));
    return job;
  }
}

export const storage = new DatabaseStorage();
