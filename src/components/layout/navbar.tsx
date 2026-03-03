import { Layers, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { isAuthenticated, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-xl transition-all">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Layers className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">SyncGroup</span>
        </div>

        {isAuthenticated && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={logout}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Desconectar
          </Button>
        )}
      </div>
    </header>
  );
}
