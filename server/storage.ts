import { sessions, transferJobs, type Session, type InsertSession, type TransferJob, type InsertTransferJob } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Session methods (added for schema compatibility)
  getSession(id: number): Promise<Session | undefined>;
  getSessionBySessionString(sessionString: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  
  // Transfer job methods
  getTransferJob(id: number): Promise<TransferJob | undefined>;
  getTransferJobs(): Promise<TransferJob[]>;
  createTransferJob(job: InsertTransferJob): Promise<TransferJob>;
  updateTransferJob(id: number, update: Partial<TransferJob>): Promise<TransferJob>;
}

export class DatabaseStorage implements IStorage {
  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getSessionBySessionString(sessionString: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.sessionString, sessionString));
    return session;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(insertSession).returning();
    return session;
  }

  async getTransferJob(id: number): Promise<TransferJob | undefined> {
    const [job] = await db.select().from(transferJobs).where(eq(transferJobs.id, id));
    return job;
  }

  async getTransferJobs(): Promise<TransferJob[]> {
    return await db.select().from(transferJobs).orderBy(desc(transferJobs.id));
  }

  async createTransferJob(insertJob: InsertTransferJob): Promise<TransferJob> {
    const [job] = await db.insert(transferJobs).values(insertJob).returning();
    return job;
  }

  async updateTransferJob(id: number, update: Partial<TransferJob>): Promise<TransferJob> {
    const [job] = await db
      .update(transferJobs)
      .set(update)
      .where(eq(transferJobs.id, id))
      .returning();
    if (!job) throw new Error("Job not found");
    return job;
  }
}

export const storage = new DatabaseStorage();
