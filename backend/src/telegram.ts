type TelegramRuntime = {
  TelegramClient: new (...args: any[]) => any;
  StringSession: new (session: string) => any;
  Api: any;
};

let telegramRuntimePromise: Promise<TelegramRuntime> | null = null;

export async function loadTelegramRuntime(): Promise<TelegramRuntime> {
  if (!telegramRuntimePromise) {
    telegramRuntimePromise = Promise.all([
      import("telegram"),
      import("telegram/sessions"),
    ]).then(([telegramModule, sessionsModule]) => ({
      TelegramClient: telegramModule.TelegramClient as unknown as new (...args: any[]) => any,
      StringSession: sessionsModule.StringSession as unknown as new (session: string) => any,
      Api: telegramModule.Api,
    }));
  }
  return telegramRuntimePromise;
}

const rawApiId = process.env.TELEGRAM_API_ID?.trim() ?? "";
const rawApiHash = process.env.TELEGRAM_API_HASH?.trim() ?? "";

const TELEGRAM_API_ID = Number.parseInt(rawApiId, 10);
const TELEGRAM_API_HASH = rawApiHash;

const apiIdValid = Number.isInteger(TELEGRAM_API_ID) && TELEGRAM_API_ID > 0;
const apiHashValid = TELEGRAM_API_HASH.length > 0;

export const hasTelegramConfig = apiIdValid && apiHashValid;

export function getTelegramConfigStatus() {
  return {
    hasApiId: rawApiId.length > 0,
    apiIdValid,
    hasApiHash: rawApiHash.length > 0,
  };
}

console.log(
  `[Telegram Config] TELEGRAM_API_ID provided=${rawApiId.length > 0} valid=${apiIdValid}, TELEGRAM_API_HASH provided=${rawApiHash.length > 0}`
);

export function getTelegramCredentials() {
  return { apiId: TELEGRAM_API_ID, apiHash: TELEGRAM_API_HASH };
}

const activeClients: Map<string, any> = new Map();
export const pendingAuthClients: Map<string, any> = new Map();

export function clearAllClients() {
  for (const client of activeClients.values()) {
    try { client.disconnect?.(); } catch {}
  }
  activeClients.clear();
  pendingAuthClients.clear();
}

export async function getClient(sessionString: string): Promise<any> {
  if (!hasTelegramConfig) {
    throw new Error("Telegram backend not configured. Missing TELEGRAM_API_ID/TELEGRAM_API_HASH.");
  }

  const normalizedSession = sessionString.trim();
  if (!normalizedSession) {
    throw new Error("Session string is empty.");
  }

  // IMPORTANT: use full session string in cache key to avoid collisions between accounts.
  // Using only a prefix (substring) can make different accounts reuse the same client.
  const cacheKey = `${TELEGRAM_API_ID}-${normalizedSession}`;
  if (activeClients.has(cacheKey)) {
    const client = activeClients.get(cacheKey)!;
    if (client.connected) return client;
  }

  const { TelegramClient, StringSession } = await loadTelegramRuntime();
  const client = new TelegramClient(new StringSession(normalizedSession), TELEGRAM_API_ID, TELEGRAM_API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();
  activeClients.set(cacheKey, client);
  return client;
}
