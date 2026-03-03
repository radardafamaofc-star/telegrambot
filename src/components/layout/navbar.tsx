import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export function Navbar() {
  const { isAuthenticated, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="TeleTransfer" className="w-9 h-9 rounded-md" />
          <span className="font-display font-bold text-sm tracking-widest uppercase text-primary neon-flicker">
            TeleTransfer
          </span>
        </div>

        {isAuthenticated && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={logout}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors font-mono text-xs tracking-wider"
          >
            <LogOut className="w-4 h-4 mr-2" />
            DESCONECTAR
          </Button>
        )}
      </div>
    </header>
  );
}
