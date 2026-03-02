import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage.js";
import {
  loadTelegramRuntime,
  hasTelegramConfig,
  getTelegramConfigStatus,
  getTelegramCredentials,
  getClient,
  pendingAuthClients,
} from "./telegram.js";

function ensureTelegramConfig(res: any): boolean {
  if (hasTelegramConfig) return true;

  const cfg = getTelegramConfigStatus();
  const problems: string[] = [];

  if (!cfg.hasApiId) problems.push("TELEGRAM_API_ID ausente");
  else if (!cfg.apiIdValid) problems.push("TELEGRAM_API_ID inválido (deve ser numérico)");

  if (!cfg.hasApiHash) problems.push("TELEGRAM_API_HASH ausente");

  res.status(503).json({
    message: `Telegram backend not configured: ${problems.join(", ") || "unknown configuration issue"}.`,
  });
  return false;
}

const sendCodeInput = z.object({ phoneNumber: z.string() });
const loginInput = z.object({ phoneNumber: z.string(), phoneCodeHash: z.string(), code: z.string() });
const dialogsInput = z.object({ sessionString: z.string() });
const transferInput = z.object({ sessionString: z.string(), sourceGroupId: z.string(), targetGroupId: z.string(), safeMode: z.boolean().optional().default(false) });
const updateStatusInput = z.object({ status: z.enum(["processing", "paused", "stopped"]) });

export function registerRoutes(app: Express) {
  // --- Auth ---
  app.post("/api/tg/auth/sendCode", async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = sendCodeInput.parse(req.body);
      const { apiId, apiHash } = getTelegramCredentials();

      const { TelegramClient, StringSession } = await loadTelegramRuntime();
      const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 5,
        useWSS: true,
      });
      await client.connect();

      const sendCodeResult = await client.sendCode({ apiId, apiHash }, input.phoneNumber);
      pendingAuthClients.set(input.phoneNumber, client);

      res.status(200).json({ phoneCodeHash: sendCodeResult.phoneCodeHash });
    } catch (err) {
      console.error("Error sending code:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to send code" });
    }
  });

  app.post("/api/tg/auth/login", async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = loginInput.parse(req.body);
      const { apiId, apiHash } = getTelegramCredentials();

      let client = pendingAuthClients.get(input.phoneNumber);
      if (!client || !client.connected) {
        const { TelegramClient, StringSession } = await loadTelegramRuntime();
        client = new TelegramClient(new StringSession(""), apiId, apiHash, {
          connectionRetries: 5,
          useWSS: true,
        });
        await client.connect();
      }

      const { Api } = await loadTelegramRuntime();
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: input.phoneNumber,
          phoneCodeHash: input.phoneCodeHash,
          phoneCode: input.code,
        })
      );

      const sessionString = client.session.save();
      pendingAuthClients.delete(input.phoneNumber);
      await client.disconnect();

      res.status(200).json({ sessionString: sessionString as unknown as string });
    } catch (err) {
      console.error("Error logging in:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to login" });
    }
  });

  // --- Data ---
  app.post("/api/tg/dialogs", async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = dialogsInput.parse(req.body);
      const client = await getClient(input.sessionString);

      const dialogs = await client.getDialogs();
      const mapped = dialogs
        .map((d: any) => ({
          id: d.entity?.id?.toString() || "",
          title: d.title,
          isGroup: d.isGroup,
        }))
        .filter((d: any) => d.id !== "");

      res.status(200).json(mapped);
    } catch (err) {
      console.error("Error fetching dialogs:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to fetch dialogs" });
    }
  });

  app.post("/api/tg/transfer", async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = transferInput.parse(req.body);
      const safeMode = input.safeMode ?? false;

      const job = await storage.createTransferJob({
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        status: "pending",
        progress: 0,
        total: 0,
      });

      startBackgroundTransfer(job.id, input.sessionString, input.sourceGroupId, input.targetGroupId, safeMode).catch(
        console.error
      );

      res.status(200).json(job);
    } catch (err) {
      console.error("Error starting transfer:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to start transfer" });
    }
  });

  // --- Jobs ---
  app.get("/api/jobs", async (_req, res) => {
    try {
      const jobs = await storage.getTransferJobs();
      res.status(200).json(jobs);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.patch("/api/jobs/:id/status", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job ID" });

      const input = updateStatusInput.parse(req.body);
      const job = await storage.getTransferJob(jobId);
      if (!job) return res.status(404).json({ message: "Job not found" });

      if (input.status === "paused" && job.status !== "processing")
        return res.status(400).json({ message: "Can only pause a processing job" });
      if (input.status === "processing" && job.status !== "paused")
        return res.status(400).json({ message: "Can only resume a paused job" });
      if (input.status === "stopped" && !["processing", "paused"].includes(job.status))
        return res.status(400).json({ message: "Can only stop a processing or paused job" });

      const updated = await storage.updateTransferJob(jobId, { status: input.status });
      res.status(200).json(updated);
    } catch (err) {
      console.error("Error updating job status:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update job" });
    }
  });
}

