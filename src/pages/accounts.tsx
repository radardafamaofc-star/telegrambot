import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Plus, Trash2, Loader2, ArrowRight, Users, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSendCode, useLogin } from "@/hooks/use-telegram";
import { useAccountsStore, TelegramAccount } from "@/store/use-accounts-store";

const phoneSchema = z.object({ phoneNumber: z.string().min(5, "Número obrigatório") });
const codeSchema = z.object({ code: z.string().min(1, "Código obrigatório") });

function AccountRow({ account, onRemove }: { account: TelegramAccount; onRemove: () => void }) {
  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    active: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "ATIVA", icon: <CheckCircle className="w-3 h-3" /> },
    banned: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "BANIDA", icon: <AlertCircle className="w-3 h-3" /> },
    flood: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "FLOOD", icon: <AlertCircle className="w-3 h-3" /> },
    offline: { color: "bg-muted text-muted-foreground border-border", label: "OFFLINE", icon: <AlertCircle className="w-3 h-3" /> },
  };

  const s = statusConfig[account.status] || statusConfig.offline;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center justify-between p-4 bg-secondary/30 rounded-md border border-border hover:border-primary/20 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
          <Phone className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-mono font-bold tracking-wider text-foreground">
            {account.label || account.phoneNumber}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
            {account.phoneNumber} • {account.addedCount} adições
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-[9px] font-mono tracking-wider ${s.color}`}>
          {s.icon}
          <span className="ml-1">{s.label}</span>
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function AccountsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneData, setPhoneData] = useState<{ phoneNumber: string } | null>(null);
  const [phoneCodeHash, setPhoneCodeHash] = useState<string | null>(null);

  const { accounts, addAccount, removeAccount } = useAccountsStore();
  const { toast } = useToast();
  const sendCodeMutation = useSendCode();
  const loginMutation = useLogin();

  const phoneForm = useForm<{ phoneNumber: string }>({ resolver: zodResolver(phoneSchema), defaultValues: { phoneNumber: "+" } });
  const codeForm = useForm<{ code: string }>({ resolver: zodResolver(codeSchema) });

  const onPhoneSubmit = async (data: { phoneNumber: string }) => {
    try {
      const res = await sendCodeMutation.mutateAsync(data);
      setPhoneData(data);
      setPhoneCodeHash(res.phoneCodeHash);
      setStep("code");
      toast({ title: "Código enviado!", description: "Verifique o Telegram." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const onCodeSubmit = async (data: { code: string }) => {
    if (!phoneData || !phoneCodeHash) return;
    try {
      const res = await loginMutation.mutateAsync({ ...phoneData, phoneCodeHash, code: data.code });
      addAccount({
        phoneNumber: phoneData.phoneNumber,
        sessionString: res.sessionString,
        label: phoneData.phoneNumber,
      });
      toast({ title: "Conta adicionada!", description: phoneData.phoneNumber });
      setShowAddForm(false);
      setStep("phone");
      phoneForm.reset({ phoneNumber: "+" });
      codeForm.reset();
    } catch (err: any) {
      toast({ title: "Falha no login", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="fixed inset-0 scanline pointer-events-none z-50" />
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider mb-3 text-primary neon-text uppercase font-display">
            Gerenciador de Contas
          </h1>
          <p className="text-xs text-muted-foreground font-mono tracking-wide">
            ADICIONE MÚLTIPLAS CONTAS TELEGRAM PARA RODÍZIO AUTOMÁTICO
          </p>
        </div>

        <Card className="glass-card p-6 border-primary/10 w-full max-w-2xl mx-auto hud-border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/5 rounded-md flex items-center justify-center border border-primary/20 neon-glow">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display text-sm font-bold tracking-widest uppercase text-foreground">
                  Contas ({accounts.length})
                </p>
                <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                  {accounts.filter(a => a.status === 'active').length} ativas
                </p>
              </div>
            </div>
            <Button
              variant={showAddForm ? "outline" : "default"}
              size="sm"
              className="font-mono text-xs tracking-wider uppercase"
              onClick={() => { setShowAddForm(!showAddForm); setStep("phone"); }}
            >
              {showAddForm ? "Cancelar" : <><Plus className="w-4 h-4 mr-1" /> Adicionar</>}
            </Button>
          </div>

          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="p-4 bg-primary/5 rounded-md border border-primary/20">
                  <AnimatePresence mode="wait">
                    {step === "phone" && (
                      <motion.form key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">Número</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
                            <Input placeholder="+55 11 99999-0000" className="pl-10 h-11 bg-secondary/50 border-border font-mono text-sm" {...phoneForm.register("phoneNumber")} />
                          </div>
                        </div>
                        <Button type="submit" size="sm" className="w-full font-display text-xs tracking-widest uppercase" disabled={sendCodeMutation.isPending}>
                          {sendCodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Enviar Código <ArrowRight className="ml-1 w-3 h-3" /></>}
                        </Button>
                      </motion.form>
                    )}
                    {step === "code" && (
                      <motion.form key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4">
                        <p className="text-[10px] text-primary font-mono tracking-wider text-center">CÓDIGO ENVIADO PARA {phoneData?.phoneNumber}</p>
                        <Input placeholder="12345" className="h-12 text-center text-xl tracking-[0.5em] bg-secondary/50 border-border font-mono" autoFocus {...codeForm.register("code")} />
                        <Button type="submit" size="sm" className="w-full font-display text-xs tracking-widest uppercase" disabled={loginMutation.isPending}>
                          {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar Conta"}
                        </Button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <AnimatePresence>
              {accounts.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                  <ShieldCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground font-mono tracking-wider">NENHUMA CONTA ADICIONADA</p>
                </motion.div>
              ) : (
                accounts.map((account) => (
                  <AccountRow key={account.id} account={account} onRemove={() => removeAccount(account.id)} />
                ))
              )}
            </AnimatePresence>
          </div>
        </Card>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50 font-mono tracking-wider">
        TELETRANSFER &copy; {new Date().getFullYear()} // USE COM RESPONSABILIDADE
      </footer>
    </div>
  );
}
