import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

type TelegramRuntime = {
  TelegramClient: new (...args: any[]) => any;
  StringSession: new (session: string) => any;
  Api: any;
};

let telegramRuntimePromise: Promise<TelegramRuntime> | null = null;

async function loadTelegramRuntime(): Promise<TelegramRuntime> {
  if (!telegramRuntimePromise) {
    telegramRuntimePromise = Promise.all([import("telegram"), import("telegram/sessions")]).then(
      ([telegramModule, sessionsModule]) => ({
        TelegramClient: telegramModule.TelegramClient as unknown as new (...args: any[]) => any,
        StringSession: sessionsModule.StringSession as unknown as new (session: string) => any,
        Api: telegramModule.Api,
      }),
    );
  }

  return telegramRuntimePromise;
}

// Telegram API credentials loaded from environment variables
const TELEGRAM_API_ID = Number(process.env.TELEGRAM_API_ID);
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH ?? "";
const hasTelegramConfig =
  Number.isInteger(TELEGRAM_API_ID) &&
  TELEGRAM_API_ID > 0 &&
  TELEGRAM_API_HASH.length > 0;

function ensureTelegramConfig(
  res: { status: (code: number) => { json: (body: { message: string }) => unknown } },
): boolean {
  if (hasTelegramConfig) return true;

  res.status(503).json({
    message:
      "Telegram backend not configured. Add TELEGRAM_API_ID and TELEGRAM_API_HASH in Secrets.",
  });

  return false;
}

// Store active clients in memory to avoid reconnecting constantly during an active session
const activeClients: Map<string, any> = new Map();
const pendingAuthClients: Map<string, any> = new Map();

async function getClient(sessionString: string): Promise<any> {
  if (!hasTelegramConfig) {
    throw new Error("Telegram backend not configured. Missing TELEGRAM_API_ID/TELEGRAM_API_HASH.");
  }

  const cacheKey = `${TELEGRAM_API_ID}-${TELEGRAM_API_HASH}-${sessionString.substring(0, 20)}`;
  if (activeClients.has(cacheKey)) {
    const client = activeClients.get(cacheKey)!;
    if (client.connected) {
      return client;
    }
  }

  const { TelegramClient, StringSession } = await loadTelegramRuntime();
  const stringSession = new StringSession(sessionString);
  const client = new TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
    connectionRetries: 5,
  });
  
  await client.connect();
  activeClients.set(cacheKey, client);
  return client;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Telegram Auth
  app.post(api.tgAuth.sendCode.path, async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = api.tgAuth.sendCode.input.parse(req.body);
      
      const { TelegramClient, StringSession } = await loadTelegramRuntime();
      const client = new TelegramClient(new StringSession(""), TELEGRAM_API_ID, TELEGRAM_API_HASH, {
        connectionRetries: 5,
        useWSS: true
      });
      await client.connect();

      const sendCodeResult = await client.sendCode(
        {
          apiId: TELEGRAM_API_ID,
          apiHash: TELEGRAM_API_HASH,
        },
        input.phoneNumber
      );

      // Store client in pending map using phone number
      pendingAuthClients.set(input.phoneNumber, client);

      res.status(200).json({ phoneCodeHash: sendCodeResult.phoneCodeHash });
    } catch (err) {
      console.error("Error sending code:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to send code" });
    }
  });

  app.post(api.tgAuth.login.path, async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = api.tgAuth.login.input.parse(req.body);
      
      let client = pendingAuthClients.get(input.phoneNumber);
      
      if (!client || !client.connected) {
        const { TelegramClient, StringSession } = await loadTelegramRuntime();
        const stringSession = new StringSession("");
        client = new TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
          connectionRetries: 5,
          useWSS: true
        });
        await client.connect();
      }
      
      const { Api } = await loadTelegramRuntime();
      await client.invoke(new Api.auth.SignIn({
        phoneNumber: input.phoneNumber,
        phoneCodeHash: input.phoneCodeHash,
        phoneCode: input.code,
      }));

      const sessionString = client.session.save();
      pendingAuthClients.delete(input.phoneNumber);
      await client.disconnect();

      // Ensure it's a string, as save() can sometimes return other types in older gramjs versions, but usually string.
      res.status(200).json({ sessionString: sessionString as unknown as string });
    } catch (err) {
      console.error("Error logging in:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to login" });
    }
  });

  // Telegram Data
  app.post(api.tgData.dialogs.path, async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = api.tgData.dialogs.input.parse(req.body);
      const client = await getClient(input.sessionString);
      
      const dialogs = await client.getDialogs();
      const mapped = dialogs.map((d: any) => ({
        id: d.entity?.id?.toString() || "",
        title: d.title,
        isGroup: d.isGroup,
      })).filter((d: any) => d.id !== "");

      res.status(200).json(mapped);
    } catch (err) {
      console.error("Error fetching dialogs:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to fetch dialogs" });
    }
  });

  app.post(api.tgData.startTransfer.path, async (req, res) => {
    try {
      if (!ensureTelegramConfig(res)) return;
      const input = api.tgData.startTransfer.input.parse(req.body);
      
      const safeMode = input.safeMode ?? false;
      const recklessMode = input.recklessMode ?? false;
      const job = await storage.createTransferJob({
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        status: "pending",
        progress: 0,
        total: 0,
      });

      // Start background job
      startBackgroundTransfer(job.id, input.sessionString, input.sourceGroupId, input.targetGroupId, safeMode, recklessMode).catch(console.error);

      res.status(200).json(job);
    } catch (err) {
      console.error("Error starting transfer:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to start transfer" });
    }
  });

  app.get(api.jobs.list.path, async (req, res) => {
    try {
      const jobs = await storage.getTransferJobs();
      res.status(200).json(jobs);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Update job status (pause/resume/stop)
  app.patch("/api/jobs/:id/status", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job ID" });

      const input = api.tgData.updateJobStatus.input.parse(req.body);
      const job = await storage.getTransferJob(jobId);
      if (!job) return res.status(404).json({ message: "Job not found" });

      // Validate transitions
      if (input.status === "paused" && job.status !== "processing") {
        return res.status(400).json({ message: "Can only pause a processing job" });
      }
      if (input.status === "processing" && job.status !== "paused") {
        return res.status(400).json({ message: "Can only resume a paused job" });
      }
      if (input.status === "stopped" && !["processing", "paused"].includes(job.status)) {
        return res.status(400).json({ message: "Can only stop a processing or paused job" });
      }

      const updated = await storage.updateTransferJob(jobId, { status: input.status });
      res.status(200).json(updated);
    } catch (err) {
      console.error("Error updating job status:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update job" });
    }
  });

  return httpServer;
}

