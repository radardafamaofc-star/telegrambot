import { useMutation, useQuery } from "@tanstack/react-query";
import { BACKEND_URL } from "@/lib/backend-url";

function buildUrl(path: string): string {
  if (!BACKEND_URL) return path;
  const base = BACKEND_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

export function useStartCrossChat() {
  return useMutation({
    mutationFn: async (data: {
      accounts: { sessionString: string; phoneNumber: string }[];
      conversationsPerPair?: number;
      maxConversations?: number;
      mode?: "fixed" | "continuous" | "timed";
      durationMinutes?: number;
    }) => {
      const res = await fetch(buildUrl("/api/tg/crosschat/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(err.message || "Failed to start cross-chat");
      }
      return res.json() as Promise<{ chatId: string }>;
    },
  });
}

export function useStopCrossChat() {
  return useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch(buildUrl(`/api/tg/crosschat/${chatId}/stop`), {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(err.message || "Failed to stop cross-chat");
      }
      return res.json();
    },
  });
}

export function useCrossChatStatus(chatId: string | null) {
  return useQuery({
    queryKey: ["crosschat", chatId],
    queryFn: async () => {
      const res = await fetch(buildUrl(`/api/tg/crosschat/${chatId}`));
      if (!res.ok) throw new Error("Failed to fetch cross-chat status");
      return res.json() as Promise<{
        id: string;
        status: "running" | "completed" | "failed" | "stopped";
        currentStep: string;
        conversationsCompleted: number;
        totalConversations: number;
        error?: string;
        log: string[];
        accountCount: number;
        mode: "fixed" | "continuous" | "timed";
        durationMinutes?: number;
        elapsedMinutes?: number;
      }>;
    },
    enabled: !!chatId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "running") return 2000;
      return false;
    },
  });
}
