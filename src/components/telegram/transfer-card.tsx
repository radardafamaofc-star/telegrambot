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
  
  const { data: dialogs, isLoading, error } = useDialogs();
  const transferMutation = useStartTransfer();
  const { toast } = useToast();

  const groups = (Array.isArray(dialogs) ? dialogs : []).filter((d: any) => d.isGroup);

  const handleStartTransfer = async () => {
    if (!sourceGroupId || !targetGroupId) {
      toast({
        title: "Selection missing",
        description: "Please select both a source and a target group.",
        variant: "destructive",
      });
      return;
    }

    if (sourceGroupId === targetGroupId) {
      toast({
        title: "Invalid selection",
        description: "Source and target groups cannot be the same.",
        variant: "destructive",
      });
      return;
    }

    try {
      await transferMutation.mutateAsync({ sourceGroupId, targetGroupId, safeMode });
      toast({
        title: "Transfer Started!",
        description: "The job has been queued and will process in the background.",
      });
      // Reset selections
      setSourceGroupId("");
      setTargetGroupId("");
    } catch (err: any) {
      toast({
        title: "Transfer failed to start",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card p-8 border-none shadow-xl w-full max-w-2xl mx-auto">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/3 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-full" /></div>
          </div>
          <Skeleton className="h-12 w-full mt-4" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card p-8 border-none shadow-xl w-full max-w-2xl mx-auto">
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load groups</AlertTitle>
          <AlertDescription>
            There was an error fetching your Telegram dialogs. Your session may have expired.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="glass-card p-8 border-none shadow-2xl shadow-primary/5 w-full max-w-2xl mx-auto relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Member Transfer</h2>
          <p className="text-muted-foreground text-sm">Move users from one group to another</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-end mb-8">
        <div className="space-y-2 relative z-10">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source Group</Label>
          <Select value={sourceGroupId} onValueChange={setSourceGroupId}>
            <SelectTrigger className="h-14 bg-background/50 focus:ring-primary/20">
              <SelectValue placeholder="Select origin group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group: any) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden md:flex h-14 w-12 items-center justify-center pb-2">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border">
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2 relative z-10">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destination Group</Label>
          <Select value={targetGroupId} onValueChange={setTargetGroupId}>
            <SelectTrigger className="h-14 bg-background/50 focus:ring-primary/20">
              <SelectValue placeholder="Select target group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group: any) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Safe Mode Toggle */}
      <div className="mb-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Transferência Segura</p>
              <p className="text-xs text-muted-foreground">
                Delays longos, limite de 50/dia e pausas automáticas para evitar banimento
              </p>
            </div>
          </div>
          <Switch checked={safeMode} onCheckedChange={setSafeMode} />
        </div>
        {safeMode && (
          <div className="mt-3 text-xs text-muted-foreground space-y-1 pl-[52px]">
            <p>• Intervalo de 30-60s entre cada adição (aleatório)</p>
            <p>• Máximo de 50 membros por sessão</p>
            <p>• Pausa automática de 5 min a cada 20 membros</p>
          </div>
        )}
      </div>

      <Button 
        onClick={handleStartTransfer}
        disabled={transferMutation.isPending || !sourceGroupId || !targetGroupId}
        className="w-full h-14 text-lg font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
      >
        {transferMutation.isPending ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          safeMode ? "Iniciar Transferência Segura" : "Start Extraction & Transfer"
        )}
      </Button>
    </Card>
  );
}
