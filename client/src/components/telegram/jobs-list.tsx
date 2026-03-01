import { Activity, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useJobs } from "@/hooks/use-telegram";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function JobsList() {
  const { data: jobs = [], isLoading } = useJobs();

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
        {jobs.map((job) => {
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
          }

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
                <Badge variant={badgeVariant} className="capitalize px-3 py-1">
                  {job.status}
                </Badge>
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

import { AlertCircle } from "lucide-react"; // Import added for error state