// Safe mode constants based on Telegram's known limits
const SAFE_MODE_CONFIG = {
  minDelay: 30_000,        // 30s minimum between adds
  maxDelay: 60_000,        // 60s maximum between adds
  dailyLimit: 50,          // Max 50 members per session
  batchSize: 20,           // Pause every 20 members
  batchPause: 5 * 60_000,  // 5 minute pause between batches
  skipDelayOnError: 2_000, // 2s delay on skip errors
};

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function extractTelegramWaitSeconds(message: string, err?: unknown): number | null {
  const secondsFromError = (err as any)?.seconds;
  if (typeof secondsFromError === "number" && Number.isFinite(secondsFromError) && secondsFromError > 0) {
    return Math.ceil(secondsFromError);
  }

  const patterns = [/FLOOD_WAIT_?(\d+)/i, /A wait of (\d+) seconds is required/i, /wait of (\d+) seconds/i];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) continue;

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

async function startBackgroundTransfer(jobId: number, sessionString: string, sourceGroupId: string, targetGroupId: string, safeMode: boolean = false, recklessMode: boolean = false) {
  try {
    await storage.updateTransferJob(jobId, { status: "processing" });
    
    const client = await getClient(sessionString);
    
    const { Api } = await loadTelegramRuntime();
    const participants = await client.getParticipants(sourceGroupId);
    console.log(`Found ${participants.length} participants in source group ${sourceGroupId} (safeMode=${safeMode})`);
    
    const effectiveTotal = safeMode ? Math.min(participants.length, SAFE_MODE_CONFIG.dailyLimit) : participants.length;
    await storage.updateTransferJob(jobId, { total: effectiveTotal, progress: 0 });

    let successCount = 0;
    
    let targetPeer: any;
    try {
      targetPeer = await client.getEntity(targetGroupId);
      console.log(`Resolved target group: ${targetPeer.title || 'Unknown'} (type: ${targetPeer.className}, megagroup: ${targetPeer.megagroup})`);
    } catch (err: any) {
      console.error(`Failed to resolve target group ${targetGroupId}:`, err);
      const dialogs = await client.getDialogs();
      targetPeer = dialogs.find((d: any) => d.id?.toString() === targetGroupId.toString())?.entity;
      if (!targetPeer) throw err;
    }
    
    for (const participant of participants) {
      if (participant.bot || participant.deleted) continue;

      // Safe mode: enforce daily limit
      if (safeMode && successCount >= SAFE_MODE_CONFIG.dailyLimit) {
        console.log(`[Transfer] Safe mode: reached daily limit of ${SAFE_MODE_CONFIG.dailyLimit}. Stopping.`);
        break;
      }

      // Safe mode: batch pause
      if (safeMode && successCount > 0 && successCount % SAFE_MODE_CONFIG.batchSize === 0) {
        console.log(`[Transfer] Safe mode: batch pause (${SAFE_MODE_CONFIG.batchPause / 1000}s) after ${successCount} members`);
        await new Promise(r => setTimeout(r, SAFE_MODE_CONFIG.batchPause));
      }

      // Check if job was paused or stopped
      const currentJob = await storage.getTransferJob(jobId);
      if (!currentJob) break;
      
      if (currentJob.status === "stopped") {
        console.log(`[Transfer] Job ${jobId} stopped by user.`);
        await storage.updateTransferJob(jobId, { status: "stopped" });
        return;
      }
      
      while (currentJob.status === "paused" || (await storage.getTransferJob(jobId))?.status === "paused") {
        console.log(`[Transfer] Job ${jobId} paused. Waiting...`);
        await new Promise(r => setTimeout(r, 3000));
        const recheckJob = await storage.getTransferJob(jobId);
        if (!recheckJob || recheckJob.status === "stopped") {
          if (recheckJob) await storage.updateTransferJob(jobId, { status: "stopped" });
          return;
        }
        if (recheckJob.status === "processing") break;
      }

      try {
        try {
          if (targetPeer.className === 'Channel' || targetPeer.megagroup) {
            await client.invoke(
              new Api.channels.InviteToChannel({
                channel: targetPeer,
                users: [participant.id],
              })
            );
          } else {
            await client.invoke(
              new Api.messages.AddChatUser({
                chatId: targetPeer.id,
                userId: participant.id,
                fwdLimit: 0
              })
            );
          }
          
          successCount++;
          await storage.updateTransferJob(jobId, { progress: successCount });
          console.log(`[Transfer] Added ${participant.id}. Progress: ${successCount}/${effectiveTotal}`);
          
          // Delay based on mode
          if (recklessMode) {
            await new Promise(r => setTimeout(r, 1000));
          } else if (safeMode) {
            const delay = randomDelay(SAFE_MODE_CONFIG.minDelay, SAFE_MODE_CONFIG.maxDelay);
            console.log(`[Transfer] Safe mode: waiting ${(delay / 1000).toFixed(0)}s`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            await new Promise(r => setTimeout(r, 12000));
          }
        } catch (err: any) {
          const errMsg = err.message || "";
          console.log(`[Transfer] Failed to add ${participant.id}: ${errMsg}`);
          
          if (errMsg.includes("USER_PRIVACY_RESTRICTED") || 
              errMsg.includes("USER_NOT_MUTUAL_CONTACT") || 
              errMsg.includes("USER_CHANNELS_TOO_MUCH") || 
              errMsg.includes("USER_BOT") ||
              errMsg.includes("BOT_GROUPS_BLOCKED") ||
              errMsg.includes("USER_ALREADY_PARTICIPANT") ||
              errMsg.includes("PEER_ID_INVALID")) {
            await new Promise(r => setTimeout(r, safeMode ? SAFE_MODE_CONFIG.skipDelayOnError : 1000));
          } else {
            const waitSeconds = extractTelegramWaitSeconds(errMsg, err);
            if (waitSeconds !== null) {
              (err as any).seconds = waitSeconds;
              throw err;
            } else if (errMsg.includes("CHAT_ADMIN_REQUIRED") || errMsg.includes("CHAT_WRITE_FORBIDDEN")) {
              throw new Error(`Permission error: ${errMsg}`);
            } else {
              console.error(`[Transfer] Unexpected error for ${participant.id}: ${errMsg}`);
              await new Promise(r => setTimeout(r, safeMode ? 10000 : 5000));
            }
          }
        }
      } catch (inviteErr: any) {
        const errMsg = inviteErr.message || "";
        const waitSeconds = extractTelegramWaitSeconds(errMsg, inviteErr);
        if (waitSeconds !== null) {
          console.log(`[Transfer] Flood wait: ${waitSeconds}s. Sleeping...`);
          await new Promise(r => setTimeout(r, (waitSeconds + (safeMode ? 30 : 5)) * 1000));
        } else {
          console.error(`[Transfer] Fatal error for ${participant.id}:`, errMsg);
          if (errMsg.includes("Permission error") || errMsg.includes("CHAT_ADMIN_REQUIRED")) {
            break;
          }
          await new Promise(r => setTimeout(r, safeMode ? 15000 : 5000));
        }
      }
    }

    await storage.updateTransferJob(jobId, { status: "completed" });
  } catch (err) {
    console.error(`Transfer job ${jobId} failed:`, err);
    await storage.updateTransferJob(jobId, { 
      status: "failed", 
      error: err instanceof Error ? err.message : "Unknown error" 
    });
  }
}
