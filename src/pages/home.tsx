import { motion } from "framer-motion";
import { useAuthStore } from "@/store/use-auth-store";
import { Navbar } from "@/components/layout/navbar";
import { AuthCard } from "@/components/telegram/auth-card";
import { TransferCard } from "@/components/telegram/transfer-card";
import { JobsList } from "@/components/telegram/jobs-list";

export default function Home() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline pointer-events-none z-50" />
      
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
        {!isAuthenticated ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full flex flex-col items-center justify-center"
          >
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider mb-4 text-primary neon-text uppercase">
                Migração de Membros
              </h1>
              <p className="text-sm text-muted-foreground font-mono tracking-wide">
                Extraia membros de qualquer grupo e transfira diretamente para sua comunidade.
              </p>
            </div>
            <AuthCard />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full flex flex-col items-center"
          >
            <TransferCard />
            <JobsList />
          </motion.div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50 font-mono tracking-wider">
        TELETRANSFER &copy; {new Date().getFullYear()} // USE COM RESPONSABILIDADE
      </footer>
    </div>
  );
}
