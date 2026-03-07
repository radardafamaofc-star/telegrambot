import { useMutation, useQuery } from "@tanstack/react-query";
import { BACKEND_URL } from "@/lib/backend-url";

function buildUrl(path: string): string {
  if (!BACKEND_URL) return path;
  const base = BACKEND_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

export function useStartWarmup() {
  return useMutation({
    mutationFn: async (data: {
      sessionString: string;
      phoneNumber: string;
      joinGroups?: string[];
      sendMessages?: boolean;
      updateProfile?: boolean;
    }) => {
      const res = await fetch(buildUrl("/api/tg/warmup/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(err.message || "Failed to start warmup");
      }
      return res.json() as Promise<{ warmupId: string }>;
    },
  });
}

export function useWarmupStatus(warmupId: string | null) {
  return useQuery({
    queryKey: ["warmup", warmupId],
    queryFn: async () => {
      const res = await fetch(buildUrl(`/api/tg/warmup/${warmupId}`));
      if (!res.ok) throw new Error("Failed to fetch warmup status");
      return res.json() as Promise<{
        id: string;
        sessionPhone: string;
        status: "running" | "completed" | "failed";
        currentStep: string;
        stepsCompleted: number;
        totalSteps: number;
        error?: string;
        log: string[];
      }>;
    },
    enabled: !!warmupId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "running") return 2000;
      return false;
    },
  });
}
