import { useState } from "react";
import { Users, ArrowRightLeft, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useDialogs, useStartTransfer } from "@/hooks/use-telegram";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export function TransferCard() {
  const [sourceGroupId, setSourceGroupId] = useState<string>("");
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [safeMode, setSafeMode] = useState<boolean>(true);
  const [recklessMode, setRecklessMode] = useState<boolean>(false);
  const [ultraMode, setUltraMode] = useState<boolean>(false);
  
  const { data: dialogs, isLoading, error } = useDialogs();
  const transferMutation = useStartTransfer();
  const { toast } = useToast();

  const groups = (Array.isArray(dialogs) ? dialogs : []).filter((d: any) => d.isGroup);
  const dialogsErrorMessage =
    error instanceof Error
      ? error.message
      : "Erro ao buscar diálogos. Sessão pode ter expirado.";

  const handleStartTransfer = async () => {
    if (!sourceGroupId || !targetGroupId) {
      toast({ title: "Seleção incompleta", description: "Selecione origem e destino.", variant: "destructive" });
      return;
    }
    if (sourceGroupId === targetGroupId) {
      toast({ title: "Seleção inválida", description: "Origem e destino não podem ser iguais.", variant: "destructive" });
      return;
    }
    try {
      await transferMutation.mutateAsync({ sourceGroupId, targetGroupId, safeMode, recklessMode, ultraMode });
      toast({ title: "Transferência iniciada!", description: "Job enfileirado para processamento." });
      setSourceGroupId("");
      setTargetGroupId("");
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
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/3 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-12 h-12 bg-primary/5 rounded-md flex items-center justify-center border border-primary/20 neon-glow">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-widest text-foreground uppercase font-display">Transferência</h2>
          <p className="text-muted-foreground text-[10px] font-mono tracking-wider uppercase">Mova usuários entre grupos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-end mb-8">
        <div className="space-y-2 relative z-10">
          <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">Grupo de Origem</Label>
          <Select value={sourceGroupId} onValueChange={setSourceGroupId}>
            <SelectTrigger className="h-14 bg-secondary/50 border-border focus:border-primary/50 font-mono text-xs">
              <SelectValue placeholder="Selecionar origem" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {groups.map((group: any) => (
                <SelectItem key={group.id} value={group.id} className="font-mono text-xs">
                  {group.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden md:flex h-14 w-12 items-center justify-center pb-2">
          <div className="w-10 h-10 rounded-md bg-secondary/50 flex items-center justify-center border border-border">
            <ArrowRightLeft className="w-4 h-4 text-primary/60" />
          </div>
        </div>

        <div className="space-y-2 relative z-10">
          <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">Grupo de Destino</Label>
          <Select value={targetGroupId} onValueChange={setTargetGroupId}>
            <SelectTrigger className="h-14 bg-secondary/50 border-border focus:border-primary/50 font-mono text-xs">
              <SelectValue placeholder="Selecionar destino" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {groups.map((group: any) => (
                <SelectItem key={group.id} value={group.id} className="font-mono text-xs">
                  {group.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                Delays longos, limite 50/dia, pausas automáticas
              </p>
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
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                1 membro/segundo — alto risco
              </p>
            </div>
          </div>
          <Switch checked={recklessMode} onCheckedChange={(v) => { setRecklessMode(v); if (v) { setSafeMode(false); setUltraMode(false); } }} />
        </div>
        {recklessMode && (
          <div className="mt-3 text-[10px] text-destructive/80 space-y-1 pl-12 font-mono tracking-wider">
            <p>// INTERVALO ~1s</p>
            <p>// SEM LIMITE DE MEMBROS</p>
            <p>// RISCO DE BANIMENTO</p>
          </div>
        )}
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
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                10 membros/segundo — risco EXTREMO
              </p>
            </div>
          </div>
          <Switch checked={ultraMode} onCheckedChange={(v) => { setUltraMode(v); if (v) { setSafeMode(false); setRecklessMode(false); } }} />
        </div>
        {ultraMode && (
          <div className="mt-3 text-[10px] text-accent/80 space-y-1 pl-12 font-mono tracking-wider">
            <p>// INTERVALO ~100ms</p>
            <p>// SEM LIMITE DE MEMBROS</p>
            <p>// BANIMENTO QUASE CERTO</p>
          </div>
        )}
      </div>

      <Button 
        onClick={handleStartTransfer}
        disabled={transferMutation.isPending || !sourceGroupId || !targetGroupId}
        className="w-full h-14 font-display text-sm tracking-widest uppercase neon-glow transition-all hover:-translate-y-0.5"
      >
        {transferMutation.isPending ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          ultraMode ? "INICIAR ULTRA" : recklessMode ? "INICIAR IRRESPONSÁVEL" : safeMode ? "INICIAR MODO SEGURO" : "INICIAR TRANSFERÊNCIA"
        )}
      </Button>
    </Card>
  );
}
