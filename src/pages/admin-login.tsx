import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, LogIn, Lock, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      navigate("/admin");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <Card className="glass-card border-primary/15 hud-border">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center neon-glow">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl font-[family-name:var(--font-display)] tracking-widest">
              ADMIN
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Acesso restrito ao painel de gerenciamento
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 font-[family-name:var(--font-display)]">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </Label>
                <Input
                  type="email"
                  placeholder="admin@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50 border-border/40"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 font-[family-name:var(--font-display)]">
                  <Lock className="w-3.5 h-3.5" />
                  Senha
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50 border-border/40"
                />
              </div>
              <Button type="submit" className="w-full neon-glow font-[family-name:var(--font-display)] tracking-wider" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                ENTRAR
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