// Safe mode constants
const SAFE_MODE_CONFIG = {
  minDelay: 30_000,
  maxDelay: 60_000,
  dailyLimit: 50,
  batchSize: 20,
  batchPause: 5 * 60_000,
  skipDelayOnError: 2_000,
};

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Background transfer logic ---
async function startBackgroundTransfer(
  jobId: number,
  sessionString: string,
  sourceGroupId: string,
  targetGroupId: string,
  safeMode: boolean = false
) {
  try {
    await storage.updateTransferJob(jobId, { status: "processing" });
    const client = await getClient(sessionString);
    const { Api } = await loadTelegramRuntime();

    const participants = await client.getParticipants(sourceGroupId);
    console.log(`Found ${participants.length} participants (safeMode=${safeMode})`);
    
    const effectiveTotal = safeMode ? Math.min(participants.length, SAFE_MODE_CONFIG.dailyLimit) : participants.length;
    await storage.updateTransferJob(jobId, { total: effectiveTotal, progress: 0 });

    let successCount = 0;

    let targetPeer: any;
    try {
      targetPeer = await client.getEntity(targetGroupId);
    } catch (err: any) {
      const dialogs = await client.getDialogs();
      targetPeer = dialogs.find((d: any) => d.id?.toString() === targetGroupId.toString())?.entity;
      if (!targetPeer) throw err;
    }

    for (const participant of participants) {
      if (participant.bot || participant.deleted) continue;

      if (safeMode && successCount >= SAFE_MODE_CONFIG.dailyLimit) {
        console.log(`[Transfer] Safe mode: daily limit reached (${SAFE_MODE_CONFIG.dailyLimit})`);
        break;
      }

      if (safeMode && successCount > 0 && successCount % SAFE_MODE_CONFIG.batchSize === 0) {
        console.log(`[Transfer] Safe mode: batch pause ${SAFE_MODE_CONFIG.batchPause / 1000}s`);
        await new Promise((r) => setTimeout(r, SAFE_MODE_CONFIG.batchPause));
      }

      const currentJob = await storage.getTransferJob(jobId);
      if (!currentJob) break;

      if (currentJob.status === "stopped") {
        await storage.updateTransferJob(jobId, { status: "stopped" });
        return;
      }

      while ((await storage.getTransferJob(jobId))?.status === "paused") {
        await new Promise((r) => setTimeout(r, 3000));
        const recheck = await storage.getTransferJob(jobId);
        if (!recheck || recheck.status === "stopped") {
          if (recheck) await storage.updateTransferJob(jobId, { status: "stopped" });
          return;
        }
        if (recheck.status === "processing") break;
      }

      try {
        if (targetPeer.className === "Channel" || targetPeer.megagroup) {
          await client.invoke(new Api.channels.InviteToChannel({ channel: targetPeer, users: [participant.id] }));
        } else {
          await client.invoke(new Api.messages.AddChatUser({ chatId: targetPeer.id, userId: participant.id, fwdLimit: 0 }));
        }

        successCount++;
        await storage.updateTransferJob(jobId, { progress: successCount });

        if (safeMode) {
          const delay = randomDelay(SAFE_MODE_CONFIG.minDelay, SAFE_MODE_CONFIG.maxDelay);
          console.log(`[Transfer] Safe delay: ${(delay / 1000).toFixed(0)}s`);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          await new Promise((r) => setTimeout(r, 12000));
        }
      } catch (err: any) {
        const errMsg = err.message || "";
        if (
          errMsg.includes("USER_PRIVACY_RESTRICTED") ||
          errMsg.includes("USER_NOT_MUTUAL_CONTACT") ||
          errMsg.includes("USER_CHANNELS_TOO_MUCH") ||
          errMsg.includes("USER_BOT") ||
          errMsg.includes("BOT_GROUPS_BLOCKED") ||
          errMsg.includes("USER_ALREADY_PARTICIPANT") ||
          errMsg.includes("PEER_ID_INVALID")
        ) {
          await new Promise((r) => setTimeout(r, safeMode ? SAFE_MODE_CONFIG.skipDelayOnError : 1000));
        } else if (errMsg.includes("FLOOD_WAIT")) {
          const waitTime = (err as any).seconds ?? 30;
          await new Promise((r) => setTimeout(r, (waitTime + (safeMode ? 30 : 5)) * 1000));
        } else if (errMsg.includes("CHAT_ADMIN_REQUIRED") || errMsg.includes("CHAT_WRITE_FORBIDDEN")) {
          break;
        } else {
          await new Promise((r) => setTimeout(r, safeMode ? 10000 : 5000));
        }
      }
    }

    await storage.updateTransferJob(jobId, { status: "completed" });
  } catch (err) {
    console.error(`Transfer job ${jobId} failed:`, err);
    await storage.updateTransferJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
