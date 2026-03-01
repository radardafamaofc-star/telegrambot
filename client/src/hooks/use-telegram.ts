import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-types";
import { useAuthStore } from "@/store/use-auth-store";
import { useToast } from "@/hooks/use-toast";

// Helper to handle standard fetch responses based on our schema
async function fetchWithSchema(
  path: string, 
  method: string, 
  body: unknown, 
  schema: any
): Promise<any> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  
  if (!res.ok) {
    let errorMsg = "An unexpected error occurred";
    try {
      const errorData = await res.json();
      errorMsg = errorData.message || errorMsg;
    } catch (e) {
      // Ignore parse error
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
      code: string 
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
  const { toast } = useToast();

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
    meta: {
      errorMessage: "Failed to load groups. Your session might have expired."
    }
  });
}

export function useStartTransfer() {
  const { sessionString } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { sourceGroupId: string; targetGroupId: string }) => {
      if (!sessionString) throw new Error("Missing credentials");

      return fetchWithSchema(
        api.tgData.startTransfer.path,
        api.tgData.startTransfer.method,
        { 
          sessionString, 
          sourceGroupId: data.sourceGroupId, 
          targetGroupId: data.targetGroupId 
        },
        api.tgData.startTransfer.responses[200]
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
    }
  });
}

export function useJobs() {
  return useQuery({
    queryKey: [api.jobs.list.path],
    queryFn: async () => {
      const res = await fetch(api.jobs.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      return api.jobs.list.responses[200].parse(data);
    },
    refetchInterval: 3000, // Poll every 3 seconds as requested
  });
}
