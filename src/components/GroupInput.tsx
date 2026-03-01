import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Hash } from "lucide-react";

interface GroupInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFetch: () => void;
  loading?: boolean;
  placeholder?: string;
}

const GroupInput = ({ label, value, onChange, onFetch, loading, placeholder }: GroupInputProps) => {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "ID ou @username do grupo"}
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onFetch}
          disabled={loading || !value.trim()}
          className="px-5 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Buscar
        </motion.button>
      </div>
    </div>
  );
};

export default GroupInput;
