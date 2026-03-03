import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, Loader2, Trash2, Copy, LogOut, KeyRound,
  Power, PowerOff, User, X, Search, Clock, Calendar as CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

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
  const [durationPreset, setDurationPreset] = useState<string>("lifetime");
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      toast({ title: "Erro", description: "Informe o nome do cliente.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const key = generateKey();
    const { data: userData } = await supabase.auth.getUser();

    let expiresAt: string | null = null;
    if (durationPreset === "custom" && customDate) {
      expiresAt = customDate.toISOString();
    } else if (durationPreset !== "lifetime" && durationPreset !== "custom") {
      const now = new Date();
      const durations: Record<string, number> = {
        daily: 1,
        weekly: 7,
        monthly: 30,
        yearly: 365,
      };
      const days = durations[durationPreset];
      if (days) {
        now.setDate(now.getDate() + days);
        expiresAt = now.toISOString();
      }
    }

    const { error } = await supabase.from("access_keys").insert({
      key,
      label: newLabel.trim(),
      expires_at: expiresAt,
      created_by: userData.user?.id || null,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Key criada!", description: `Chave gerada para ${newLabel.trim()}` });
      setNewLabel("");
      setDurationPreset("lifetime");
      setCustomDate(undefined);
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
    if (!error) fetchKeys();
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("access_keys").delete().eq("id", id);
    if (!error) {
      fetchKeys();
      toast({ title: "Key removida" });
    }
    setConfirmDelete(null);
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
  const inactiveCount = keys.filter(k => !k.is_active && !isExpired(k.expires_at)).length;

  const filtered = keys.filter(k =>
    k.label.toLowerCase().includes(search.toLowerCase()) ||
    k.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center neon-glow">
              <Shield className="w-4.5 h-4.5 text-primary" />
            </div>
            <h1 className="text-base font-bold font-[family-name:var(--font-display)] tracking-widest text-foreground">
              PAINEL ADMIN
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: keys.length, color: "text-foreground" },
            { label: "Ativas", value: activeCount, color: "text-primary" },
            { label: "Inativas", value: inactiveCount, color: "text-muted-foreground" },
            { label: "Expiradas", value: expiredCount, color: "text-destructive" },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-4 text-center hud-border">
              <p className={`text-3xl font-bold font-[family-name:var(--font-mono)] ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider font-[family-name:var(--font-display)]">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Toolbar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)] tracking-wide">CHAVES DE ACESSO</h2>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 w-full sm:w-52 bg-background/50 border-border/40 text-sm"
              />
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} size="sm" className={showCreate ? "bg-muted text-foreground hover:bg-muted/80" : "neon-glow"}>
              {showCreate ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {showCreate ? "Fechar" : "Nova Key"}
            </Button>
          </div>
        </motion.div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.98 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <Card className="glass-card border-primary/20 hud-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-[family-name:var(--font-display)] tracking-widest flex items-center gap-2 text-primary">
                    <Plus className="w-4 h-4" />
                    NOVA CHAVE DE ACESSO
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Cliente */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 font-[family-name:var(--font-display)]">
                        <User className="w-3.5 h-3.5" />
                        Nome do Cliente
                      </Label>
                      <Input
                        placeholder="Ex: João Silva"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="bg-background/50 border-border/40"
                      />
                    </div>

                    {/* Duração */}
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 font-[family-name:var(--font-display)]">
                        <Clock className="w-3.5 h-3.5" />
                        Duração do Acesso
                      </Label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[
                          { id: "daily", label: "Diário" },
                          { id: "weekly", label: "Semanal" },
                          { id: "monthly", label: "Mensal" },
                          { id: "yearly", label: "Anual" },
                          { id: "lifetime", label: "Vitalício" },
                          { id: "custom", label: "Personalizar" },
                        ].map((opt) => (
                          <Button
                            key={opt.id}
                            type="button"
                            variant={durationPreset === opt.id ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "text-xs font-[family-name:var(--font-display)] tracking-wider transition-all",
                              durationPreset === opt.id
                                ? "neon-glow"
                                : "bg-background/50 border-border/40 text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => {
                              setDurationPreset(opt.id);
                              if (opt.id !== "custom") setCustomDate(undefined);
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                      {durationPreset === "custom" && (
                        <div className="mt-3">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full sm:w-64 justify-start text-left font-normal bg-background/50 border-border/40",
                                  !customDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {customDate ? format(customDate, "dd/MM/yyyy", { locale: ptBR }) : "Escolha uma data"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={customDate}
                                onSelect={setCustomDate}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button onClick={handleCreate} disabled={creating} className="w-full neon-glow font-[family-name:var(--font-display)] tracking-wider">
                    {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    GERAR CHAVE
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center p-20 text-muted-foreground">
                  <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{search ? "Nenhum resultado encontrado." : "Nenhuma key cadastrada."}</p>
                  {!search && <p className="text-xs mt-1 opacity-60">Clique em "Nova Key" para começar.</p>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/20 hover:bg-transparent">
                        {["Cliente", "Chave", "Status", "Criada em", "Expiração", "Ações"].map((h) => (
                          <TableHead key={h} className={cn(
                            "text-[10px] uppercase tracking-widest text-muted-foreground font-[family-name:var(--font-display)]",
                            h === "Ações" && "text-right"
                          )}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((k, i) => (
                        <motion.tr
                          key={k.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-border/10 hover:bg-primary/5 transition-colors group"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <span className="font-medium text-sm">{k.label || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <code className="text-[11px] bg-background/80 px-2.5 py-1 rounded-md font-[family-name:var(--font-mono)] text-muted-foreground border border-border/20">
                                {k.key.slice(0, 10)}····
                              </code>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary" onClick={() => copyKey(k.key)}>
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired(k.expires_at) ? (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-[family-name:var(--font-display)]">EXPIRADA</Badge>
                            ) : k.is_active ? (
                              <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-2 py-0.5 font-[family-name:var(--font-display)]">ATIVA</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-[family-name:var(--font-display)]">INATIVA</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground font-[family-name:var(--font-mono)]">
                            {new Date(k.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground font-[family-name:var(--font-mono)]">
                            {k.expires_at
                              ? new Date(k.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                              : "∞"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost" size="icon"
                                className={cn("h-8 w-8 transition-colors", k.is_active ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-foreground")}
                                onClick={() => toggleActive(k.id, k.is_active)}
                                title={k.is_active ? "Desativar" : "Ativar"}
                              >
                                {k.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                              </Button>
                              {confirmDelete === k.id ? (
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="destructive" className="h-8 text-[11px] px-2" onClick={() => deleteKey(k.id)}>
                                    Confirmar
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 text-[11px] px-2" onClick={() => setConfirmDelete(null)}>
                                    Não
                                  </Button>
                                </div>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(k.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
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
