import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

// Configuração fixa da API do Telegram (ID e Hash)
const TELEGRAM_API_ID = 39753963;
const TELEGRAM_API_HASH = "f1042f3f78db95aec5a2090192f2688c";

// Store active clients in memory to avoid reconnecting constantly during an active session
const activeClients: Map<string, TelegramClient> = new Map();
const pendingAuthClients: Map<string, TelegramClient> = new Map();

async function getClient(sessionString: string): Promise<TelegramClient> {
  const cacheKey = `${TELEGRAM_API_ID}-${TELEGRAM_API_HASH}-${sessionString.substring(0, 20)}`;
  if (activeClients.has(cacheKey)) {
    const client = activeClients.get(cacheKey)!;
    if (client.connected) {
      return client;
    }
  }

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
      const input = api.tgAuth.sendCode.input.parse(req.body);
      
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
      const input = api.tgAuth.login.input.parse(req.body);
      
      let client = pendingAuthClients.get(input.phoneNumber);
      
      if (!client || !client.connected) {
        const stringSession = new StringSession("");
        client = new TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
          connectionRetries: 5,
          useWSS: true
        });
        await client.connect();
      }
      
      const { Api } = await import("telegram");
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
      const input = api.tgData.dialogs.input.parse(req.body);
      const client = await getClient(input.sessionString);
      
      const dialogs = await client.getDialogs();
      const mapped = dialogs.map(d => ({
        id: d.entity?.id?.toString() || "",
        title: d.title,
        isGroup: d.isGroup,
      })).filter(d => d.id !== "");

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
      const input = api.tgData.startTransfer.input.parse(req.body);
      
      const job = await storage.createTransferJob({
        sourceGroupId: input.sourceGroupId,
        targetGroupId: input.targetGroupId,
        status: "pending",
        progress: 0,
        total: 0,
      });

      // Start background job
      startBackgroundTransfer(job.id, input.sessionString, input.sourceGroupId, input.targetGroupId).catch(console.error);

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

  return httpServer;
}

async function startBackgroundTransfer(jobId: number, sessionString: string, sourceGroupId: string, targetGroupId: string) {
  try {
    await storage.updateTransferJob(jobId, { status: "processing" });
    
    const client = await getClient(sessionString);
    
    // Convert string IDs to BigInts for gramjs
    const { Api } = require("telegram");
    const BigInt = require("big-integer");
    
    // Fetch participants from source
    // Note: getParticipants can be limited. For huge groups it requires multiple requests.
    const participants = await client.getParticipants(sourceGroupId);
    
    await storage.updateTransferJob(jobId, { total: participants.length, progress: 0 });

    let successCount = 0;
    
    for (const participant of participants) {
      try {
        // Invite to target
        await client.invoke(
          new Api.channels.InviteToChannel({
            channel: targetGroupId,
            users: [participant.id],
          })
        );
        successCount++;
        await storage.updateTransferJob(jobId, { progress: successCount });
        
        // Sleep to avoid flooding
        await new Promise(r => setTimeout(r, 2000));
      } catch (inviteErr) {
        console.error(`Failed to invite ${participant.id}:`, inviteErr);
        // If we hit FloodWait, we might need to sleep longer
        if (inviteErr && typeof inviteErr === 'object' && 'seconds' in inviteErr) {
          const waitTime = (inviteErr as any).seconds;
          console.log(`Flood wait for ${waitTime} seconds`);
          await new Promise(r => setTimeout(r, waitTime * 1000));
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
