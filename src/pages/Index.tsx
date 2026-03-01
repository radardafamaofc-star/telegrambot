import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bot, Settings, Shield } from "lucide-react";
import GroupInput from "@/components/GroupInput";
import MemberList, { Member } from "@/components/MemberList";
import TransferControls from "@/components/TransferControls";
import { toast } from "sonner";

// Mock data for demo purposes
const mockMembers: Member[] = [
  { id: 1, name: "Carlos Silva", username: "carlos_dev", selected: false },
  { id: 2, name: "Ana Oliveira", username: "ana_oli", selected: false },
  { id: 3, name: "Pedro Santos", username: "pedro_s", selected: false },
  { id: 4, name: "Maria Costa", username: "maria_c", selected: false },
  { id: 5, name: "João Pereira", username: "joao_p", selected: false },
  { id: 6, name: "Lucia Ferreira", username: "lucia_f", selected: false },
  { id: 7, name: "Rafael Lima", username: "rafa_lima", selected: false },
  { id: 8, name: "Beatriz Souza", username: "bia_sz", selected: false },
  { id: 9, name: "Gabriel Alves", username: "gab_alves", selected: false },
  { id: 10, name: "Fernanda Rocha", username: "fer_rocha", selected: false },
];

const Index = () => {
  const [sourceGroup, setSourceGroup] = useState("");
  const [destGroup, setDestGroup] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [transferStatus, setTransferStatus] = useState<"idle" | "transferring" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);

  const handleFetchMembers = useCallback(() => {
    setFetchStatus("loading");
    // Simulate API call
    setTimeout(() => {
      setMembers(mockMembers.map((m) => ({ ...m, selected: false })));
      setFetchStatus("success");
      toast.success(`${mockMembers.length} membros encontrados!`);
    }, 1500);
  }, []);

  const handleToggle = useCallback((id: number) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m)));
  }, []);

  const handleSelectAll = useCallback(() => {
    setMembers((prev) => prev.map((m) => ({ ...m, selected: true })));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setMembers((prev) => prev.map((m) => ({ ...m, selected: false })));
  }, []);

  const selectedMembers = members.filter((m) => m.selected);

  const handleTransfer = useCallback(() => {
    if (selectedMembers.length === 0 || !destGroup.trim()) return;

    setTransferStatus("transferring");
    setProgress(0);
    const total = selectedMembers.length;

    // Simulate transfer progress
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setProgress(current);
      if (current >= total) {
        clearInterval(interval);
        setTransferStatus("success");
        toast.success(`${total} membros transferidos com sucesso!`);
        setTimeout(() => setTransferStatus("idle"), 3000);
      }
    }, 500);
  }, [selectedMembers, destGroup]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">TeleTransfer</h1>
              <p className="text-xs text-muted-foreground">Gerenciador de membros do Telegram</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg">
              <Shield className="w-3.5 h-3.5 text-success" />
              <span className="text-xs text-muted-foreground">Bot conectado</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Bot Token Notice */}
          <div className="mb-8 p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
            <Settings className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">Configure seu Bot Token</p>
              <p className="text-xs text-muted-foreground mt-1">
                Para funcionar, você precisa de um Bot Token do Telegram. Crie um bot pelo{" "}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  @BotFather
                </a>{" "}
                e adicione-o como administrador nos dois grupos.
              </p>
            </div>
          </div>

          {/* Group Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <GroupInput
              label="Grupo de Origem"
              value={sourceGroup}
              onChange={setSourceGroup}
              onFetch={handleFetchMembers}
              loading={fetchStatus === "loading"}
              placeholder="Ex: -1001234567890"
            />
            <GroupInput
              label="Grupo de Destino"
              value={destGroup}
              onChange={setDestGroup}
              onFetch={() => toast.info("Grupo de destino configurado!")}
              placeholder="Ex: -1009876543210"
            />
          </div>

          {/* Members + Transfer */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <MemberList
              members={members}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              title="Membros do Origem"
              emptyMessage="Busque um grupo para ver os membros"
              status={fetchStatus === "loading" ? "loading" : "idle"}
            />

            <div className="hidden md:flex">
              <TransferControls
                selectedCount={selectedMembers.length}
                destinationSet={destGroup.trim().length > 0}
                onTransfer={handleTransfer}
                status={transferStatus}
                progress={progress}
                total={selectedMembers.length}
              />
            </div>

            <MemberList
              members={selectedMembers.map((m) => ({ ...m, selected: true }))}
              onToggle={() => {}}
              onSelectAll={() => {}}
              onDeselectAll={() => {}}
              title="Para Transferir"
              emptyMessage="Selecione membros à esquerda"
            />

            {/* Mobile transfer button */}
            <div className="md:hidden flex justify-center">
              <TransferControls
                selectedCount={selectedMembers.length}
                destinationSet={destGroup.trim().length > 0}
                onTransfer={handleTransfer}
                status={transferStatus}
                progress={progress}
                total={selectedMembers.length}
              />
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
