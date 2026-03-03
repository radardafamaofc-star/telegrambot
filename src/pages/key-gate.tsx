import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useKeyStore } from "@/store/use-key-store";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function KeyGate() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAccessKey } = useKeyStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("access_keys")
        .select("id, key, is_active, expires_at")
        .eq("key", key.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({ title: "Key inválida", description: "Essa key não existe ou está desativada.", variant: "destructive" });
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast({ title: "Key expirada", description: "Essa key já expirou.", variant: "destructive" });
        return;
      }

      setAccessKey(data.key);
      toast({ title: "Acesso liberado!", description: "Bem-vindo à plataforma." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao validar key.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md border-border/50 shadow-xl glass-card hud-border">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4">
              <img src={logoImg} alt="TeleTransfer" className="w-16 h-16 rounded-xl mx-auto" />
            </div>
            <CardTitle className="text-2xl font-bold font-[family-name:var(--font-display)] tracking-widest">TeleTransfer</CardTitle>
            <CardDescription>Digite sua key de acesso para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="Digite sua access key..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="text-center font-mono tracking-wider"
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={loading || !key.trim()}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Acessar
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Não tem uma key? Entre em contato com o administrador.
        </p>
      </motion.div>
    </div>
  );
}
