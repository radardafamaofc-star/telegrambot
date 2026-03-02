import { Activity, CheckCircle2, XCircle, Clock, Loader2, AlertCircle, Pause, Play, Square } from "lucide-react";
import { useJobs, useUpdateJobStatus } from "@/hooks/use-telegram";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function JobsList() {
  const { data: jobs = [], isLoading } = useJobs();
  const updateStatus = useUpdateJobStatus();
  const { toast } = useToast();

  const handleStatusChange = (jobId: number, status: "processing" | "paused" | "stopped") => {
    updateStatus.mutate({ jobId, status }, {
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to update job status";
        toast({ title: "Error", description: message, variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-8 flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-8 text-center p-12 border border-dashed rounded-2xl bg-card/30">
        <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground">No active jobs</h3>
        <p className="text-muted-foreground text-sm mt-1">Start a transfer to see progress here.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 space-y-4">
      <h3 className="text-lg font-bold flex items-center mb-6">
        <Activity className="w-5 h-5 mr-2 text-primary" />
        Recent Transfers
      </h3>

      <div className="space-y-4">
        {jobs.map((job: any) => {
          const total = job.total ?? 0;
          const progress = job.progress ?? 0;
          const progressPercentage = total > 0 ? Math.round((progress / total) * 100) : 0;
          
          let StatusIcon = Clock;
          let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
          let statusColor = "text-muted-foreground";

          if (job.status === 'processing') {
            StatusIcon = Loader2;
            badgeVariant = "default";
            statusColor = "text-primary";
          } else if (job.status === 'completed') {
            StatusIcon = CheckCircle2;
            badgeVariant = "secondary";
            statusColor = "text-emerald-500";
          } else if (job.status === 'failed') {
            StatusIcon = XCircle;
            badgeVariant = "destructive";
            statusColor = "text-destructive";
          } else if (job.status === 'paused') {
            StatusIcon = Pause;
            badgeVariant = "outline";
            statusColor = "text-yellow-500";
          } else if (job.status === 'stopped') {
            StatusIcon = Square;
            badgeVariant = "outline";
            statusColor = "text-muted-foreground";
          }

          const canPause = job.status === 'processing';
          const canResume = job.status === 'paused';
          const canStop = job.status === 'processing' || job.status === 'paused';

          return (
            <Card key={job.id} className="p-5 border border-border/50 hover:border-border hover:shadow-md transition-all overflow-hidden relative">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full bg-background border ${statusColor}`}>
                    <StatusIcon className={`w-4 h-4 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Job #{job.id}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {job.sourceGroupId.slice(0, 8)}... → {job.targetGroupId.slice(0, 8)}...
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
                      className="h-8 px-2"
                    >
                      <Pause className="w-3.5 h-3.5 mr-1" />
                      Pause
                    </Button>
                  )}
                  {canResume && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(job.id, "processing")}
                      disabled={updateStatus.isPending}
                      className="h-8 px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Resume
                    </Button>
                  )}
                  {canStop && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStatusChange(job.id, "stopped")}
                      disabled={updateStatus.isPending}
                      className="h-8 px-2"
                    >
                      <Square className="w-3.5 h-3.5 mr-1" />
                      Stop
                    </Button>
                  )}
                  <Badge variant={badgeVariant} className="capitalize px-3 py-1">
                    {job.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{job.progress} / {job.total || '-'} users ({progressPercentage}%)</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {job.error && (
                <div className="mt-4 p-3 bg-destructive/5 rounded-md text-xs text-destructive flex items-start">
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

