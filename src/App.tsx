import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useKeyStore } from "@/store/use-key-store";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import KeyGate from "@/pages/key-gate";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return <AdminLogin />;
  return <>{children}</>;
}

function Router() {
  const isKeyValid = useKeyStore((s) => s.isKeyValid);

  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">
        <ProtectedAdmin>
          <AdminDashboard />
        </ProtectedAdmin>
      </Route>
      <Route path="/">
        {isKeyValid ? <Home /> : <KeyGate />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
