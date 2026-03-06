import { useState } from "react";
import { Users, ArrowRightLeft, AlertCircle, Loader2, ShieldCheck, Link2, Settings2 } from "lucide-react";
import { useDialogs, useStartTransfer } from "@/hooks/use-telegram";
import { useAccountsStore } from "@/store/use-accounts-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

type InputMode = "dialog" | "link";

export function TransferCard() {
  const [sourceMode, setSourceMode] = useState<InputMode>("dialog");
  const [sourceGroupId, setSourceGroupId] = useState("");
  const [sourceLink, setSourceLink] = useState("");
  const [targetMode, setTargetMode] = useState<InputMode>("dialog");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [safeMode, setSafeMode] = useState(true);
  const [recklessMode, setRecklessMode] = useState(false);
  const [ultraMode, setUltraMode] = useState(false);
  const [useMultiAccount, setUseMultiAccount] = useState(false);
  const [excludePrimary, setExcludePrimary] = useState(false);
  const [membersPerAccount, setMembersPerAccount] = useState(10);

  const { data: dialogs, isLoading, error } = useDialogs();
  const transferMutation = useStartTransfer();
  const { toast } = useToast();
  const { accounts } = useAccountsStore();
  const activeAccounts = accounts.filter(a => a.status === 'active');

  const groups = (Array.isArray(dialogs) ? dialogs : []).filter((d: any) => d.isGroup);
  const dialogsErrorMessage = error instanceof Error ? error.message : "Erro ao buscar diálogos.";

  const handleStartTransfer = async () => {
    const effectiveSource = sourceMode === "link" ? sourceLink.trim() : sourceGroupId;
    const effectiveTarget = targetMode === "link" ? targetLink.trim() : targetGroupId;

    if (!effectiveSource || !effectiveTarget) {
      toast({ title: "Seleção incompleta", description: "Selecione origem e destino.", variant: "destructive" });
      return;
    }
    if (sourceMode === "dialog" && targetMode === "dialog" && sourceGroupId === targetGroupId) {
      toast({ title: "Seleção inválida", description: "Origem e destino não podem ser iguais.", variant: "destructive" });
      return;
    }

    try {
      const accountSessions = useMultiAccount && activeAccounts.length > 0
        ? activeAccounts.map(a => a.sessionString)
        : undefined;

      await transferMutation.mutateAsync({
        sourceGroupId: effectiveSource,
        targetGroupId: effectiveTarget,
        safeMode,
        recklessMode,
        ultraMode,
        sourceIsLink: sourceMode === "link",
        targetIsLink: targetMode === "link",
        sessions: accountSessions,
        membersPerAccount: useMultiAccount ? membersPerAccount : undefined,
        excludePrimary: useMultiAccount && excludePrimary,
      });
      toast({ title: "Transferência iniciada!", description: useMultiAccount ? `Rodízio com ${activeAccounts.length} contas.` : "Job enfileirado." });
      setSourceGroupId(""); setSourceLink("");
      setTargetGroupId(""); setTargetLink("");
    } catch (err: any) {
      toast({ title: "Falha ao iniciar", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card p-8 border-primary/10 w-full max-w-2xl mx-auto hud-border">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/3 mb-8 bg-secondary" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Skeleton className="h-4 w-24 bg-secondary" /><Skeleton className="h-12 w-full bg-secondary" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-24 bg-secondary" /><Skeleton className="h-12 w-full bg-secondary" /></div>
          </div>
          <Skeleton className="h-12 w-full mt-4 bg-secondary" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card p-8 border-destructive/20 w-full max-w-2xl mx-auto">
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-display tracking-wider text-sm">FALHA AO CARREGAR GRUPOS</AlertTitle>
          <AlertDescription className="font-mono text-xs">{dialogsErrorMessage}</AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="glass-card p-8 border-primary/10 w-full max-w-2xl mx-auto relative overflow-hidden hud-border">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="flex items-center space-x-3 mb-8">
        <div className="w-12 h-12 bg-primary/5 rounded-md flex items-center justify-center border border-primary/20 neon-glow">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-widest text-foreground uppercase font-display">Transferência</h2>
          <p className="text-muted-foreground text-[10px] font-mono tracking-wider uppercase">Mova usuários entre grupos</p>
        </div>
      </div>

      {/* Source mode toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={sourceMode === "dialog" ? "default" : "outline"}
          size="sm"
          className="font-mono text-[10px] tracking-wider uppercase flex-1"
          onClick={() => setSourceMode("dialog")}
        >
          <Users className="w-3 h-3 mr-1" /> Meus Grupos
        </Button>
        <Button
          variant={sourceMode === "link" ? "default" : "outline"}
          size="sm"
          className="font-mono text-[10px] tracking-wider uppercase flex-1"
          onClick={() => setSourceMode("link")}
        >
          <Link2 className="w-3 h-3 mr-1" /> Via Link
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-end mb-8">
        {/* Source */}
        <div className="space-y-2 relative z-10">
          <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">
            {sourceMode === "link" ? "Link do Grupo" : "Grupo de Origem"}
          </Label>
          {sourceMode === "link" ? (
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
              <Input
                value={sourceLink}
                onChange={(e) => setSourceLink(e.target.value)}
                placeholder="t.me/grupo ou t.me/+abc123"
                className="pl-10 h-14 bg-secondary/50 border-border focus:border-primary/50 font-mono text-xs"
              />
            </div>
          ) : (
            <Select value={sourceGroupId} onValueChange={setSourceGroupId}>
              <SelectTrigger className="h-14 bg-secondary/50 border-border focus:border-primary/50 font-mono text-xs">
                <SelectValue placeholder="Selecionar origem" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {groups.map((group: any) => (
                  <SelectItem key={group.id} value={group.id} className="font-mono text-xs">{group.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="hidden md:flex h-14 w-12 items-center justify-center pb-2">
          <div className="w-10 h-10 rounded-md bg-secondary/50 flex items-center justify-center border border-border">
            <ArrowRightLeft className="w-4 h-4 text-primary/60" />
          </div>
        </div>

        {/* Target */}
        <div className="space-y-2 relative z-10">
          <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">
            {targetMode === "link" ? "Link do Destino" : "Grupo de Destino"}
          </Label>
          <div className="flex gap-1 mb-1">
            <Button variant={targetMode === "dialog" ? "default" : "outline"} size="sm" className="font-mono text-[9px] tracking-wider uppercase h-7 flex-1" onClick={() => setTargetMode("dialog")}>
              <Users className="w-3 h-3 mr-1" /> Grupo
            </Button>
            <Button variant={targetMode === "link" ? "default" : "outline"} size="sm" className="font-mono text-[9px] tracking-wider uppercase h-7 flex-1" onClick={() => setTargetMode("link")}>
              <Link2 className="w-3 h-3 mr-1" /> Link
            </Button>
          </div>
          {targetMode === "link" ? (
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
              <Input
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                placeholder="t.me/grupo ou t.me/+abc123"
                className="pl-10 h-14 bg-secondary/50 border-border focus:border-primary/50 font-mono text-xs"
              />
            </div>
          ) : (
            <Select value={targetGroupId} onValueChange={setTargetGroupId}>
              <SelectTrigger className="h-14 bg-secondary/50 border-border focus:border-primary/50 font-mono text-xs">
                <SelectValue placeholder="Selecionar destino" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {groups.map((group: any) => (
                  <SelectItem key={group.id} value={group.id} className="font-mono text-xs">{group.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Multi-account toggle */}
      <div className={`mb-3 p-4 rounded-md border ${activeAccounts.length === 0 ? 'opacity-30 pointer-events-none' : ''} bg-primary/5 border-primary/20`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
              <Settings2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-foreground uppercase">Rodízio de Contas</p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                {activeAccounts.length} conta{activeAccounts.length !== 1 ? 's' : ''} disponíve{activeAccounts.length !== 1 ? 'is' : 'l'}
              </p>
            </div>
          </div>
          <Switch checked={useMultiAccount} onCheckedChange={setUseMultiAccount} disabled={activeAccounts.length === 0} />
        </div>
        {useMultiAccount && activeAccounts.length > 0 && (
          <div className="mt-4 pl-12 space-y-3">
            {/* Exclude primary toggle */}
            <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border">
              <div>
                <p className="text-[10px] text-foreground font-mono tracking-wider font-bold">EXCLUIR CONTA PRINCIPAL</p>
                <p className="text-[9px] text-muted-foreground font-mono tracking-wider">Usar apenas as contas do rodízio</p>
              </div>
              <Switch checked={excludePrimary} onCheckedChange={setExcludePrimary} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">MEMBROS POR CONTA</p>
              <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">{membersPerAccount}</Badge>
            </div>
            <Slider
              value={[membersPerAccount]}
              onValueChange={([v]) => setMembersPerAccount(v)}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
              <span>1</span>
              <span>50</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {!excludePrimary && (
                <Badge variant="outline" className="text-[9px] font-mono border-accent/30 text-accent/80">
                  Principal (logada)
                </Badge>
              )}
              {activeAccounts.map(a => (
                <Badge key={a.id} variant="outline" className="text-[9px] font-mono border-primary/20 text-primary/80">
                  {a.label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Safe Mode */}
      <div className={`mb-3 p-4 rounded-md border ${recklessMode || ultraMode ? 'opacity-30 pointer-events-none' : ''} bg-primary/5 border-primary/20`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-foreground uppercase">Modo Seguro</p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">Delays longos, limite 50/dia, pausas automáticas</p>
            </div>
          </div>
          <Switch checked={safeMode} onCheckedChange={(v) => { setSafeMode(v); if (v) { setRecklessMode(false); setUltraMode(false); } }} />
        </div>
        {safeMode && (
          <div className="mt-3 text-[10px] text-muted-foreground space-y-1 pl-12 font-mono tracking-wider">
            <p>// INTERVALO 30-60s ALEATÓRIO</p>
            <p>// MAX 50 MEMBROS POR SESSÃO</p>
            <p>// PAUSA 5 MIN A CADA 20</p>
          </div>
        )}
      </div>

      {/* Reckless Mode */}
      <div className={`mb-3 p-4 rounded-md border ${safeMode || ultraMode ? 'opacity-30 pointer-events-none' : ''} bg-destructive/5 border-destructive/20`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-destructive/10 flex items-center justify-center border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-foreground uppercase">Modo Irresponsável</p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">1 membro/segundo — alto risco</p>
            </div>
          </div>
          <Switch checked={recklessMode} onCheckedChange={(v) => { setRecklessMode(v); if (v) { setSafeMode(false); setUltraMode(false); } }} />
        </div>
      </div>

      {/* Ultra Mode */}
      <div className={`mb-6 p-4 rounded-md border ${safeMode || recklessMode ? 'opacity-30 pointer-events-none' : ''} bg-accent/5 border-accent/20`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-accent/10 flex items-center justify-center border border-accent/20">
              <AlertCircle className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-foreground uppercase">Ultra Irresponsável</p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">10 membros/segundo — risco EXTREMO</p>
            </div>
          </div>
          <Switch checked={ultraMode} onCheckedChange={(v) => { setUltraMode(v); if (v) { setSafeMode(false); setRecklessMode(false); } }} />
        </div>
      </div>

      <Button
        onClick={handleStartTransfer}
        disabled={transferMutation.isPending || (!sourceGroupId && !sourceLink.trim()) || (!targetGroupId && !targetLink.trim())}
        className="w-full h-14 font-display text-sm tracking-widest uppercase neon-glow transition-all hover:-translate-y-0.5"
      >
        {transferMutation.isPending ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          useMultiAccount && activeAccounts.length > 0
            ? `INICIAR COM ${activeAccounts.length} CONTAS`
            : ultraMode ? "INICIAR ULTRA" : recklessMode ? "INICIAR IRRESPONSÁVEL" : safeMode ? "INICIAR MODO SEGURO" : "INICIAR TRANSFERÊNCIA"
        )}
      </Button>
    </Card>
  );
}
