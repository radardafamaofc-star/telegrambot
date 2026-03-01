import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ArrowRight, Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export interface Member {
  id: number;
  name: string;
  username?: string;
  selected: boolean;
}

interface MemberListProps {
  members: Member[];
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  title: string;
  emptyMessage: string;
  status?: "idle" | "loading" | "success" | "error";
}

const MemberList = ({ members, onToggle, onSelectAll, onDeselectAll, title, emptyMessage, status = "idle" }: MemberListProps) => {
  const [search, setSearch] = useState("");
  const selectedCount = members.filter((m) => m.selected).length;

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.username && m.username.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col h-[420px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {title}
          {members.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({selectedCount}/{members.length})
            </span>
          )}
        </h3>
        {members.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Todos
            </button>
            <button
              onClick={onDeselectAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Nenhum
            </button>
          </div>
        )}
      </div>

      {members.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar membro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
        {status === "loading" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">Carregando membros...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((member) => (
              <motion.button
                key={member.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onClick={() => onToggle(member.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  member.selected
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-secondary border border-transparent"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    member.selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                  {member.username && (
                    <p className="text-xs text-muted-foreground truncate">@{member.username}</p>
                  )}
                </div>
                {member.selected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default MemberList;
