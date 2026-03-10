import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, RefreshCw, ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";
import NetworkBackground from "@/components/NetworkBackground";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COOLDOWN_SECONDS = 120;

type CheckEmailMode = "signup" | "recovery";

const CheckEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const email = searchParams.get("email") || "";
  const rawMode = searchParams.get("mode");

  const mode: CheckEmailMode = rawMode === "recovery" ? "recovery" : "signup";

  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const content = useMemo(() => {
    if (mode === "recovery") {
      return {
        title: (
          <>
            Recupere sua <span className="text-gradient-neon">senha</span>
          </>
        ),
        intro: "Enviamos um link de recuperação para:",
        description: "Clique no link do e-mail para redefinir sua senha com segurança.",
        warning:
          'Se não encontrar o e-mail, verifique Spam/Lixo Eletrônico e marque como "Não é spam" para melhorar as próximas entregas.',
        primaryActionLabel: "Voltar para o Login",
        primaryAction: () => navigate("/login"),
        showResend: false,
      };
    }

    return {
      title: (
        <>
          Confirme seu <span className="text-gradient-neon">e-mail</span>
        </>
      ),
      intro: "Enviamos um link de confirmação para:",
      description: "Clique no link do e-mail para ativar sua conta e acessar a ORBTY.",
      warning:
        'Se não encontrar o e-mail, verifique Spam/Lixo Eletrônico e marque como "Não é spam" para melhorar as próximas entregas.',
      primaryActionLabel: "Ir para o Login",
      primaryAction: () => navigate("/login"),
      showResend: true,
    };
  }, [mode, navigate]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const handleResendSignup = useCallback(async () => {
    if (!email || cooldown > 0 || isResending) return;

    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        if (error.message?.toLowerCase().includes("rate") || error.status === 429) {
          toast.error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        } else {
          toast.error(error.message || "Erro ao reenviar e-mail.");
        }
      } else {
        toast.success("E-mail reenviado! Verifique sua caixa de entrada.");
      }
    } catch (error) {
      console.error("[CheckEmail] resend signup error:", error);
      toast.error("Erro ao reenviar e-mail.");
    } finally {
      setIsResending(false);
      setCooldown(COOLDOWN_SECONDS);
    }
  }, [email, cooldown, isResending]);

  const buttonDisabled = isResending || cooldown > 0;

  return (
    <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8"
        >
          {mode === "recovery" ? (
            <ShieldCheck className="w-10 h-10 text-primary" />
          ) : (
            <Mail className="w-10 h-10 text-primary" />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-display text-2xl font-bold text-foreground text-center mb-3"
        >
          {content.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground text-sm text-center mb-2 max-w-xs"
        >
          {content.intro}
        </motion.p>

        {email && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-primary font-semibold text-sm text-center mb-6 break-all"
          >
            {email}
          </motion.p>
        )}

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground text-sm text-center mb-8 max-w-xs"
        >
          {content.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xs rounded-xl bg-warning/10 border border-warning/20 p-4 mb-8"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {content.warning}
            </p>
          </div>
        </motion.div>

        {content.showResend && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={handleResendSignup}
            disabled={buttonDisabled}
            whileHover={buttonDisabled ? {} : { scale: 1.02 }}
            whileTap={buttonDisabled ? {} : { scale: 0.98 }}
            className="w-full max-w-xs py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 glow-blue transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            <RefreshCw className={`w-4 h-4 ${isResending ? "animate-spin" : ""}`} />
            {isResending
              ? "Reenviando…"
              : cooldown > 0
              ? `Aguarde ${cooldown}s para reenviar`
              : "Reenviar e-mail"}
          </motion.button>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: content.showResend ? 0.7 : 0.6 }}
          onClick={content.primaryAction}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {content.primaryActionLabel}
        </motion.button>
      </div>
    </div>
  );
};

export default CheckEmail;