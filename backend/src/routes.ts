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
  clearAllClients,
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
const transferInput = z.object({
  sessionString: z.string(),
  sourceGroupId: z.string(),
  targetGroupId: z.string(),
  safeMode: z.boolean().optional().default(false),
  recklessMode: z.boolean().optional().default(false),
  ultraMode: z.boolean().optional().default(false),
  sourceIsLink: z.boolean().optional().default(false),
  targetIsLink: z.boolean().optional().default(false),
  sessions: z.array(z.string()).optional(),
  membersPerAccount: z.number().optional(),
});
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

      // Fetch ALL dialogs (default limit is small ~100)
      const dialogs = await client.getDialogs({ limit: 500 });
      const mapped = dialogs
        .map((d: any) => ({
          id: (d.id ?? d.entity?.id)?.toString() || "",
          title: d.title,
          isGroup: d.isGroup,
          isChannel: d.isChannel || false,
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
      const recklessMode = input.recklessMode ?? false;
      const ultraMode = input.ultraMode ?? false;
      const sourceIsLink = input.sourceIsLink ?? false;
      const targetIsLink = input.targetIsLink ?? false;
      const sessions = input.sessions;
      const membersPerAccount = input.membersPerAccount;

      const job = await storage.createTransferJob({
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        status: "pending",
        progress: 0,
        total: 0,
      });

      startBackgroundTransfer(
        job.id,
        input.sessionString,
        input.sourceGroupId,
        input.targetGroupId,
        safeMode,
        recklessMode,
        ultraMode,
        sourceIsLink,
        targetIsLink,
        sessions,
        membersPerAccount,
      ).catch(console.error);

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

// --- Background transfer logic ---
async function startBackgroundTransfer(
  jobId: number,
  sessionString: string,
  sourceGroupId: string,
  targetGroupId: string,
  safeMode: boolean = false,
  recklessMode: boolean = false,
  ultraMode: boolean = false,
  sourceIsLink: boolean = false,
  targetIsLink: boolean = false,
  sessions?: string[],
  membersPerAccount?: number,
) {
  try {
    await storage.updateTransferJob(jobId, { status: "processing" });
    const primaryClient = await getClient(sessionString);
    const { Api } = await loadTelegramRuntime();

    // If source is a link, join the group first to extract members
    let resolvedSourceId = sourceGroupId;
    let sourceEntity: any = null;
    if (sourceIsLink) {
      const link = sourceGroupId.trim();
      console.log(`[Transfer #${jobId}] Resolving source link: ${link}`);
      try {
        const webTgMatch = link.match(/web\.telegram\.org\/[^#]*#(-?\d+)/);
        if (webTgMatch) {
          let rawId = webTgMatch[1];
          if (rawId.startsWith("-100")) rawId = rawId.slice(4);
          else if (rawId.startsWith("-")) rawId = rawId.slice(1);
          resolvedSourceId = rawId;
          console.log(`[Transfer #${jobId}] Resolved web.telegram.org to ID: ${resolvedSourceId}`);
        } else {
          const inviteMatch = link.match(/(?:t\.me\/\+|t\.me\/joinchat\/)([a-zA-Z0-9_-]+)/);
          const usernameMatch = link.match(/t\.me\/([a-zA-Z0-9_]+)$/);

          if (inviteMatch) {
            const hash = inviteMatch[1];
            try {
              const result = await primaryClient.invoke(new Api.messages.ImportChatInvite({ hash }));
              const chat = (result as any)?.chats?.[0];
              if (chat) {
                sourceEntity = chat;
                resolvedSourceId = chat.id.toString();
                console.log(`[Transfer #${jobId}] Joined source via invite, resolved to ${resolvedSourceId}`);
              }
            } catch (e: any) {
              if (e.message?.includes("USER_ALREADY_PARTICIPANT") || e.errorMessage === "USER_ALREADY_PARTICIPANT") {
                // Already in group - resolve via CheckChatInvite
                try {
                  const checkResult = await primaryClient.invoke(new Api.messages.CheckChatInvite({ hash }));
                  const chat = (checkResult as any)?.chat;
                  if (chat) {
                    sourceEntity = chat;
                    resolvedSourceId = chat.id.toString();
                    console.log(`[Transfer #${jobId}] Already in source group, resolved to ${resolvedSourceId}`);
                  }
                } catch (checkErr: any) {
                  console.log(`[Transfer #${jobId}] CheckChatInvite failed: ${checkErr.message}`);
                }
              } else {
                throw e;
              }
            }
          } else if (usernameMatch) {
            const username = usernameMatch[1];
            try {
              const joinResult = await primaryClient.invoke(new Api.channels.JoinChannel({ channel: username }));
              const chat = (joinResult as any)?.chats?.[0];
              if (chat) {
                sourceEntity = chat;
                resolvedSourceId = chat.id.toString();
              }
            } catch (e: any) {
              const eMsg = e.message || e.errorMessage || String(e);
              if (eMsg.includes("FROZEN_METHOD_INVALID") || eMsg.includes("USERNAME_NOT_OCCUPIED")) {
                throw new Error(`Conta restrita pelo Telegram ou grupo "@${username}" não existe. Tente com outra conta.`);
              }
              if (!eMsg.includes("USER_ALREADY_PARTICIPANT")) throw e;
            }
            // Fallback chain if entity not yet resolved
            if (!sourceEntity) {
              // Wait for session cache to update after joining
              await new Promise(r => setTimeout(r, 2000));
              try {
                sourceEntity = await primaryClient.getEntity(username);
                resolvedSourceId = sourceEntity.id.toString();
              } catch {
                // Search in dialogs as last resort
                const dialogs = await primaryClient.getDialogs();
                const found = dialogs.find((d: any) => 
                  d.entity?.username?.toLowerCase() === username.toLowerCase() ||
                  d.title?.toLowerCase() === username.toLowerCase()
                );
                if (found?.entity) {
                  sourceEntity = found.entity;
                  resolvedSourceId = found.entity.id.toString();
                } else {
                  throw new Error(`Grupo "@${username}" não encontrado. Verifique se o link está correto e se a conta tem acesso ao grupo.`);
                }
              }
            }
            console.log(`[Transfer #${jobId}] Joined public source, resolved to ${resolvedSourceId}`);
          } else {
            throw new Error(`Formato de link inválido: ${link}`);
          }
        }
      } catch (err: any) {
        if (err.message?.includes("USER_ALREADY_PARTICIPANT")) {
          const usernameMatch = link.match(/t\.me\/([a-zA-Z0-9_]+)$/);
          if (usernameMatch) {
            try {
              sourceEntity = await primaryClient.getEntity(usernameMatch[1]);
              resolvedSourceId = sourceEntity.id.toString();
            } catch {
              const dialogs = await primaryClient.getDialogs();
              const found = dialogs.find((d: any) => 
                d.entity?.username?.toLowerCase() === usernameMatch[1].toLowerCase()
              );
              if (found?.entity) {
                sourceEntity = found.entity;
                resolvedSourceId = found.entity.id.toString();
              }
            }
          }
        } else {
          throw new Error(`Falha ao entrar no grupo de origem: ${err.message}`);
        }
      }
      // Wait a bit after joining source before fetching participants
      await new Promise(r => setTimeout(r, 3000));
    }

    // Resolve target link if needed
    let resolvedTargetId = targetGroupId;
    let targetLinkInfo: { type: 'invite'; hash: string } | { type: 'username'; username: string } | null = null;
    if (targetIsLink) {
      const link = targetGroupId.trim();
      console.log(`[Transfer #${jobId}] Resolving target link: ${link}`);
      try {
        const webTgMatch = link.match(/web\.telegram\.org\/[^#]*#(-?\d+)/);
        if (webTgMatch) {
          let rawId = webTgMatch[1];
          if (rawId.startsWith("-100")) rawId = rawId.slice(4);
          else if (rawId.startsWith("-")) rawId = rawId.slice(1);
          resolvedTargetId = rawId;
          console.log(`[Transfer #${jobId}] Resolved target web.telegram.org to ID: ${resolvedTargetId}`);
        } else {
          const inviteMatch = link.match(/(?:t\.me\/\+|t\.me\/joinchat\/)([a-zA-Z0-9_-]+)/);
          const usernameMatch = link.match(/t\.me\/([a-zA-Z0-9_]+)$/);
          if (inviteMatch) {
            targetLinkInfo = { type: 'invite', hash: inviteMatch[1] };
            try {
              const result = await primaryClient.invoke(new Api.messages.ImportChatInvite({ hash: inviteMatch[1] }));
              const chat = (result as any)?.chats?.[0];
              if (chat) resolvedTargetId = chat.id.toString();
            } catch (inviteErr: any) {
              const inviteMsg = inviteErr.message || inviteErr.errorMessage || String(inviteErr);
              if (inviteMsg.includes("USER_ALREADY_PARTICIPANT")) {
                // Already in group - resolve via CheckChatInvite
                try {
                  const checkResult = await primaryClient.invoke(new Api.messages.CheckChatInvite({ hash: inviteMatch[1] }));
                  const chat = (checkResult as any)?.chat;
                  if (chat) resolvedTargetId = chat.id.toString();
                } catch { /* will fail below if unresolved */ }
              } else if (inviteMsg.includes("FROZEN_METHOD_INVALID")) {
                throw new Error(`Conta restrita pelo Telegram — não pode usar convites. Tente com outra conta.`);
              } else {
                throw inviteErr;
              }
            }
          } else if (usernameMatch) {
            targetLinkInfo = { type: 'username', username: usernameMatch[1] };
            try {
              const joinResult = await primaryClient.invoke(new Api.channels.JoinChannel({ channel: usernameMatch[1] }));
              const chat = (joinResult as any)?.chats?.[0];
              if (chat) resolvedTargetId = chat.id.toString();
            } catch (e: any) {
              const eMsg = e.message || e.errorMessage || String(e);
              if (eMsg.includes("FROZEN_METHOD_INVALID")) {
                throw new Error(`Conta restrita pelo Telegram. Tente com outra conta.`);
              }
              if (!eMsg.includes("USER_ALREADY_PARTICIPANT")) throw e;
            }
            if (!resolvedTargetId || resolvedTargetId === targetGroupId) {
              try {
                const entity = await primaryClient.getEntity(usernameMatch[1]);
                resolvedTargetId = entity.id.toString();
              } catch {
                const dialogs = await primaryClient.getDialogs();
                const found = dialogs.find((d: any) =>
                  d.entity?.username?.toLowerCase() === usernameMatch[1].toLowerCase()
                );
                if (found?.entity) {
                  resolvedTargetId = found.entity.id.toString();
                } else {
                  throw new Error(`Grupo de destino "@${usernameMatch[1]}" não encontrado.`);
                }
              }
            }
          } else {
            throw new Error(`Formato de link de destino inválido: ${link}`);
          }
          // Wait after joining target to avoid immediate PEER_FLOOD
          console.log(`[Transfer #${jobId}] ⏳ Waiting 10s after joining target group...`);
          await new Promise(r => setTimeout(r, 10000));
        }
      } catch (err: any) {
        if (err.message?.includes("USER_ALREADY_PARTICIPANT")) {
          const usernameMatch = link.match(/t\.me\/([a-zA-Z0-9_]+)$/);
          if (usernameMatch) {
            targetLinkInfo = { type: 'username', username: usernameMatch[1] };
            try {
              const entity = await primaryClient.getEntity(usernameMatch[1]);
              resolvedTargetId = entity.id.toString();
            } catch {
              const dialogs = await primaryClient.getDialogs();
              const found = dialogs.find((d: any) =>
                d.entity?.username?.toLowerCase() === usernameMatch[1].toLowerCase()
              );
              if (found?.entity) resolvedTargetId = found.entity.id.toString();
            }
          }
        } else {
          throw new Error(`Falha ao resolver grupo de destino: ${err.message}`);
        }
      }
    }

    const client = primaryClient;
    
    // Use the resolved entity if available (from invite links), otherwise fall back to ID
    const sourceTarget = sourceEntity || resolvedSourceId;
    console.log(`[Transfer #${jobId}] Fetching participants from ${resolvedSourceId} (entity=${!!sourceEntity})`);
    
    let participants: any[];
    try {
      participants = await client.getParticipants(sourceTarget);
    } catch (err: any) {
      console.error(`[Transfer #${jobId}] getParticipants failed with entity, trying via dialogs...`, err.message);
      // Fallback: try to find entity via dialogs
      const dialogs = await client.getDialogs();
      const dialog = dialogs.find((d: any) => d.id?.toString() === resolvedSourceId.toString());
      if (dialog?.entity) {
        participants = await client.getParticipants(dialog.entity);
      } else {
        throw new Error(`Não foi possível acessar os participantes do grupo de origem. Verifique se a conta tem acesso ao grupo. Erro: ${err.message}`);
      }
    }
    
    const alreadyTransferred = await storage.getTransferredMembers(sourceGroupId, targetGroupId);

    const pendingParticipants = participants.filter((p: any) => {
      if (p.bot || p.deleted) return false;
      if (alreadyTransferred.has(p.id?.toString())) return false;
      return true;
    });

    console.log(
      `Found ${participants.length} total, ${alreadyTransferred.size} already transferred, ${pendingParticipants.length} pending (safe=${safeMode}, reckless=${recklessMode}, ultra=${ultraMode})`
    );

    const participantsToProcess = safeMode
      ? pendingParticipants.slice(0, SAFE_MODE_CONFIG.dailyLimit)
      : pendingParticipants;

    const effectiveTotal = participantsToProcess.length;
    await storage.updateTransferJob(jobId, { total: effectiveTotal, progress: 0 });

    let successCount = 0;

    // Multi-account rotation setup
    const allSessions = sessions && sessions.length > 0 ? [sessionString, ...sessions] : [sessionString];
    const rotationLimit = membersPerAccount ?? 10;
    let currentSessionIndex = 0;
    let currentRotationCount = 0;
    let activeClient = client;

    async function rotateToNextAccount(): Promise<boolean> {
      if (allSessions.length <= 1) return true;
      currentSessionIndex = (currentSessionIndex + 1) % allSessions.length;
      currentRotationCount = 0;
      try {
        activeClient = await getClient(allSessions[currentSessionIndex]);
        console.log(`[Transfer #${jobId}] 🔄 Rotated to account ${currentSessionIndex + 1}/${allSessions.length}`);
        // Ensure rotated account joins target group if it was resolved via link
        if (targetLinkInfo) {
          try {
            if (targetLinkInfo.type === 'username') {
              await activeClient.invoke(new Api.channels.JoinChannel({ channel: targetLinkInfo.username }));
            } else if (targetLinkInfo.type === 'invite') {
              await activeClient.invoke(new Api.messages.ImportChatInvite({ hash: targetLinkInfo.hash }));
            }
            console.log(`[Transfer #${jobId}] ✅ Rotated account joined target group`);
            await new Promise(r => setTimeout(r, 5000));
          } catch (e: any) {
            if (!e.message?.includes("USER_ALREADY_PARTICIPANT")) {
              console.log(`[Transfer #${jobId}] ⚠️ Rotated account failed to join target: ${e.message}`);
            }
          }
        }
        return true;
      } catch (err: any) {
        console.log(`[Transfer #${jobId}] ⚠️ Account ${currentSessionIndex + 1} failed: ${err.message}`);
        const startIdx = currentSessionIndex;
        do {
          currentSessionIndex = (currentSessionIndex + 1) % allSessions.length;
          if (currentSessionIndex === startIdx) return false;
          try {
            activeClient = await getClient(allSessions[currentSessionIndex]);
            console.log(`[Transfer #${jobId}] 🔄 Fell back to account ${currentSessionIndex + 1}/${allSessions.length}`);
            return true;
          } catch { /* try next */ }
        } while (true);
      }
    }

    let targetPeer: any;
    try {
      targetPeer = await client.getEntity(resolvedTargetId);
    } catch (err: any) {
      const dialogs = await client.getDialogs();
      targetPeer = dialogs.find((d: any) => d.id?.toString() === resolvedTargetId.toString())?.entity;
      if (!targetPeer) throw err;
    }

    const isChannelLikePeer = (peer: any): boolean => {
      const className = String(peer?.className ?? "");
      if (className.includes("Channel") || className.includes("InputPeerChannel") || peer?.megagroup === true) {
        return true;
      }
      // Supergroups/channels have IDs that, when represented as negative, start with -100
      const idStr = String(peer?.id ?? resolvedTargetId ?? "");
      if (idStr.startsWith("-100") || idStr.startsWith("100")) {
        return true;
      }
      return false;
    };

    console.log(`[Transfer #${jobId}] Target peer className=${targetPeer?.className}, megagroup=${targetPeer?.megagroup}, id=${targetPeer?.id}, isChannel=${isChannelLikePeer(targetPeer)}`);

    async function inviteParticipantToTarget(inputUser: any): Promise<void> {
      const inviteToChannel = async () => {
        await activeClient.invoke(new Api.channels.InviteToChannel({ channel: targetPeer, users: [inputUser] }));
      };

      const addToChat = async () => {
        await activeClient.invoke(new Api.messages.AddChatUser({ chatId: targetPeer.id, userId: inputUser, fwdLimit: 0 }));
      };

      const isChannelTarget = isChannelLikePeer(targetPeer);

      const canFallbackToChat = (message: string): boolean =>
        targetPeer?.id !== undefined &&
        [
          /CHAT_ID_INVALID/i,
          /CHANNEL_INVALID/i,
          /PEER_ID_INVALID/i,
          /MEGAGROUP_REQUIRED/i,
          /INPUT_CONSTRUCTOR_INVALID/i,
          /Cannot cast .*InputPeerChat.*InputChannel/i,
        ].some((pattern) => pattern.test(message));

      const canFallbackToChannel = (message: string): boolean =>
        [
          /CHANNEL_INVALID/i,
          /CHAT_ID_INVALID/i,
          /PEER_ID_INVALID/i,
          /MEGAGROUP_REQUIRED/i,
          /INPUT_CONSTRUCTOR_INVALID/i,
          /Cannot cast .*InputChannel.*InputPeerChat/i,
        ].some((pattern) => pattern.test(message));

      if (isChannelTarget) {
        try {
          await inviteToChannel();
          return;
        } catch (err: any) {
          const msg = err?.message || String(err);
          if (!canFallbackToChat(msg)) throw err;
        }

        await addToChat();
        return;
      }

      try {
        await addToChat();
        return;
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (!canFallbackToChannel(msg)) throw err;
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
          const resolved = await activeClient.getInputEntity(participant.id);
          accessHash = (resolved as any)?.accessHash;
        } catch {
          // ignore and fallback below
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
      participant: any
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
              `[Transfer #${jobId}] ⏭ Skipping ${participant.id} after ${MAX_RATE_LIMIT_ROUNDS} rate-limit retries.`
            );
            await storage.addTransferredMember(sourceGroupId, targetGroupId, participant.id.toString());
            finalStatus = "skipped";
            break;
          }

          const waitMs = ((result.waitSeconds ?? 5) + 10) * 1000;
          console.log(
            `[Transfer #${jobId}] ⏳ Rate limit no usuário ${participant.id}. Esperando ${Math.ceil(
              waitMs / 1000
            )}s (round ${rateLimitRounds}/${MAX_RATE_LIMIT_ROUNDS})`
          );

          const canContinue = await waitRespectingJobState(waitMs);
          if (!canContinue) return;
          continue;
        }

        break;
      }

      if (finalStatus === "success") {
        successCount += 1;
        currentRotationCount += 1;
        await storage.updateTransferJob(jobId, { progress: successCount });
        console.log(`[Transfer #${jobId}] ✅ Success (${successCount}/${effectiveTotal}) [account ${currentSessionIndex + 1}, ${currentRotationCount}/${rotationLimit}]`);

        // Rotate account if limit reached
        if (allSessions.length > 1 && currentRotationCount >= rotationLimit) {
          const canRotate = await rotateToNextAccount();
          if (!canRotate) {
            await storage.updateTransferJob(jobId, { status: "failed", error: "Todas as contas foram banidas ou estão indisponíveis." });
            return;
          }
        }
      } else if (finalStatus === "fatal") {
        // On PEER_FLOOD with multi-account, try rotating instead of failing
        if (fatalCode === "PEER_FLOOD" && allSessions.length > 1) {
          console.log(`[Transfer #${jobId}] 🔄 PEER_FLOOD on account ${currentSessionIndex + 1}, rotating...`);
          const canRotate = await rotateToNextAccount();
          if (!canRotate) {
            await storage.updateTransferJob(jobId, { status: "failed", error: "Todas as contas receberam PEER_FLOOD." });
            return;
          }
          index--; // retry this participant with new account
          continue;
        }

        const fatalDetailSnippet = (fatalDetail ?? "").replace(/\s+/g, " ").slice(0, 180);
        const fatalDetailSuffix = fatalDetailSnippet ? ` Detalhe: ${fatalDetailSnippet}` : "";

        const fatalMsg =
          fatalCode === "ADMIN_REQUIRED"
            ? `Sem permissão de admin no grupo de destino (CHAT_ADMIN_REQUIRED).${fatalDetailSuffix}`
            : fatalCode === "PEER_FLOOD"
              ? `PEER_FLOOD — Telegram bloqueou convites desta conta.${fatalDetailSuffix}`
              : `Falha fatal: ${(fatalDetail ?? "erro desconhecido").slice(0, 180)}`;

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

