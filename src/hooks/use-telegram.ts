import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-types";
import { BACKEND_URL } from "@/lib/backend-url";
import { useAuthStore } from "@/store/use-auth-store";

/** Build a full URL by prepending the external backend base */
function fullUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

function shouldRetryOnFallback(status: number, isJson: boolean): boolean {
  return !isJson || status === 404 || status >= 500;
}

async function fetchWithSchema(
  path: string,
  method: string,
  body: unknown,
  schema: any,
): Promise<any> {
  const urls = BACKEND_URL ? [fullUrl(path), path] : [fullUrl(path)];
  let lastError: Error | null = null;

  for (let index = 0; index < urls.length; index++) {
    const url = urls[index];

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");

      if (!res.ok) {
        let errorMsg = "An unexpected error occurred";

        if (isJson) {
          try {
            const errorData = await res.json();
            errorMsg = errorData.message || errorMsg;
          } catch {
            // ignore parsing errors
          }
        }

        const canFallback = index === 0 && urls.length > 1 && shouldRetryOnFallback(res.status, isJson);
        if (canFallback) continue;

        throw new Error(errorMsg);
      }

      if (!isJson) {
        const canFallback = index === 0 && urls.length > 1;
        if (canFallback) continue;

        throw new Error("Invalid backend response");
      }

      const data = await res.json();
      return schema.parse(data);
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error("Request failed");
      lastError = resolvedError;

      const isNetworkError = /failed to fetch|network|cors|load failed/i.test(
        resolvedError.message,
      );
      const canFallback = index === 0 && urls.length > 1 && isNetworkError;
      if (canFallback) continue;

      throw resolvedError;
    }
  }

  throw lastError ?? new Error("An unexpected error occurred");
}

export function useSendCode() {
  return useMutation({
    mutationFn: async (data: { phoneNumber: string }) => {
      return fetchWithSchema(
        api.tgAuth.sendCode.path,
        api.tgAuth.sendCode.method,
        data,
        api.tgAuth.sendCode.responses[200],
      );
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: {
      phoneNumber: string;
      phoneCodeHash: string;
      code: string;
    }) => {
      return fetchWithSchema(
        api.tgAuth.login.path,
        api.tgAuth.login.method,
        data,
        api.tgAuth.login.responses[200],
      );
    },
  });
}

export function useDialogs() {
  const { sessionString, isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: [api.tgData.dialogs.path],
    queryFn: async () => {
      if (!sessionString) throw new Error("Missing credentials");

      try {
        return await fetchWithSchema(
          api.tgData.dialogs.path,
          api.tgData.dialogs.method,
          { sessionString },
          api.tgData.dialogs.responses[200],
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch dialogs";

        if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|SESSION_EXPIRED|AUTH_KEY_INVALID|session/i.test(message)) {
          useAuthStore.getState().logout();
          throw new Error("Sua sessão do Telegram expirou. Faça login novamente.");
        }

        throw error;
      }
    },
    enabled: isAuthenticated,
    retry: false,
  });
}

export function useStartTransfer() {
  const { sessionString } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sourceGroupId: string;
      targetGroupId: string;
      safeMode?: boolean;
      recklessMode?: boolean;
      ultraMode?: boolean;
    }) => {
      if (!sessionString) throw new Error("Missing credentials");

      return fetchWithSchema(
        api.tgData.startTransfer.path,
        api.tgData.startTransfer.method,
        {
          sessionString,
          sourceGroupId: data.sourceGroupId,
          targetGroupId: data.targetGroupId,
          safeMode: data.safeMode ?? false,
          recklessMode: data.recklessMode ?? false,
          ultraMode: data.ultraMode ?? false,
        },
        api.tgData.startTransfer.responses[200],
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
    },
  });
}

export function useJobs() {
  return useQuery({
    queryKey: [api.jobs.list.path],
    queryFn: async () => {
      return fetchWithSchema(
        api.jobs.list.path,
        api.jobs.list.method,
        undefined,
        api.jobs.list.responses[200],
      );
    },
    refetchInterval: 3000,
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      status,
    }: {
      jobId: number;
      status: "processing" | "paused" | "stopped";
    }) => {
      const path = `/api/jobs/${jobId}/status`;

      return fetchWithSchema(path, "PATCH", { status }, api.tgData.updateJobStatus.responses[200]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
    },
  });
}

