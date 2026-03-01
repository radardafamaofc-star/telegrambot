import { z } from "zod";

// Client-safe types (no drizzle dependency)
export interface TransferJob {
  id: number;
  sessionId: number | null;
  sourceGroupId: string;
  targetGroupId: string;
  status: string;
  progress: number | null;
  total: number | null;
  error: string | null;
  createdAt: string | null;
}

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  badRequest: z.object({ message: z.string() }),
};

export const api = {
  tgAuth: {
    sendCode: {
      method: "POST" as const,
      path: "/api/tg/auth/sendCode" as const,
      input: z.object({ phoneNumber: z.string() }),
      responses: {
        200: z.object({ phoneCodeHash: z.string() }),
        400: errorSchemas.badRequest,
      },
    },
    login: {
      method: "POST" as const,
      path: "/api/tg/auth/login" as const,
      input: z.object({
        phoneNumber: z.string(),
        phoneCodeHash: z.string(),
        code: z.string(),
      }),
      responses: {
        200: z.object({ sessionString: z.string() }),
        400: errorSchemas.badRequest,
      },
    },
  },
  tgData: {
    dialogs: {
      method: "POST" as const,
      path: "/api/tg/dialogs" as const,
      input: z.object({ sessionString: z.string() }),
      responses: {
        200: z.array(z.object({
          id: z.string(),
          title: z.string(),
          isGroup: z.boolean(),
        })),
        400: errorSchemas.badRequest,
      },
    },
    startTransfer: {
      method: "POST" as const,
      path: "/api/tg/transfer" as const,
      input: z.object({
        sessionString: z.string(),
        sourceGroupId: z.string(),
        targetGroupId: z.string(),
      }),
      responses: {
        200: z.any(),
        400: errorSchemas.badRequest,
      },
    },
  },
  jobs: {
    list: {
      method: "GET" as const,
      path: "/api/jobs" as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    updateStatus: {
      method: "PATCH" as const,
      path: "/api/jobs/:id/status" as const,
      input: z.object({
        status: z.enum(["processing", "paused", "stopped"]),
      }),
      responses: {
        200: z.any(),
        400: errorSchemas.badRequest,
      },
    },
  },
};
