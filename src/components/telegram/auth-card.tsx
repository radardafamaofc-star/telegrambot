import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Phone, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

import { useSendCode, useLogin } from "@/hooks/use-telegram";
import { useAuthStore } from "@/store/use-auth-store";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const phoneSchema = z.object({
  phoneNumber: z.string().min(5, "Phone number is required (include country code)"),
});

const codeSchema = z.object({
  code: z.string().min(1, "Code is required"),
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
    defaultValues: {
      phoneNumber: "+",
    },
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
      toast({
        title: "Código enviado!",
        description: "Verifique seu app do Telegram para o código de login.",
      });
    } catch (err: any) {
      toast({
        title: "Falha ao enviar código",
        description: err.message,
        variant: "destructive",
      });
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
      
      // We pass 0 and empty string for apiId/apiHash as they are now handled server-side
      setAuth(0, "", res.sessionString);
      
      toast({
        title: "Autenticado com sucesso!",
        description: "Você está conectado ao Telegram.",
      });
    } catch (err: any) {
      toast({
        title: "Falha no login",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="glass-card p-8 border-none shadow-2xl shadow-primary/5 w-full max-w-md mx-auto relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
      
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Conectar Telegram</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Vincule sua conta para extrair e transferir membros.
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
              <Label htmlFor="phoneNumber" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número de Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="phoneNumber" 
                  placeholder="+12345678900" 
                  className="pl-10 h-12 bg-background/50 focus:bg-background transition-colors"
                  {...phoneForm.register("phoneNumber")} 
                />
              </div>
              {phoneForm.formState.errors.phoneNumber && (
                <p className="text-xs text-destructive">{phoneForm.formState.errors.phoneNumber.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 font-medium text-[15px] shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
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
            <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-sm font-medium text-primary">Código enviado para {phoneData?.phoneNumber}</p>
              <button 
                type="button" 
                onClick={() => setStep("phone")}
                className="text-xs text-muted-foreground hover:text-primary mt-1 underline underline-offset-2"
              >
                Alterar número
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código de Login</Label>
              <Input 
                id="code" 
                placeholder="12345" 
                className="h-14 text-center text-2xl tracking-widest bg-background/50 focus:bg-background transition-colors"
                autoFocus
                {...codeForm.register("code")} 
              />
              {codeForm.formState.errors.code && (
                <p className="text-xs text-center text-destructive">{codeForm.formState.errors.code.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 font-medium text-[15px] shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
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
