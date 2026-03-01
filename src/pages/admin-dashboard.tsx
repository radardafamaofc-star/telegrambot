import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Plus, Loader2, Trash2, ToggleLeft, ToggleRight, Copy, LogOut, KeyRound } from "lucide-react";
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
      toast({ title: "Erro", description: "Adicione um rótulo para a key.", variant: "destructive" });
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
      toast({ title: "Key criada!", description: `Key: ${key}` });
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
      toast({ title: "Key removida" });
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copiada!", description: "Key copiada para a área de transferência." });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Painel Admin</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-primary" />
                Gerenciar Keys
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {keys.length} key{keys.length !== 1 ? "s" : ""} cadastrada{keys.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Key
            </Button>
          </div>

          {showCreate && (
            <Card className="mb-6 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Criar Nova Key</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rótulo</Label>
                    <Input
                      placeholder="Ex: Cliente João"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de expiração (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Criar Key
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">
                  <KeyRound className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma key cadastrada ainda.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rótulo</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expiração</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.label || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {k.key.slice(0, 12)}...
                            </code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyKey(k.key)}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isExpired(k.expires_at) ? (
                            <Badge variant="destructive">Expirada</Badge>
                          ) : k.is_active ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Ativa</Badge>
                          ) : (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {k.expires_at
                            ? new Date(k.expires_at).toLocaleDateString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : "Sem expiração"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleActive(k.id, k.is_active)}
                              title={k.is_active ? "Desativar" : "Ativar"}
                            >
                              {k.is_active ? (
                                <ToggleRight className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteKey(k.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
