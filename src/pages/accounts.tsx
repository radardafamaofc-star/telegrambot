import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Plus, Trash2, Loader2, ArrowRight, Users, ShieldCheck, AlertCircle, CheckCircle, Flame, X, MessageCircle, Search, Globe, MessagesSquare } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSendCode, useLogin } from "@/hooks/use-telegram";
import { useAccountsStore, TelegramAccount } from "@/store/use-accounts-store";
import { useStartWarmup, useWarmupStatus } from "@/hooks/use-warmup";
import { useStartCrossChat, useCrossChatStatus } from "@/hooks/use-cross-chat";

const phoneSchema = z.object({ phoneNumber: z.string().min(5, "Número obrigatório") });
const codeSchema = z.object({ code: z.string().min(1, "Código obrigatório") });

function WarmupPanel({ account, onClose }: { account: TelegramAccount; onClose: () => void }) {
  const [groups, setGroups] = useState("");
  const [sendMessages, setSendMessages] = useState(true);
  const [updateProfile, setUpdateProfile] = useState(true);
  const [autoDiscoverGroups, setAutoDiscoverGroups] = useState(true);
  const [discoverCount, setDiscoverCount] = useState(5);
  const startWarmup = useStartWarmup();
  const { data: warmupStatus } = useWarmupStatus(account.warmupId ?? null);
  const { toast } = useToast();
  const { updateAccount } = useAccountsStore();

  const isRunning = warmupStatus?.status === "running";
  const isCompleted = warmupStatus?.status === "completed";
  const isFailed = warmupStatus?.status === "failed";

  const handleStart = async () => {
    const groupList = groups
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    try {
      const result = await startWarmup.mutateAsync({
        sessionString: account.sessionString,
        phoneNumber: account.phoneNumber,
        joinGroups: groupList,
        sendMessages,
        updateProfile,
        autoDiscoverGroups,
        discoverCount,
      });
      updateAccount(account.id, { warmupId: result.warmupId });
      toast({ title: "Aquecimento iniciado!", description: "Acompanhe o progresso abaixo." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const progress = warmupStatus
    ? Math.round((warmupStatus.stepsCompleted / Math.max(warmupStatus.totalSteps, 1)) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="p-4 bg-amber-500/5 rounded-md border border-amber-500/20 mt-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <p className="text-xs font-display font-bold tracking-wider text-amber-400 uppercase">
              Aquecimento de Conta
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>

        {!warmupStatus || isFailed ? (
          <>
            <div className="space-y-3">
              {/* Profile check */}
              <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[10px] font-mono tracking-wider text-foreground">VERIFICAR PERFIL</p>
                </div>
                <Switch checked={updateProfile} onCheckedChange={setUpdateProfile} />
              </div>

              {/* Send messages */}
              <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[10px] font-mono tracking-wider text-foreground">ENVIAR MENSAGENS</p>
                </div>
                <Switch checked={sendMessages} onCheckedChange={setSendMessages} />
              </div>

              {/* Auto discover groups */}
              <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <Search className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[10px] font-mono tracking-wider text-foreground">BUSCAR GRUPOS AUTOMATICAMENTE</p>
                </div>
                <Switch checked={autoDiscoverGroups} onCheckedChange={setAutoDiscoverGroups} />
              </div>

              {autoDiscoverGroups && (
                <div className="flex items-center justify-between p-2 rounded bg-secondary/20 border border-border ml-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[10px] font-mono tracking-wider text-foreground">QUANTIDADE DE GRUPOS</p>
                  </div>
                  <select
                    value={discoverCount}
                    onChange={(e) => setDiscoverCount(Number(e.target.value))}
                    className="bg-secondary/50 border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                  </select>
                </div>
              )}

              {/* Groups to join (manual) */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">
                  Grupos adicionais (opcional, 1 por linha)
                </Label>
                <textarea
                  value={groups}
                  onChange={(e) => setGroups(e.target.value)}
                  placeholder={"t.me/grupo1\nt.me/+abc123\n@grupo3"}
                  rows={3}
                  className="w-full resize-none rounded-md bg-secondary/50 border border-border px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
                <p className="text-[9px] text-muted-foreground font-mono tracking-wider">
                  Aceita links t.me/, convites privados e @usernames
                </p>
              </div>
            </div>

            {isFailed && warmupStatus?.error && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                <p className="text-[10px] text-destructive font-mono">{warmupStatus.error}</p>
              </div>
            )}

            <Button
              onClick={handleStart}
              disabled={startWarmup.isPending}
              size="sm"
              className="w-full font-display text-xs tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
            >
              {startWarmup.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Flame className="w-3 h-3 mr-1" /> Iniciar Aquecimento
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono tracking-wider text-muted-foreground">
                  {warmupStatus.currentStep}
                </p>
                <Badge
                  variant="outline"
                  className={`text-[9px] font-mono ${
                    isCompleted
                      ? "border-emerald-500/30 text-emerald-400"
                      : "border-amber-500/30 text-amber-400"
                  }`}
                >
                  {isCompleted ? "CONCLUÍDO" : `${progress}%`}
                </Badge>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            {/* Log */}
            <div className="max-h-40 overflow-y-auto rounded bg-secondary/30 border border-border p-2 space-y-0.5">
              {warmupStatus.log.map((line, i) => (
                <p key={i} className="text-[9px] font-mono text-muted-foreground leading-relaxed">
                  {line}
                </p>
              ))}
            </div>

            {isCompleted && (
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400 font-mono tracking-wider text-center">
                  ✅ Conta aquecida! Aguarde 24-48h antes de usar para convites.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CrossChatPanel() {
  const [crossChatId, setCrossChatId] = useState<string | null>(null);
  const [conversationsPerPair, setConversationsPerPair] = useState(1);
  const { accounts } = useAccountsStore();
  const activeAccounts = accounts.filter((a) => a.status === "active");
  const startCrossChat = useStartCrossChat();
  const { data: chatStatus } = useCrossChatStatus(crossChatId);
  const { toast } = useToast();

  const isRunning = chatStatus?.status === "running";
  const isCompleted = chatStatus?.status === "completed";
  const isFailed = chatStatus?.status === "failed";

  // Calculate total possible pairs
  const totalPairs = (activeAccounts.length * (activeAccounts.length - 1)) / 2;

  const handleStart = async () => {
    try {
      const result = await startCrossChat.mutateAsync({
        accounts: activeAccounts.map((a) => ({
          sessionString: a.sessionString,
          phoneNumber: a.phoneNumber,
        })),
        conversationsPerPair,
      });
      setCrossChatId(result.chatId);
      toast({ title: "Conversas iniciadas!", description: `${activeAccounts.length} contas conversando entre si.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const progress = chatStatus
    ? Math.round((chatStatus.conversationsCompleted / Math.max(chatStatus.totalConversations, 1)) * 100)
    : 0;

  return (
    <Card className="glass-card p-6 border-blue-500/10 w-full max-w-2xl mx-auto mt-6 hud-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-500/5 rounded-md flex items-center justify-center border border-blue-500/20">
          <MessagesSquare className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="font-display text-sm font-bold tracking-widest uppercase text-foreground">
            Conversa entre Contas
          </p>
          <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
            {activeAccounts.length} CONTAS ATIVAS • {totalPairs} PARES POSSÍVEIS
          </p>
        </div>
      </div>

      {activeAccounts.length < 2 ? (
        <div className="text-center py-6">
          <MessagesSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
            ADICIONE PELO MENOS 2 CONTAS ATIVAS PARA USAR ESTA FUNCIONALIDADE
          </p>
        </div>
      ) : !chatStatus || isFailed ? (
        <div className="space-y-4">
          <div className="p-3 rounded bg-blue-500/5 border border-blue-500/10">
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider leading-relaxed">
              As contas vão trocar mensagens entre si com assuntos aleatórios e naturais em português.
              Isso cria histórico de conversa e aumenta a reputação das contas no Telegram.
            </p>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] font-mono tracking-wider text-foreground">CONVERSAS POR PAR</p>
            </div>
            <select
              value={conversationsPerPair}
              onChange={(e) => setConversationsPerPair(Number(e.target.value))}
              className="bg-secondary/50 border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </div>

          <div className="p-2 rounded bg-secondary/20 border border-border">
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider">
              📊 Total: {totalPairs * conversationsPerPair} conversas entre {activeAccounts.length} contas
            </p>
          </div>

          {isFailed && chatStatus?.error && (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
              <p className="text-[10px] text-destructive font-mono">{chatStatus.error}</p>
            </div>
          )}

          <Button
            onClick={handleStart}
            disabled={startCrossChat.isPending}
            size="sm"
            className="w-full font-display text-xs tracking-widest uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
          >
            {startCrossChat.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <MessagesSquare className="w-3 h-3 mr-1" /> Iniciar Conversas
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono tracking-wider text-muted-foreground">
                {chatStatus.currentStep}
              </p>
              <Badge
                variant="outline"
                className={`text-[9px] font-mono ${
                  isCompleted
                    ? "border-emerald-500/30 text-emerald-400"
                    : "border-blue-500/30 text-blue-400"
                }`}
              >
                {isCompleted ? "CONCLUÍDO" : `${progress}%`}
              </Badge>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <div className="max-h-48 overflow-y-auto rounded bg-secondary/30 border border-border p-2 space-y-0.5">
            {chatStatus.log.map((line, i) => (
              <p key={i} className="text-[9px] font-mono text-muted-foreground leading-relaxed">
                {line}
              </p>
            ))}
          </div>

          {isCompleted && (
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] text-emerald-400 font-mono tracking-wider text-center">
                ✅ Conversas concluídas! As contas agora têm histórico entre si.
              </p>
            </div>
          )}

          {isCompleted && (
            <Button
              onClick={() => setCrossChatId(null)}
              variant="outline"
              size="sm"
              className="w-full font-display text-xs tracking-widest uppercase"
            >
              Iniciar Novamente
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

  account,
  onRemove,
}: {
  account: TelegramAccount;
  onRemove: () => void;
}) {
  const [showWarmup, setShowWarmup] = useState(false);

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
    >
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-md border border-border hover:border-primary/20 transition-colors">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-500/60 hover:text-amber-500"
            onClick={() => setShowWarmup(!showWarmup)}
            title="Aquecer conta"
          >
            <Flame className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={onRemove}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {showWarmup && (
          <WarmupPanel account={account} onClose={() => setShowWarmup(false)} />
        )}
      </AnimatePresence>
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

        {/* Cross-Chat Panel */}
        <CrossChatPanel />

        {/* Warmup tips */}
        <Card className="glass-card p-6 border-amber-500/10 w-full max-w-2xl mx-auto mt-6 hud-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/5 rounded-md flex items-center justify-center border border-amber-500/20">
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-widest uppercase text-foreground">
                Dicas de Aquecimento
              </p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                COMO PREPARAR CONTAS NOVAS
              </p>
            </div>
          </div>
          <div className="space-y-2 text-[10px] font-mono text-muted-foreground tracking-wider">
            <p>🔥 CONTAS NOVAS precisam de aquecimento antes de convidar membros</p>
            <p>📸 Adicione foto de perfil e nome completo manualmente</p>
            <p>💬 O sistema entra em grupos e envia mensagens automaticamente</p>
            <p>🗣️ Use o "Conversa entre Contas" para criar histórico de chat entre elas</p>
            <p>⏳ Aguarde 24-48h após o aquecimento antes de usar para convites</p>
            <p>🛡️ Quanto mais natural a atividade, menor o risco de PEER_FLOOD</p>
          </div>
        </Card>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50 font-mono tracking-wider">
        TELETRANSFER &copy; {new Date().getFullYear()} // USE COM RESPONSABILIDADE
      </footer>
    </div>
  );
}
