import { z } from "zod";
import { insertSessionSchema, insertTransferJobSchema, sessions, transferJobs } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  badRequest: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  tgAuth: {
    sendCode: {
      method: "POST" as const,
      path: "/api/tg/auth/sendCode" as const,
      input: z.object({
        phoneNumber: z.string(),
      }),
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
      method: "POST" as const, // POST to send session string safely
      path: "/api/tg/dialogs" as const,
      input: z.object({
        sessionString: z.string(),
      }),
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
        delaySeconds: z.number().min(5).max(300).optional(),
        safeMode: z.boolean().optional().default(false),
        recklessMode: z.boolean().optional().default(false),
      }),
      responses: {
        200: z.custom<typeof transferJobs.$inferSelect>(),
        400: errorSchemas.badRequest,
      },
    },
    updateJobStatus: {
      method: "PATCH" as const,
      path: "/api/jobs/:id/status" as const,
      input: z.object({
        status: z.enum(["processing", "paused", "stopped"]),
      }),
      responses: {
        200: z.custom<typeof transferJobs.$inferSelect>(),
        400: errorSchemas.badRequest,
      },
    },
  },
  jobs: {
    list: {
      method: "GET" as const,
      path: "/api/jobs" as const,
      responses: {
        200: z.array(z.custom<typeof transferJobs.$inferSelect>()),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
