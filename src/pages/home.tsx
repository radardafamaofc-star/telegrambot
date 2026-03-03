import { motion } from "framer-motion";
import { useAuthStore } from "@/store/use-auth-store";
import { Navbar } from "@/components/layout/navbar";
import { AuthCard } from "@/components/telegram/auth-card";
import { TransferCard } from "@/components/telegram/transfer-card";
import { JobsList } from "@/components/telegram/jobs-list";

export default function Home() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="min-h-screen flex flex-col">
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
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
                Migração de Membros do Telegram
              </h1>
              <p className="text-lg text-muted-foreground">
                Extraia membros de qualquer grupo e transfira diretamente para sua comunidade com apenas alguns cliques.
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

      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50">
        SyncGroup &copy; {new Date().getFullYear()}. Use com responsabilidade.
      </footer>
    </div>
  );
}
