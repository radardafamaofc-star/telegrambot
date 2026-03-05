import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useKeyStore } from "@/store/use-key-store";

const VALIDATION_INTERVAL = 30_000; // 30 seconds

export function useKeyValidation() {
  const accessKey = useKeyStore((s) => s.accessKey);
  const isKeyValid = useKeyStore((s) => s.isKeyValid);
  const clearKey = useKeyStore((s) => s.clearKey);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!accessKey || !isKeyValid) return;

    const validate = async () => {
      try {
        const { data } = await supabase
          .from("access_keys")
          .select("id, is_active, expires_at")
          .eq("key", accessKey)
          .eq("is_active", true)
          .maybeSingle();

        if (!data) {
          clearKey();
          return;
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          clearKey();
        }
      } catch {
        // Network error — don't disconnect
      }
    };

    validate();
    intervalRef.current = setInterval(validate, VALIDATION_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [accessKey, isKeyValid, clearKey]);
}
