import { getClient, loadTelegramRuntime } from "./telegram.js";

// Conversation topics with natural Brazilian Portuguese exchanges
const CONVERSATION_TOPICS: { starter: string; replies: string[] }[] = [
  {
    starter: "E aí, tudo bem? Como foi seu dia?",
    replies: [
      "Tudo ótimo! Trabalhei bastante hoje, e você?",
      "De boa! Dia tranquilo por aqui 😊",
      "Bem demais! Fui na academia e depois fiquei de boas",
    ],
  },
  {
    starter: "Opa! Viu aquele jogo ontem?",
    replies: [
      "Vi sim! Que jogo incrível, não esperava aquele resultado",
      "Não consegui assistir 😢 como foi?",
      "Demais! Melhor jogo do campeonato até agora",
    ],
  },
  {
    starter: "Cara, tô pensando em aprender algo novo. Alguma sugestão?",
    replies: [
      "Que tal programação? Tá em alta no mercado",
      "Eu comecei a estudar inglês recentemente, recomendo!",
      "Aprende a cozinhar! É muito útil e divertido 🍳",
    ],
  },
  {
    starter: "Conhece algum filme bom pra assistir?",
    replies: [
      "Assisti um ótimo ontem na Netflix, vou te mandar o nome",
      "Depende do gênero! Gosta de ação ou comédia?",
      "Tem um documentário novo que tá todo mundo falando, muito bom",
    ],
  },
  {
    starter: "Bom dia! ☀️ Já tomou café?",
    replies: [
      "Bom dia! Já sim, um cafezão forte pra acordar ☕",
      "Ainda não 😅 acabei de levantar",
      "Tomei sim! Pão com manteiga e café, combo perfeito",
    ],
  },
  {
    starter: "Boa noite! Vai fazer o que amanhã?",
    replies: [
      "Vou trabalhar de manhã e depois quero descansar",
      "Tenho uns compromissos mas à tarde tô livre",
      "Acho que vou sair pra comer algo diferente 🍕",
    ],
  },
  {
    starter: "Que música você tá ouvindo ultimamente?",
    replies: [
      "Tô numa vibe de MPB, muito bom pra relaxar",
      "Rap nacional, sempre! 🎵",
      "Um pouco de tudo, mas pagode tem dominado haha",
    ],
  },
  {
    starter: "Já pensou em viajar esse ano? Pra onde quer ir?",
    replies: [
      "Quero muito ir pro Nordeste, praia é vida! 🏖️",
      "Tô planejando uma trip pra serra, fugir do calor",
      "Se der certo, quero conhecer o Sul do Brasil",
    ],
  },
  {
    starter: "O que você acha desse calor? Tá impossível 🥵",
    replies: [
      "Demais! Não aguento mais, preciso de ar condicionado",
      "Eu gosto haha, melhor que frio",
      "Tá difícil mesmo, só fico dentro de casa",
    ],
  },
  {
    starter: "Ei, tem alguma dica de série boa?",
    replies: [
      "Começa The Bear, é sobre culinária mas é viciante",
      "Se gosta de suspense, tem uma nova que tá ótima",
      "Eu tô reassistindo Breaking Bad pela terceira vez 😂",
    ],
  },
  {
    starter: "Opa, quanto tempo! Como tá a família?",
    replies: [
      "Tudo bem por aqui, graças a Deus! E a sua?",
      "Todos bem! Minha mãe mandou lembranças 😊",
      "De boa! Fim de semana passado fizemos churrasco, foi ótimo",
    ],
  },
  {
    starter: "Cara, preciso de motivação pra treinar hoje 😅",
    replies: [
      "Vai lá! Ninguém se arrependeu de ter treinado",
      "Bota um som e vai! Depois você agradece",
      "Eu também tô com preguiça, mas vou forçar haha",
    ],
  },
];

