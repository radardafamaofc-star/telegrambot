/**
 * Base URL for the external Telegram backend (Railway).
 */
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "") ?? "https://telegrambot-production-ce84.up.railway.app";
