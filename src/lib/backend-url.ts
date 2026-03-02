/**
 * Base URL do backend.
 * - Se VITE_BACKEND_URL existir, usa ela.
 * - Caso contrário, usa o mesmo origin do app (/api no próprio servidor).
 */
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "") ?? "";