// Follow-up messages to make conversations longer
const FOLLOW_UPS = [
  "Boa! Concordo total 👍",
  "Haha verdade!",
  "Exatamente isso",
  "Pois é, né? 😂",
  "Demais!",
  "Vou pensar nisso",
  "Faz sentido!",
  "Ah sim, entendi",
  "Show de bola!",
  "Top! 🔥",
  "Valeu pela dica!",
  "Depois a gente conversa mais sobre isso",
  "Boa semana pra você! 🙌",
  "Tmj! Qualquer coisa chama",
  "Abraço! 🤝",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

export interface CrossChatStatus {
  id: string;
  status: "running" | "completed" | "failed" | "stopped";
  currentStep: string;
  conversationsCompleted: number;
  totalConversations: number;
  error?: string;
  log: string[];
  accountCount: number;
  mode: "fixed" | "continuous" | "timed";
  durationMinutes?: number;
  elapsedMinutes?: number;
  stopRequested?: boolean;
}

const activeCrossChats: Map<string, CrossChatStatus> = new Map();

export function getCrossChatStatus(id: string): CrossChatStatus | undefined {
  return activeCrossChats.get(id);
}

export function getAllCrossChatStatuses(): CrossChatStatus[] {
  return Array.from(activeCrossChats.values());
}

export function stopCrossChat(id: string): boolean {
  const status = activeCrossChats.get(id);
  if (!status || status.status !== "running") return false;
  status.stopRequested = true;
  status.log.push("🛑 Parada solicitada pelo usuário...");
  return true;
}

export async function startCrossChat(
  accounts: { sessionString: string; phoneNumber: string }[],
  options: {
    conversationsPerPair?: number;
    maxConversations?: number;
    mode?: "fixed" | "continuous" | "timed";
    durationMinutes?: number;
  } = {}
): Promise<string> {
  if (accounts.length < 2) {
    throw new Error("Precisa de pelo menos 2 contas ativas para conversar entre si.");
  }

  const id = `crosschat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const conversationsPerPair = options.conversationsPerPair ?? 1;
  const mode = options.mode ?? "fixed";

  // Generate all possible pairs
  const pairs: [number, number][] = [];
  for (let i = 0; i < accounts.length; i++) {
    for (let j = i + 1; j < accounts.length; j++) {
      pairs.push([i, j]);
    }
  }

  pairs.sort(() => Math.random() - 0.5);

  const totalPerRound = pairs.length * conversationsPerPair;
  const maxConversations = options.maxConversations ?? totalPerRound;
  const totalConversations = mode === "fixed" ? Math.min(maxConversations, totalPerRound) : 0; // 0 = unlimited

  const status: CrossChatStatus = {
    id,
    status: "running",
    currentStep: "Iniciando conversas entre contas...",
    conversationsCompleted: 0,
    totalConversations,
    log: [],
    accountCount: accounts.length,
    mode,
    durationMinutes: options.durationMinutes,
    elapsedMinutes: 0,
    stopRequested: false,
  };

  activeCrossChats.set(id, status);

  runCrossChat(id, accounts, pairs, conversationsPerPair, mode, options.durationMinutes).catch((err) => {
    const s = activeCrossChats.get(id);
    if (s) {
      s.status = "failed";
      s.error = err instanceof Error ? err.message : String(err);
      s.log.push(`❌ Erro: ${s.error}`);
    }
  });

  return id;
}

async function runCrossChat(
  id: string,
  accounts: { sessionString: string; phoneNumber: string }[],
  pairs: [number, number][],
  conversationsPerPair: number,
  mode: "fixed" | "continuous" | "timed",
  durationMinutes?: number,
) {
  const status = activeCrossChats.get(id)!;
  const startTime = Date.now();
  const log = (msg: string) => {
    status.log.push(msg);
    // Keep log from growing too large in continuous mode
    if (status.log.length > 500) {
      status.log = status.log.slice(-300);
    }
    console.log(`[CrossChat ${id}] ${msg}`);
  };

  const shouldStop = (): boolean => {
    if (status.stopRequested) return true;
    if (mode === "timed" && durationMinutes) {
      const elapsed = (Date.now() - startTime) / 60000;
      status.elapsedMinutes = Math.round(elapsed);
      if (elapsed >= durationMinutes) return true;
    }
    return false;
  };

  // Delay that checks for stop
  const delayWithCheck = async (minMs: number, maxMs: number): Promise<boolean> => {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    const interval = 1000;
    let waited = 0;
    while (waited < ms) {
      if (shouldStop()) return true;
      await new Promise((r) => setTimeout(r, Math.min(interval, ms - waited)));
      waited += interval;
      // Update elapsed
      if (mode === "timed") {
        status.elapsedMinutes = Math.round((Date.now() - startTime) / 60000);
      }
    }
    return shouldStop();
  };

  try {
    log(`🔄 Conectando ${accounts.length} contas...`);

    const clients: { client: any; phone: string; selfPhoneKey: string; selfUserId: string; entities: Map<string, any> }[] = [];
    for (const acc of accounts) {
      try {
        const client = await getClient(acc.sessionString);
        const me = await client.getMe();
        const selfPhoneKey = normalizePhone(acc.phoneNumber);
        const selfUserId = me?.id ? String(me.id) : "";
        clients.push({ client, phone: acc.phoneNumber, selfPhoneKey, selfUserId, entities: new Map() });
        log(`✅ ${acc.phoneNumber} conectada`);
      } catch (err: any) {
        log(`⚠️ Falha ao conectar ${acc.phoneNumber}: ${err.message}`);
      }
    }

    if (clients.length < 2) {
      throw new Error("Menos de 2 contas conectaram com sucesso.");
    }

    log(`📱 ${clients.length} contas prontas para conversar`);

    // Import contacts and map exact peer by imported clientId/userId (prevents sending to self/saved messages)
    log(`📇 Importando contatos e resolvendo peers exatos...`);
    const { Api } = await loadTelegramRuntime();
    for (const client of clients) {
      const otherPhones = clients.filter((c) => c.phone !== client.phone);
      try {
        const contacts = otherPhones.map((other, idx) => {
          const phoneKey = normalizePhone(other.phone);
          return new Api.InputPhoneContact({
            clientId: BigInt(idx + 1),
            phone: `+${phoneKey}`,
            firstName: `Conta${idx + 1}`,
            lastName: "",
          });
        });

        const result = await client.client.invoke(new Api.contacts.ImportContacts({ contacts }));
        const usersById = new Map<string, any>((result.users ?? []).map((u: any) => [String(u.id), u]));

        for (const imported of result.imported ?? []) {
          const targetIndex = Number(imported.clientId) - 1;
          const target = otherPhones[targetIndex];
          if (!target) continue;

          const targetKey = normalizePhone(target.phone);
          const user = usersById.get(String(imported.userId));

          if (!user?.id || user.accessHash === undefined || user.accessHash === null) {
            log(`  ⚠️ ${client.phone}: sem accessHash para +${targetKey}, ignorando`);
            continue;
          }

          if (String(user.id) === client.selfUserId) {
            log(`  ⚠️ ${client.phone}: peer de +${targetKey} resolveu para self, ignorando`);
            continue;
          }

          const peer = new Api.InputPeerUser({ userId: user.id, accessHash: user.accessHash });
          client.entities.set(targetKey, peer);
        }

        log(`  📇 ${client.phone}: ${otherPhones.length} contatos importados, ${client.entities.size} peers válidos`);
      } catch (err: any) {
        log(`  ⚠️ ${client.phone}: falha ao importar contatos: ${err.message}`);
      }
      await randomDelay(1000, 3000);
    }

    // Fallback: try contacts list, still avoiding self
    for (const client of clients) {
      try {
        const contactsResult = await client.client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) }));
        for (const other of clients) {
          if (other.phone === client.phone) continue;
          const otherKey = normalizePhone(other.phone);
          if (client.entities.has(otherKey)) continue;

          const match = (contactsResult.users ?? []).find((u: any) =>
            normalizePhone(u.phone ?? "") === otherKey &&
            String(u.id) !== client.selfUserId &&
            u.accessHash !== undefined &&
            u.accessHash !== null
          );

          if (match) {
            const peer = new Api.InputPeerUser({ userId: match.id, accessHash: match.accessHash });
            client.entities.set(otherKey, peer);
            log(`  📇 ${client.phone}: fallback resolveu +${otherKey}`);
          } else {
            log(`  ⚠️ ${client.phone}: fallback não resolveu +${otherKey}`);
          }
        }
      } catch (err: any) {
        log(`  ⚠️ ${client.phone}: erro no fallback de contatos: ${err.message}`);
      }
    }

    const modeLabel = mode === "continuous" ? "CONTÍNUO" : mode === "timed" ? `TEMPORIZADO (${durationMinutes}min)` : "FIXO";
    log(`⚙️ Modo: ${modeLabel}`);

    let conversationsDone = 0;
    let roundNumber = 0;

    // Loop: fixed runs once, continuous/timed loop until stopped
    while (true) {
      if (shouldStop()) break;

      roundNumber++;
      if (mode !== "fixed") {
        log(`\n🔄 Rodada ${roundNumber} iniciando...`);
      }

      // Shuffle pairs each round
      const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5);

      for (const [i, j] of shuffledPairs) {
        if (shouldStop()) break;
        if (mode === "fixed" && conversationsDone >= status.totalConversations) break;
        if (i >= clients.length || j >= clients.length) continue;

        for (let round = 0; round < conversationsPerPair; round++) {
          if (shouldStop()) break;
          if (mode === "fixed" && conversationsDone >= status.totalConversations) break;

          const sender = clients[i];
          const receiver = clients[j];
          const topic = pickRandom(CONVERSATION_TOPICS);

          // Resolve entities for this pair by normalized phone key
          const receiverKey = normalizePhone(receiver.phone);
          const senderKey = normalizePhone(sender.phone);
          const receiverEntity = sender.entities.get(receiverKey);
          const senderEntity = receiver.entities.get(senderKey);

          if (!receiverEntity || !senderEntity) {
            log(`  ⚠️ Peer não resolvido para par ${sender.phone} ↔ ${receiver.phone}, pulando...`);
            continue;
          }

          const receiverEntityId = String(receiverEntity.userId ?? "");
          const senderEntityId = String(senderEntity.userId ?? "");

          if (!receiverEntityId || !senderEntityId) {
            log(`  ⚠️ Peer inválido (sem userId) para ${sender.phone} ↔ ${receiver.phone}, pulando...`);
            continue;
          }

          if (receiverEntityId === sender.selfUserId || senderEntityId === receiver.selfUserId) {
            log(`  ⚠️ Peer resolveu para self em ${sender.phone} ↔ ${receiver.phone}, bloqueado para evitar Mensagens Salvas`);
            continue;
          }

          log(`  🧭 Roteamento OK: ${sender.phone} → ${receiverEntityId} | ${receiver.phone} → ${senderEntityId}`);

          status.currentStep = `💬 ${sender.phone} → ${receiver.phone}`;
          log(`\n💬 Conversa ${conversationsDone + 1}${mode === "fixed" ? `/${status.totalConversations}` : ""}: ${sender.phone} ↔ ${receiver.phone}`);

          try {
            // Sender sends starter
            const stopped1 = await delayWithCheck(2000, 5000);
            if (stopped1) break;
            log(`  📤 ${sender.phone}: "${topic.starter}"`);
            await sender.client.sendMessage(receiverEntity, { message: topic.starter });

            // Wait for "reading" time
            const stopped2 = await delayWithCheck(5000, 15000);
            if (stopped2) break;

            // Receiver replies
            const reply = pickRandom(topic.replies);
            log(`  📤 ${receiver.phone}: "${reply}"`);
            await receiver.client.sendMessage(senderEntity, { message: reply });

            // Sometimes add follow-ups
            if (Math.random() > 0.5) {
              const stopped3 = await delayWithCheck(4000, 10000);
              if (!stopped3) {
                const followUp = pickRandom(FOLLOW_UPS);
                log(`  📤 ${sender.phone}: "${followUp}"`);
                await sender.client.sendMessage(receiverEntity, { message: followUp });

                if (Math.random() > 0.7) {
                  const stopped4 = await delayWithCheck(3000, 8000);
                  if (!stopped4) {
                    const followUp2 = pickRandom(FOLLOW_UPS);
                    log(`  📤 ${receiver.phone}: "${followUp2}"`);
                    await receiver.client.sendMessage(senderEntity, { message: followUp2 });
                  }
                }
              }
            }

            log(`  ✅ Conversa concluída!`);
          } catch (err: any) {
            log(`  ⚠️ Erro na conversa: ${err.message}`);
          }

          conversationsDone++;
          status.conversationsCompleted = conversationsDone;

          // Delay between conversations (15-45s)
          if (!shouldStop()) {
            const delayMs = Math.floor(Math.random() * (45000 - 15000)) + 15000;
            status.currentStep = `⏳ Aguardando ${Math.round(delayMs / 1000)}s...`;
            log(`⏳ Próxima conversa em ${Math.round(delayMs / 1000)}s...`);
            const stopped = await delayWithCheck(delayMs, delayMs);
            if (stopped) break;
          }
        }
        if (shouldStop()) break;
      }

      // In fixed mode, stop after one pass
      if (mode === "fixed") break;
      if (shouldStop()) break;

      // Between rounds, short pause (30-60s)
      log(`\n⏳ Rodada ${roundNumber} completa. Pausa antes da próxima rodada...`);
      const roundPause = await delayWithCheck(30000, 60000);
      if (roundPause) break;
    }

    if (status.stopRequested) {
      status.status = "stopped";
      status.currentStep = "Parado pelo usuário";
      log(`\n🛑 Conversas paradas pelo usuário após ${conversationsDone} conversas.`);
    } else {
      status.status = "completed";
      status.currentStep = "Conversas concluídas!";
      log(`\n✅ Todas as ${conversationsDone} conversas foram concluídas!`);
    }

    status.conversationsCompleted = conversationsDone;
    log(`💡 As contas agora têm histórico de conversas entre si.`);
  } catch (err: any) {
    status.status = "failed";
    status.error = err.message;
    status.currentStep = "Erro nas conversas";
    log(`❌ Erro fatal: ${err.message}`);
  }
}
