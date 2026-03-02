/**
 * Base URL for the external Telegram backend (Railway, Render, VPS, etc.)
 * Set VITE_BACKEND_URL in your environment or .env file.
 * Falls back to current origin for local dev with Express.
 */
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "") ?? "";
