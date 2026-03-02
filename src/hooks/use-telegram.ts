import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-types";
import { BACKEND_URL } from "@/lib/backend-url";
import { useAuthStore } from "@/store/use-auth-store";

/** Build a full URL by prepending the external backend base */
function fullUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

async function fetchWithSchema(
  path: string,
  method: string,
  body: unknown,
  schema: any
): Promise<any> {
  const res = await fetch(fullUrl(path), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errorMsg = "An unexpected error occurred";
    try {
      const errorData = await res.json();
      errorMsg = errorData.message || errorMsg;
    } catch (_e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return schema.parse(data);
}

export function useSendCode() {
  return useMutation({
    mutationFn: async (data: { phoneNumber: string }) => {
      return fetchWithSchema(
        api.tgAuth.sendCode.path,
        api.tgAuth.sendCode.method,
        data,
        api.tgAuth.sendCode.responses[200]
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
        api.tgAuth.login.responses[200]
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

      return fetchWithSchema(
        api.tgData.dialogs.path,
        api.tgData.dialogs.method,
        { sessionString },
        api.tgData.dialogs.responses[200]
      );
    },
    enabled: isAuthenticated,
  });
}

export function useStartTransfer() {
  const { sessionString } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { sourceGroupId: string; targetGroupId: string; safeMode?: boolean; recklessMode?: boolean; ultraMode?: boolean }) => {
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
        api.tgData.startTransfer.responses[200]
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
      const res = await fetch(fullUrl(api.jobs.list.path));
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      return api.jobs.list.responses[200].parse(data);
    },
    refetchInterval: 3000,
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: "processing" | "paused" | "stopped" }) => {
      const path = `/api/jobs/${jobId}/status`;
      const res = await fetch(fullUrl(path), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to update job" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
    },
  });
}
