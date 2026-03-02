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

const TELEGRAM_API_ID = Number(process.env.TELEGRAM_API_ID);
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH ?? "";

export const hasTelegramConfig =
  Number.isInteger(TELEGRAM_API_ID) && TELEGRAM_API_ID > 0 && TELEGRAM_API_HASH.length > 0;

export function getTelegramCredentials() {
  return { apiId: TELEGRAM_API_ID, apiHash: TELEGRAM_API_HASH };
}

const activeClients: Map<string, any> = new Map();
export const pendingAuthClients: Map<string, any> = new Map();

export async function getClient(sessionString: string): Promise<any> {
  if (!hasTelegramConfig) {
    throw new Error("Telegram backend not configured. Missing TELEGRAM_API_ID/TELEGRAM_API_HASH.");
  }

  const cacheKey = `${TELEGRAM_API_ID}-${sessionString.substring(0, 20)}`;
  if (activeClients.has(cacheKey)) {
    const client = activeClients.get(cacheKey)!;
    if (client.connected) return client;
  }

  const { TelegramClient, StringSession } = await loadTelegramRuntime();
  const client = new TelegramClient(new StringSession(sessionString), TELEGRAM_API_ID, TELEGRAM_API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();
  activeClients.set(cacheKey, client);
  return client;
}
