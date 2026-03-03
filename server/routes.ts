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
        id: (d.id ?? d.entity?.id)?.toString() || "",
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
      const ultraMode = input.ultraMode ?? false;
      const job = await storage.createTransferJob({
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        status: "pending",
        progress: 0,
        total: 0,
      });

      // Start background job
      startBackgroundTransfer(
        job.id,
        input.sessionString,
        input.sourceGroupId,
        input.targetGroupId,
        safeMode,
        recklessMode,
        ultraMode,
      ).catch(console.error);

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

async function startBackgroundTransfer(
  jobId: number,
  sessionString: string,
  sourceGroupId: string,
  targetGroupId: string,
  safeMode: boolean = false,
  recklessMode: boolean = false,
  ultraMode: boolean = false,
) {
  try {
    await storage.updateTransferJob(jobId, { status: "processing" });

    const client = await getClient(sessionString);
    const { Api } = await loadTelegramRuntime();
    const participants = await client.getParticipants(sourceGroupId);
    const alreadyTransferred = await storage.getTransferredMembers(sourceGroupId, targetGroupId);

    const pendingParticipants = participants.filter((p: any) => {
      if (p.bot || p.deleted) return false;
      if (alreadyTransferred.has(p.id?.toString())) return false;
      return true;
    });

    console.log(
      `[Transfer #${jobId}] Found ${participants.length} total, ${alreadyTransferred.size} already transferred, ${pendingParticipants.length} pending (safe=${safeMode}, reckless=${recklessMode}, ultra=${ultraMode})`,
    );

    const participantsToProcess = safeMode
      ? pendingParticipants.slice(0, SAFE_MODE_CONFIG.dailyLimit)
      : pendingParticipants;

    const effectiveTotal = participantsToProcess.length;
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

    const isChannelLikePeer = (peer: any): boolean => {
      const className = String(peer?.className ?? "");
      return className.includes("Channel") || className.includes("InputPeerChannel") || peer?.megagroup === true;
    };

    async function inviteParticipantToTarget(inputUser: any): Promise<void> {
      const inviteToChannel = async () => {
        await client.invoke(
          new Api.channels.InviteToChannel({
            channel: targetPeer,
            users: [inputUser],
          }),
        );
      };

      const addToChat = async () => {
        await client.invoke(
          new Api.messages.AddChatUser({
            chatId: targetPeer.id,
            userId: inputUser,
            fwdLimit: 0,
          }),
        );
      };

      const isChannelTarget = isChannelLikePeer(targetPeer);

      if (isChannelTarget) {
        try {
          await inviteToChannel();
          return;
        } catch (err: any) {
          const msg = err?.message || String(err);
          const canFallbackToChat =
            targetPeer?.id !== undefined &&
            (msg.includes("CHAT_ID_INVALID") || msg.includes("CHANNEL_INVALID") || msg.includes("PEER_ID_INVALID"));

          if (!canFallbackToChat) throw err;
        }

        await addToChat();
        return;
      }

      try {
        await addToChat();
        return;
      } catch (err: any) {
        const msg = err?.message || String(err);
        const canFallbackToChannel =
          msg.includes("CHANNEL_INVALID") || msg.includes("CHAT_ID_INVALID") || msg.includes("PEER_ID_INVALID");

        if (!canFallbackToChannel) throw err;
      }

      await inviteToChannel();
    }

    async function waitRespectingJobState(totalMs: number): Promise<boolean> {
      let remaining = Math.max(0, totalMs);

      while (remaining > 0) {
        const chunkMs = Math.min(remaining, 3000);
        await new Promise((r) => setTimeout(r, chunkMs));
        remaining -= chunkMs;

        const currentJob = await storage.getTransferJob(jobId);
        if (!currentJob || currentJob.status === "stopped") {
          if (currentJob) await storage.updateTransferJob(jobId, { status: "stopped" });
          return false;
        }

        while ((await storage.getTransferJob(jobId))?.status === "paused") {
          await new Promise((r) => setTimeout(r, 3000));
          const pausedJob = await storage.getTransferJob(jobId);
          if (!pausedJob || pausedJob.status === "stopped") {
            if (pausedJob) await storage.updateTransferJob(jobId, { status: "stopped" });
            return false;
          }
        }
      }

      return true;
    }

    async function resolveInputUser(participant: any): Promise<any | null> {
      let accessHash = participant?.accessHash;

      if (accessHash === undefined || accessHash === null) {
        try {
          const resolved = await client.getInputEntity(participant.id);
          accessHash = (resolved as any)?.accessHash;
        } catch {
          // fallback below
        }
      }

      if (accessHash === undefined || accessHash === null) {
        return null;
      }

      return new Api.InputUser({
        userId: participant.id,
        accessHash,
      });
    }

    async function addSingleUser(
      participant: any,
    ): Promise<{
      status: "success" | "skipped" | "ratelimit" | "fatal";
      waitSeconds?: number;
      fatalCode?: "PEER_FLOOD" | "ADMIN_REQUIRED";
      fatalDetail?: string;
    }> {
      try {
        const inputUser = await resolveInputUser(participant);
        if (!inputUser) {
          await storage.addTransferredMember(sourceGroupId, targetGroupId, participant.id.toString());
          console.log(`[Transfer #${jobId}] ⏭ Skipped ${participant.id} (missing access hash)`);
          return { status: "skipped" };
        }

        await inviteParticipantToTarget(inputUser);

        await storage.addTransferredMember(sourceGroupId, targetGroupId, participant.id.toString());
        return { status: "success" };
      } catch (err: any) {
        const errMsg = err.message || String(err);

        if (errMsg.includes("USER_ALREADY_PARTICIPANT")) {
          await storage.addTransferredMember(sourceGroupId, targetGroupId, participant.id.toString());
          return { status: "skipped" };
        }

        if (
          errMsg.includes("USER_PRIVACY_RESTRICTED") ||
          errMsg.includes("USER_NOT_MUTUAL_CONTACT") ||
          errMsg.includes("USER_CHANNELS_TOO_MUCH") ||
          errMsg.includes("USER_BOT") ||
          errMsg.includes("BOT_GROUPS_BLOCKED") ||
          errMsg.includes("PEER_ID_INVALID") ||
          errMsg.includes("INPUT_USER_DEACTIVATED") ||
          errMsg.includes("USER_KICKED") ||
          errMsg.includes("USER_BANNED_IN_CHANNEL") ||
          errMsg.includes("USER_ID_INVALID") ||
          errMsg.includes("Could not find the input entity") ||
          errMsg.includes("USERS_TOO_MUCH")
        ) {
          await storage.addTransferredMember(sourceGroupId, targetGroupId, participant.id.toString());
          console.log(`[Transfer #${jobId}] ⏭ Skipped ${participant.id} (${errMsg.substring(0, 80)})`);
          return { status: "skipped" };
        }

        if (errMsg.includes("PEER_FLOOD")) {
          console.log(`[Transfer #${jobId}] 🚫 PEER_FLOOD detected — Telegram blocked invite actions for this account`);
          return { status: "fatal", fatalCode: "PEER_FLOOD", fatalDetail: errMsg };
        }

        const waitSeconds = extractTelegramWaitSeconds(errMsg, err);
        if (waitSeconds !== null) {
          return { status: "ratelimit", waitSeconds };
        }

        if (errMsg.includes("CHAT_ADMIN_REQUIRED") || errMsg.includes("CHAT_WRITE_FORBIDDEN")) {
          console.log(`[Transfer #${jobId}] 🚫 Fatal: ${errMsg}`);
          return { status: "fatal", fatalCode: "ADMIN_REQUIRED", fatalDetail: errMsg };
        }

        console.log(`[Transfer #${jobId}] ⚠️ Unknown error for ${participant.id}: ${errMsg}`);
        await storage.addTransferredMember(sourceGroupId, targetGroupId, participant.id.toString());
        return { status: "skipped" };
      }
    }

    for (let index = 0; index < participantsToProcess.length; index++) {
      const participant = participantsToProcess[index];

      if (safeMode && successCount > 0 && successCount % SAFE_MODE_CONFIG.batchSize === 0) {
        console.log(`[Transfer #${jobId}] Safe mode batch pause (${SAFE_MODE_CONFIG.batchPause / 1000}s)`);
        const canContinue = await waitRespectingJobState(SAFE_MODE_CONFIG.batchPause);
        if (!canContinue) return;
      }

      const currentJob = await storage.getTransferJob(jobId);
      if (!currentJob || currentJob.status === "stopped") {
        if (currentJob) await storage.updateTransferJob(jobId, { status: "stopped" });
        return;
      }

      while ((await storage.getTransferJob(jobId))?.status === "paused") {
        await new Promise((r) => setTimeout(r, 3000));
        const pausedJob = await storage.getTransferJob(jobId);
        if (!pausedJob || pausedJob.status === "stopped") {
          if (pausedJob) await storage.updateTransferJob(jobId, { status: "stopped" });
          return;
        }
      }

      let finalStatus: "success" | "skipped" | "ratelimit" | "fatal" = "skipped";
      let rateLimitRounds = 0;
      let fatalCode: "PEER_FLOOD" | "ADMIN_REQUIRED" | "UNKNOWN" = "UNKNOWN";
      let fatalDetail: string | undefined;
      const MAX_RATE_LIMIT_ROUNDS = 5;

      while (true) {
        const result = await addSingleUser(participant);
        finalStatus = result.status;

        if (result.status === "fatal") {
          fatalCode = result.fatalCode ?? "UNKNOWN";
          fatalDetail = result.fatalDetail;
          break;
        }

        if (result.status === "ratelimit") {
          rateLimitRounds += 1;

          if (rateLimitRounds > MAX_RATE_LIMIT_ROUNDS) {
            console.log(
              `[Transfer #${jobId}] ⏭ Skipping ${participant.id} after ${MAX_RATE_LIMIT_ROUNDS} rate-limit retries.`,
            );
            finalStatus = "skipped";
            break;
          }

          const waitMs = ((result.waitSeconds ?? 5) + 10) * 1000;
          console.log(
            `[Transfer #${jobId}] ⏳ Rate limit for ${participant.id}. Waiting ${Math.ceil(waitMs / 1000)}s (retry ${rateLimitRounds}/${MAX_RATE_LIMIT_ROUNDS})`,
          );

          const canContinue = await waitRespectingJobState(waitMs);
          if (!canContinue) return;
          continue;
        }

        break;
      }

      if (finalStatus === "success") {
        successCount += 1;
        await storage.updateTransferJob(jobId, { progress: successCount });
        console.log(`[Transfer #${jobId}] ✅ Success (${successCount}/${effectiveTotal})`);
      } else if (finalStatus === "fatal") {
        const fatalMsg =
          fatalCode === "ADMIN_REQUIRED"
            ? "Sem permissão de admin no grupo de destino para adicionar membros (CHAT_ADMIN_REQUIRED/CHAT_WRITE_FORBIDDEN)."
            : fatalCode === "PEER_FLOOD"
              ? "O Telegram bloqueou temporariamente convites automáticos desta conta (PEER_FLOOD). Aguarde e tente novamente no modo seguro."
              : `Falha fatal ao adicionar membro: ${(fatalDetail ?? "erro desconhecido").slice(0, 180)}`;

        await storage.updateTransferJob(jobId, { status: "failed", error: fatalMsg });
        return;
      }

      let delayMs = 0;
      if (finalStatus === "skipped") {
        delayMs = safeMode ? SAFE_MODE_CONFIG.skipDelayOnError : ultraMode ? 250 : 700;
      } else if (ultraMode) {
        delayMs = 250;
      } else if (recklessMode) {
        delayMs = 1000;
      } else if (safeMode) {
        delayMs = randomDelay(SAFE_MODE_CONFIG.minDelay, SAFE_MODE_CONFIG.maxDelay);
      } else {
        delayMs = 12000;
      }

      if (delayMs > 0) {
        const canContinue = await waitRespectingJobState(delayMs);
        if (!canContinue) return;
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
