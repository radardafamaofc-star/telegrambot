import { Activity, CheckCircle2, XCircle, Clock, Loader2, AlertCircle, Pause, Play, Square } from "lucide-react";
import { useJobs, useUpdateJobStatus } from "@/hooks/use-telegram";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { EclipseLoader } from "@/components/ui/eclipse-loader";

export function JobsList() {
  const { data: jobs = [], isLoading } = useJobs();
  const updateStatus = useUpdateJobStatus();
  const { toast } = useToast();

  const handleStatusChange = (jobId: number, status: "processing" | "paused" | "stopped") => {
    updateStatus.mutate({ jobId, status }, {
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Falha ao atualizar status";
        toast({ title: "Erro", description: message, variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-8 flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-8 text-center p-12 border border-dashed border-border rounded-md bg-card/30">
        <Activity className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
        <h3 className="text-sm font-display font-bold tracking-widest text-foreground uppercase">Nenhum Job Ativo</h3>
        <p className="text-muted-foreground text-[10px] font-mono mt-2 tracking-wider">
          INICIE UMA TRANSFERÊNCIA PARA VER O PROGRESSO
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 space-y-4">
      <h3 className="text-sm font-display font-bold flex items-center mb-6 tracking-widest uppercase text-primary neon-text">
        <Activity className="w-5 h-5 mr-2" />
        Transferências Recentes
      </h3>

      <div className="space-y-4">
        {jobs.map((job: any) => {
          const total = job.total ?? 0;
          const progress = job.progress ?? 0;
          const progressPercentage = total > 0 ? Math.round((progress / total) * 100) : 0;
          
          let StatusIcon = Clock;
          let badgeClass = "bg-muted/50 text-muted-foreground border-border";
          const isProcessing = job.status === 'processing';

          if (isProcessing) {
            StatusIcon = Loader2;
            badgeClass = "bg-primary/10 text-primary border-primary/30";
          } else if (job.status === 'completed') {
            StatusIcon = CheckCircle2;
            badgeClass = "bg-primary/10 text-primary border-primary/30";
          } else if (job.status === 'failed') {
            StatusIcon = XCircle;
            badgeClass = "bg-destructive/10 text-destructive border-destructive/30";
          } else if (job.status === 'paused') {
            StatusIcon = Pause;
            badgeClass = "bg-accent/10 text-accent border-accent/30";
          } else if (job.status === 'stopped') {
            StatusIcon = Square;
            badgeClass = "bg-muted/50 text-muted-foreground border-border";
          }

          const canPause = job.status === 'processing';
          const canResume = job.status === 'paused';
          const canStop = job.status === 'processing' || job.status === 'paused';

          return (
            <Card key={job.id} className="glass-card p-6 border-border/50 hover:border-primary/20 transition-all overflow-hidden relative hud-border">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              
              {/* Show eclipse loader for active jobs */}
              {(isProcessing || job.status === 'paused') && (
                <div className="flex justify-center mb-6">
                  <EclipseLoader 
                    percentage={progressPercentage} 
                    size={140}
                    label={isProcessing ? "Processando" : "Pausado"}
                  />
                </div>
              )}

              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-md border ${badgeClass}`}>
                    <StatusIcon className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <div className="text-xs font-display font-bold tracking-wider uppercase">JOB #{job.id}</div>
                    <div className="text-[10px] text-muted-foreground font-mono tracking-wider mt-0.5">
                      {job.sourceGroupId.slice(0, 8)}… → {job.targetGroupId.slice(0, 8)}…
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canPause && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(job.id, "paused")}
                      disabled={updateStatus.isPending}
                      className="h-8 px-2 font-mono text-[10px] tracking-wider border-border hover:border-accent/50 hover:text-accent"
                    >
                      <Pause className="w-3.5 h-3.5 mr-1" />
                      PAUSAR
                    </Button>
                  )}
                  {canResume && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(job.id, "processing")}
                      disabled={updateStatus.isPending}
                      className="h-8 px-2 font-mono text-[10px] tracking-wider border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      RETOMAR
                    </Button>
                  )}
                  {canStop && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStatusChange(job.id, "stopped")}
                      disabled={updateStatus.isPending}
                      className="h-8 px-2 font-mono text-[10px] tracking-wider"
                    >
                      <Square className="w-3.5 h-3.5 mr-1" />
                      PARAR
                    </Button>
                  )}
                  <Badge className={`${badgeClass} border px-3 py-1 font-mono text-[10px] tracking-wider uppercase`}>
                    {job.status}
                  </Badge>
                </div>
              </div>

              {/* Text progress for completed/failed */}
              {!isProcessing && job.status !== 'paused' && (
                <div className="flex justify-between text-[10px] font-mono tracking-wider text-muted-foreground">
                  <span>PROGRESSO</span>
                  <span>{progress} / {total || '-'} ({progressPercentage}%)</span>
                </div>
              )}

              {job.error && (
                <div className="mt-4 p-3 bg-destructive/5 rounded-md border border-destructive/20 text-[10px] text-destructive flex items-start font-mono tracking-wider">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                  <span>{job.error}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
