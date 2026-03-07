import { loadTelegramRuntime, getClient } from "./telegram.js";

// Categories of groups to search for (popular Brazilian/international topics)
const DISCOVERY_SEARCH_TERMS = [
  "notícias brasil",
  "tecnologia",
  "música",
  "esportes",
  "games",
  "crypto",
  "filmes e séries",
  "culinária receitas",
  "investimentos",
  "programação dev",
  "marketing digital",
  "empreendedorismo",
  "memes",
  "english chat",
  "travel",
];

// Warm-up messages to send in groups (natural-looking)
const WARMUP_MESSAGES = [
  "Olá pessoal! 👋",
  "Bom dia a todos!",
  "Oi, acabei de entrar aqui 😊",
  "Hey! Tudo bem com vocês?",
  "Olá! Sou novo por aqui",
  "Boa tarde pessoal!",
  "Oi gente! 🙂",
  "E aí, como vai?",
  "Hello! 👋",
  "Oi! Prazer em conhecer vocês",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

export interface WarmupStatus {
  id: string;
  sessionPhone: string;
  status: "running" | "completed" | "failed";
  currentStep: string;
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
  log: string[];
}

// In-memory tracking of active warm-ups
const activeWarmups: Map<string, WarmupStatus> = new Map();

export function getWarmupStatus(id: string): WarmupStatus | undefined {
  return activeWarmups.get(id);
}

export function getAllWarmupStatuses(): WarmupStatus[] {
  return Array.from(activeWarmups.values());
}

export async function startWarmup(
  sessionString: string,
  phoneNumber: string,
  options: {
    joinGroups?: string[]; // group usernames or links to join
    sendMessages?: boolean;
    updateProfile?: boolean;
    autoDiscoverGroups?: boolean; // automatically find and join public groups
    discoverCount?: number; // how many groups to discover (default 5)
  } = {}
): Promise<string> {
  const id = `warmup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const joinGroups = options.joinGroups ?? [];
  const sendMessages = options.sendMessages ?? true;
  const updateProfile = options.updateProfile ?? true;
  const autoDiscoverGroups = options.autoDiscoverGroups ?? false;
  const discoverCount = options.discoverCount ?? 5;

  // Calculate total steps (discovery adds 1 step for searching + N for joining)
  let totalSteps = 0;
  if (updateProfile) totalSteps += 1;
  if (autoDiscoverGroups) totalSteps += 1 + discoverCount; // search + join discovered
  totalSteps += joinGroups.length;
  if (sendMessages) totalSteps += Math.min(joinGroups.length + (autoDiscoverGroups ? discoverCount : 0), 3);

  if (totalSteps === 0) totalSteps = 1;

  const warmup: WarmupStatus = {
    id,
    sessionPhone: phoneNumber,
    status: "running",
    currentStep: "Iniciando aquecimento...",
    stepsCompleted: 0,
    totalSteps,
    log: [],
  };

  activeWarmups.set(id, warmup);

  // Run in background
  runWarmup(id, sessionString, { joinGroups, sendMessages, updateProfile, autoDiscoverGroups, discoverCount }).catch((err) => {
    const w = activeWarmups.get(id);
    if (w) {
      w.status = "failed";
      w.error = err instanceof Error ? err.message : String(err);
      w.log.push(`❌ Erro: ${w.error}`);
    }
  });

  return id;
}

async function runWarmup(
  id: string,
  sessionString: string,
  options: {
    joinGroups: string[];
    sendMessages: boolean;
    updateProfile: boolean;
    autoDiscoverGroups: boolean;
    discoverCount: number;
  }
) {
  const warmup = activeWarmups.get(id)!;
  const client = await getClient(sessionString);
  const { Api } = await loadTelegramRuntime();

  const log = (msg: string) => {
    warmup.log.push(msg);
    console.log(`[Warmup ${id}] ${msg}`);
  };

  try {
    // Step 1: Check/Update profile
    if (options.updateProfile) {
      warmup.currentStep = "Verificando perfil...";
      log("🔍 Verificando perfil da conta...");

      try {
        const me = await client.getMe();
        const hasPhoto = me?.photo != null;
        const hasFirstName = me?.firstName && me.firstName.trim().length > 0;

        if (!hasFirstName) {
          log("⚠️ Conta sem nome configurado — perfis sem nome são mais suspeitos");
        } else {
          log(`✅ Nome: ${me.firstName}${me.lastName ? ` ${me.lastName}` : ""}`);
        }

        if (!hasPhoto) {
          log("⚠️ Conta sem foto de perfil — contas sem foto têm maior chance de PEER_FLOOD");
        } else {
          log("✅ Foto de perfil detectada");
        }
      } catch (err: any) {
        log(`⚠️ Não foi possível verificar perfil: ${err.message}`);
      }

      warmup.stepsCompleted++;
      await randomDelay(2000, 4000);
    }

    // Step 2: Auto-discover and join public groups
    const joinedGroupEntities: any[] = [];

    if (options.autoDiscoverGroups) {
      warmup.currentStep = "Buscando grupos públicos...";
      log("🔍 Buscando grupos públicos para entrar automaticamente...");

      const discoveredGroups: { username: string; title: string }[] = [];
      const shuffledTerms = [...DISCOVERY_SEARCH_TERMS].sort(() => Math.random() - 0.5);

      for (const term of shuffledTerms) {
        if (discoveredGroups.length >= options.discoverCount) break;

        try {
          const result = await client.invoke(new Api.contacts.Search({ q: term, limit: 10 }));
          const chats = (result as any)?.chats || [];

          for (const chat of chats) {
            if (discoveredGroups.length >= options.discoverCount) break;
            // Only pick groups/channels with usernames (public) and with enough members
            if (chat.username && (chat.megagroup || chat.broadcast || chat.className === "Channel") && chat.participantsCount > 50) {
              const alreadyAdded = discoveredGroups.some((g) => g.username === chat.username);
              if (!alreadyAdded) {
                discoveredGroups.push({ username: chat.username, title: chat.title || chat.username });
              }
            }
          }
        } catch (err: any) {
          log(`⚠️ Busca "${term}" falhou: ${err.message}`);
        }

        await randomDelay(2000, 5000);
      }

      warmup.stepsCompleted++;
      log(`✅ Encontrou ${discoveredGroups.length} grupos públicos`);

      // Join discovered groups
      for (let i = 0; i < discoveredGroups.length; i++) {
        const group = discoveredGroups[i];
        warmup.currentStep = `Entrando em grupo descoberto ${i + 1}/${discoveredGroups.length}: ${group.title}`;
        log(`📥 Entrando no grupo descoberto: @${group.username} (${group.title})`);

        try {
          const result = await client.invoke(new Api.channels.JoinChannel({ channel: group.username }));
          const entity = (result as any)?.chats?.[0];
          if (entity) {
            joinedGroupEntities.push(entity);
            log(`✅ Entrou em @${group.username}`);
          }
        } catch (e: any) {
          if (e.message?.includes("USER_ALREADY_PARTICIPANT")) {
            log(`ℹ️ Já é membro de @${group.username}`);
            try {
              const entity = await client.getEntity(group.username);
              if (entity) joinedGroupEntities.push(entity);
            } catch {}
          } else {
            log(`⚠️ Falha ao entrar em @${group.username}: ${e.message}`);
          }
        }

        warmup.stepsCompleted++;

        if (i < discoveredGroups.length - 1) {
          const delayMs = Math.floor(Math.random() * (120000 - 30000)) + 30000;
          log(`⏳ Aguardando ${Math.round(delayMs / 1000)}s antes do próximo grupo...`);
          warmup.currentStep = `Aguardando ${Math.round(delayMs / 1000)}s...`;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }

    // Step 3: Join manually specified groups

    for (let i = 0; i < options.joinGroups.length; i++) {
      const groupLink = options.joinGroups[i].trim();
      warmup.currentStep = `Entrando no grupo ${i + 1}/${options.joinGroups.length}...`;

      log(`📥 Entrando no grupo: ${groupLink}`);

      try {
        // Parse link
        const inviteMatch = groupLink.match(/(?:t\.me\/\+|t\.me\/joinchat\/)([a-zA-Z0-9_-]+)/);
        const usernameMatch = groupLink.match(/t\.me\/([a-zA-Z0-9_]+)$/);
        const plainUsername = !groupLink.includes("/") ? groupLink.replace("@", "") : null;

        let entity: any = null;

        if (inviteMatch) {
          try {
            const result = await client.invoke(new Api.messages.ImportChatInvite({ hash: inviteMatch[1] }));
            entity = (result as any)?.chats?.[0];
            log(`✅ Entrou via convite privado`);
          } catch (e: any) {
            if (e.message?.includes("USER_ALREADY_PARTICIPANT")) {
              log(`ℹ️ Já é membro deste grupo`);
              try {
                const check = await client.invoke(new Api.messages.CheckChatInvite({ hash: inviteMatch[1] }));
                entity = (check as any)?.chat;
              } catch {}
            } else {
              log(`⚠️ Falha ao entrar: ${e.message}`);
            }
          }
        } else if (usernameMatch || plainUsername) {
          const username = usernameMatch ? usernameMatch[1] : plainUsername!;
          try {
            const result = await client.invoke(new Api.channels.JoinChannel({ channel: username }));
            entity = (result as any)?.chats?.[0];
            log(`✅ Entrou no grupo @${username}`);
          } catch (e: any) {
            if (e.message?.includes("USER_ALREADY_PARTICIPANT")) {
              log(`ℹ️ Já é membro de @${username}`);
              try { entity = await client.getEntity(username); } catch {}
            } else {
              log(`⚠️ Falha ao entrar em @${username}: ${e.message}`);
            }
          }
        } else {
          log(`⚠️ Formato de link não reconhecido: ${groupLink}`);
        }

        if (entity) {
          joinedGroupEntities.push(entity);
        }
      } catch (err: any) {
        log(`⚠️ Erro ao processar grupo: ${err.message}`);
      }

      warmup.stepsCompleted++;

      // Random delay between group joins (30s - 2min to look natural)
      if (i < options.joinGroups.length - 1) {
        const delayMs = Math.floor(Math.random() * (120000 - 30000)) + 30000;
        log(`⏳ Aguardando ${Math.round(delayMs / 1000)}s antes do próximo grupo...`);
        warmup.currentStep = `Aguardando ${Math.round(delayMs / 1000)}s...`;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Step 3: Send messages in joined groups
    if (options.sendMessages && joinedGroupEntities.length > 0) {
      const groupsToMessage = joinedGroupEntities.slice(0, 3); // max 3 groups

      // Wait a bit before sending messages (5-10 min after joining)
      const preMessageDelay = Math.floor(Math.random() * (600000 - 300000)) + 300000;
      log(`⏳ Aguardando ${Math.round(preMessageDelay / 1000)}s antes de enviar mensagens...`);
      warmup.currentStep = `Aguardando ${Math.round(preMessageDelay / 60000)}min antes de enviar mensagens...`;
      await new Promise((r) => setTimeout(r, preMessageDelay));

      for (let i = 0; i < groupsToMessage.length; i++) {
        const group = groupsToMessage[i];
        warmup.currentStep = `Enviando mensagem ${i + 1}/${groupsToMessage.length}...`;

        try {
          const message = pickRandom(WARMUP_MESSAGES);
          await client.sendMessage(group, { message });
          log(`💬 Mensagem enviada no grupo ${group.title || group.id}: "${message}"`);
        } catch (err: any) {
          log(`⚠️ Falha ao enviar mensagem: ${err.message}`);
        }

        warmup.stepsCompleted++;

        // Delay between messages (1-3 min)
        if (i < groupsToMessage.length - 1) {
          const msgDelay = Math.floor(Math.random() * (180000 - 60000)) + 60000;
          warmup.currentStep = `Aguardando ${Math.round(msgDelay / 1000)}s...`;
          await new Promise((r) => setTimeout(r, msgDelay));
        }
      }
    }

    warmup.status = "completed";
    warmup.currentStep = "Aquecimento concluído!";
    warmup.stepsCompleted = warmup.totalSteps;
    log("✅ Aquecimento concluído com sucesso!");
    log("💡 Recomendação: aguarde 24-48h antes de usar esta conta para convites em massa.");
  } catch (err: any) {
    warmup.status = "failed";
    warmup.error = err.message;
    warmup.currentStep = "Erro no aquecimento";
    log(`❌ Erro fatal: ${err.message}`);
  }
}
