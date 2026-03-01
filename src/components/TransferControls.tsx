import { motion } from "framer-motion";
import { ArrowRightLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface TransferControlsProps {
  selectedCount: number;
  destinationSet: boolean;
  onTransfer: () => void;
  status: "idle" | "transferring" | "success" | "error";
  progress?: number;
  total?: number;
}

const TransferControls = ({ selectedCount, destinationSet, onTransfer, status, progress = 0, total = 0 }: TransferControlsProps) => {
  const canTransfer = selectedCount > 0 && destinationSet && status === "idle";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Transfer button */}
      <motion.button
        whileHover={canTransfer ? { scale: 1.05 } : {}}
        whileTap={canTransfer ? { scale: 0.95 } : {}}
        onClick={onTransfer}
        disabled={!canTransfer}
        className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
          canTransfer
            ? "bg-primary text-primary-foreground shadow-lg animate-pulse-glow cursor-pointer"
            : status === "transferring"
            ? "bg-warning text-warning-foreground"
            : status === "success"
            ? "bg-success text-success-foreground"
            : status === "error"
            ? "bg-destructive text-destructive-foreground"
            : "bg-secondary text-muted-foreground cursor-not-allowed"
        }`}
      >
        {status === "transferring" ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : status === "success" ? (
          <CheckCircle2 className="w-6 h-6" />
        ) : status === "error" ? (
          <AlertTriangle className="w-6 h-6" />
        ) : (
          <ArrowRightLeft className="w-6 h-6" />
        )}
      </motion.button>

      {/* Status text */}
      <div className="text-center">
        {status === "idle" && selectedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-semibold">{selectedCount}</span> membro{selectedCount !== 1 ? "s" : ""} selecionado{selectedCount !== 1 ? "s" : ""}
          </p>
        )}
        {status === "idle" && selectedCount === 0 && (
          <p className="text-xs text-muted-foreground">Selecione membros para transferir</p>
        )}
        {status === "transferring" && (
          <div className="space-y-2">
            <p className="text-xs text-warning font-medium">Transferindo...</p>
            <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-warning rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}/{total}</p>
          </div>
        )}
        {status === "success" && (
          <p className="text-xs text-success font-medium">Transferência concluída!</p>
        )}
        {status === "error" && (
          <p className="text-xs text-destructive font-medium">Erro na transferência</p>
        )}
      </div>
    </div>
  );
};

export default TransferControls;
