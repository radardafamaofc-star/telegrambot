/**
 * Base URL do backend.
 * Aponta para o Railway backend externo.
 */
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "") ||
  "https://telegrambot-production-ce84.up.railway.app";
