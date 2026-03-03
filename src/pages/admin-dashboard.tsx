import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Plus, Loader2, Trash2, Copy, LogOut, KeyRound, Power, PowerOff, Calendar, User, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface AccessKey {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "SK-";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function AdminDashboard() {
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const fetchKeys = async () => {
    const { data, error } = await supabase
      .from("access_keys")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setKeys(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      toast({ title: "Erro", description: "Informe o nome do cliente.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const key = generateKey();
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("access_keys").insert({
      key,
      label: newLabel.trim(),
      expires_at: newExpiry || null,
      created_by: userData.user?.id || null,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Key criada com sucesso!", description: `Chave gerada para ${newLabel.trim()}` });
      setNewLabel("");
      setNewExpiry("");
      setShowCreate(false);
      fetchKeys();
    }
    setCreating(false);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("access_keys")
      .update({ is_active: !currentStatus })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchKeys();
    }
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("access_keys").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchKeys();
      toast({ title: "Key removida com sucesso" });
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copiada!", description: "Chave copiada para a área de transferência." });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const activeCount = keys.filter(k => k.is_active && !isExpired(k.expires_at)).length;
  const expiredCount = keys.filter(k => isExpired(k.expires_at)).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold font-[family-name:var(--font-display)] tracking-wider text-foreground">
                PAINEL ADMIN
              </h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          <div className="glass-card rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-mono)]">{keys.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </div>
          <div className="glass-card rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary font-[family-name:var(--font-mono)]">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Ativas</p>
          </div>
          <div className="glass-card rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-destructive font-[family-name:var(--font-mono)]">{expiredCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Expiradas</p>
          </div>
        </motion.div>

        {/* Title + Action */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)] tracking-wide">
              GERENCIAR KEYS
            </h2>
          </div>
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="neon-glow"
            size="sm"
          >
            {showCreate ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showCreate ? "Cancelar" : "Nova Key"}
          </Button>
        </motion.div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Card className="mb-5 glass-card border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-[family-name:var(--font-display)] tracking-wide flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    NOVA CHAVE DE ACESSO
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        Nome do Cliente
                      </Label>
                      <Input
                        placeholder="Ex: João Silva"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Expiração (opcional)
                      </Label>
                      <Input
                        type="datetime-local"
                        value={newExpiry}
                        onChange={(e) => setNewExpiry(e.target.value)}
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreate} disabled={creating} className="w-full neon-glow">
                    {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Gerar Chave
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keys Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center p-16 text-muted-foreground">
                  <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma key cadastrada.</p>
                  <p className="text-xs mt-1 opacity-60">Clique em "Nova Key" para começar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-display)]">Cliente</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-display)]">Chave</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-display)]">Status</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-display)]">Expiração</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-[family-name:var(--font-display)] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keys.map((k, i) => (
                        <motion.tr
                          key={k.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-border/20 hover:bg-primary/5 transition-colors"
                        >
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <User className="w-3.5 h-3.5 text-primary" />
                              </div>
                              {k.label || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <code className="text-xs bg-background/80 px-2 py-1 rounded font-[family-name:var(--font-mono)] text-muted-foreground border border-border/30">
                                {k.key.slice(0, 14)}...
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => copyKey(k.key)}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired(k.expires_at) ? (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Expirada</Badge>
                            ) : k.is_active ? (
                              <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] px-2 py-0.5">Ativa</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Inativa</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-[family-name:var(--font-mono)]">
                            {k.expires_at
                              ? new Date(k.expires_at).toLocaleDateString("pt-BR", {
                                  day: "2-digit", month: "2-digit", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "∞ Sem limite"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${k.is_active ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"}`}
                                onClick={() => toggleActive(k.id, k.is_active)}
                                title={k.is_active ? "Desativar" : "Ativar"}
                              >
                                {k.is_active ? (
                                  <Power className="w-4 h-4" />
                                ) : (
                                  <PowerOff className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteKey(k.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
