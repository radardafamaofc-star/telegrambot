export interface TransferJob {
  id: number;
  sourceGroupId: string;
  targetGroupId: string;
  status: string;
  progress: number;
  total: number;
  error: string | null;
  createdAt: Date;
}

export interface InsertTransferJob {
  sourceGroupId: string;
  targetGroupId: string;
  status?: string;
  progress?: number;
  total?: number;
  error?: string | null;
}

export interface IStorage {
  createTransferJob(job: InsertTransferJob): Promise<TransferJob>;
  updateTransferJob(id: number, updates: Partial<InsertTransferJob>): Promise<TransferJob>;
  getTransferJobs(): Promise<TransferJob[]>;
  getTransferJob(id: number): Promise<TransferJob | undefined>;
  addTransferredMember(sourceGroupId: string, targetGroupId: string, memberId: string): Promise<void>;
  getTransferredMembers(sourceGroupId: string, targetGroupId: string): Promise<Set<string>>;
}

class InMemoryStorage implements IStorage {
  private jobs: TransferJob[] = [];
  private nextId = 1;
  private transferredMembers: Map<string, Set<string>> = new Map();

  private pairKey(sourceGroupId: string, targetGroupId: string): string {
    return `${sourceGroupId}→${targetGroupId}`;
  }

  async createTransferJob(job: InsertTransferJob): Promise<TransferJob> {
    const created: TransferJob = {
      id: this.nextId++,
      sourceGroupId: job.sourceGroupId,
      targetGroupId: job.targetGroupId,
      status: job.status || "pending",
      progress: job.progress ?? 0,
      total: job.total ?? 0,
      error: job.error ?? null,
      createdAt: new Date(),
    };
    this.jobs.push(created);
    return created;
  }

  async updateTransferJob(id: number, updates: Partial<InsertTransferJob>): Promise<TransferJob> {
    const job = this.jobs.find(j => j.id === id);
    if (!job) throw new Error(`Job ${id} not found`);
    Object.assign(job, updates);
    return job;
  }

  async getTransferJobs(): Promise<TransferJob[]> {
    return [...this.jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTransferJob(id: number): Promise<TransferJob | undefined> {
    return this.jobs.find(j => j.id === id);
  }

  async addTransferredMember(sourceGroupId: string, targetGroupId: string, memberId: string): Promise<void> {
    const key = this.pairKey(sourceGroupId, targetGroupId);
    if (!this.transferredMembers.has(key)) {
      this.transferredMembers.set(key, new Set());
    }
    this.transferredMembers.get(key)!.add(memberId);
  }

  async getTransferredMembers(sourceGroupId: string, targetGroupId: string): Promise<Set<string>> {
    const key = this.pairKey(sourceGroupId, targetGroupId);
    return this.transferredMembers.get(key) ?? new Set();
  }
}

export const storage = new InMemoryStorage();
