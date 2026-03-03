import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

import { useSendCode, useLogin } from "@/hooks/use-telegram";
import { useAuthStore } from "@/store/use-auth-store";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const phoneSchema = z.object({
  phoneNumber: z.string().min(5, "Número de telefone obrigatório (inclua o código do país)"),
});

const codeSchema = z.object({
  code: z.string().min(1, "Código obrigatório"),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;
type CodeFormValues = z.infer<typeof codeSchema>;

export function AuthCard() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneData, setPhoneData] = useState<PhoneFormValues | null>(null);
  const [phoneCodeHash, setPhoneCodeHash] = useState<string | null>(null);
  
  const { toast } = useToast();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const sendCodeMutation = useSendCode();
  const loginMutation = useLogin();

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: "+" },
  });

  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
  });

  const onPhoneSubmit = async (data: PhoneFormValues) => {
    try {
      const res = await sendCodeMutation.mutateAsync(data);
      setPhoneData(data);
      setPhoneCodeHash(res.phoneCodeHash);
      setStep("code");
      toast({ title: "Código enviado!", description: "Verifique seu app do Telegram." });
    } catch (err: any) {
      toast({ title: "Falha ao enviar código", description: err.message, variant: "destructive" });
    }
  };

  const onCodeSubmit = async (data: CodeFormValues) => {
    if (!phoneData || !phoneCodeHash) return;
    try {
      const res = await loginMutation.mutateAsync({
        ...phoneData,
        phoneCodeHash,
        code: data.code,
      });
      setAuth(0, "", res.sessionString);
      toast({ title: "Autenticado!", description: "Conectado ao Telegram." });
    } catch (err: any) {
      toast({ title: "Falha no login", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="glass-card p-8 border-primary/20 w-full max-w-md mx-auto relative overflow-hidden hud-border">
      {/* Top neon line */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary/5 rounded-md flex items-center justify-center mx-auto mb-4 border border-primary/20 neon-glow">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold tracking-widest text-foreground uppercase font-display">Conectar</h2>
        <p className="text-muted-foreground mt-2 text-xs font-mono tracking-wider">
          VINCULE SUA CONTA TELEGRAM
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "phone" && (
          <motion.form
            key="phone"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onSubmit={phoneForm.handleSubmit(onPhoneSubmit)}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Número de Telefone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
                <Input 
                  id="phoneNumber" 
                  placeholder="+55 11 99999-0000" 
                  className="pl-10 h-12 bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/20 font-mono"
                  {...phoneForm.register("phoneNumber")} 
                />
              </div>
              {phoneForm.formState.errors.phoneNumber && (
                <p className="text-xs text-destructive font-mono">{phoneForm.formState.errors.phoneNumber.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 font-display text-sm tracking-widest uppercase neon-glow"
              disabled={sendCodeMutation.isPending}
            >
              {sendCodeMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Enviar Código
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </motion.form>
        )}

        {step === "code" && (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onSubmit={codeForm.handleSubmit(onCodeSubmit)}
            className="space-y-6"
          >
            <div className="text-center p-4 bg-primary/5 rounded-md border border-primary/20">
              <p className="text-xs font-mono text-primary tracking-wider">CÓDIGO ENVIADO PARA {phoneData?.phoneNumber}</p>
              <button 
                type="button" 
                onClick={() => setStep("phone")}
                className="text-[10px] text-muted-foreground hover:text-primary mt-1 font-mono tracking-wider underline underline-offset-4"
              >
                ALTERAR NÚMERO
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Código de Login
              </Label>
              <Input 
                id="code" 
                placeholder="12345" 
                className="h-14 text-center text-2xl tracking-[0.5em] bg-secondary/50 border-border focus:border-primary/50 font-mono"
                autoFocus
                {...codeForm.register("code")} 
              />
              {codeForm.formState.errors.code && (
                <p className="text-xs text-center text-destructive font-mono">{codeForm.formState.errors.code.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 font-display text-sm tracking-widest uppercase neon-glow"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Autenticar"
              )}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </Card>
  );
}
