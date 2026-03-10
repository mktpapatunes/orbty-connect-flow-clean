import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Shield, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NetworkBackground from "@/components/NetworkBackground";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const POLLING_INTERVAL_MS = 15000;

const PendingApproval = () => {
  const { user, profile, approvalStatus, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const mountedRef = useRef(true);
  const refreshInFlightRef = useRef(false);

  const safeRefresh = async () => {
    if (refreshInFlightRef.current) return;

    try {
      refreshInFlightRef.current = true;
      await refreshProfile();
    } catch (error) {
      console.error("[PendingApproval] erro ao atualizar status:", error);
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Redirect automático ao mudar o status no contexto
  useEffect(() => {
    if (approvalStatus === "approved") {
      navigate("/login", { replace: true });
      return;
    }

    if (approvalStatus === "rejected") {
      navigate("/conta-rejeitada", { replace: true });
    }
  }, [approvalStatus, navigate]);

  // 1) Polling leve
  useEffect(() => {
    if (!user?.id) return;

    const interval = window.setInterval(() => {
      void safeRefresh();
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [user?.id]);

  // 2) Realtime no profile do usuário
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-approval-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("[PendingApproval] realtime profile update:", payload);
          await safeRefresh();
        }
      )
      .subscribe((status) => {
        console.log("[PendingApproval] realtime status:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } finally {
      if (mountedRef.current) {
        setIsLoggingOut(false);
      }
    }
  };

  const handleBackToWelcome = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } finally {
      if (mountedRef.current) {
        setIsLoggingOut(false);
      }
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await safeRefresh();
      window.location.reload();
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div className="mobile-container relative flex flex-col items-center justify-center bg-background">
      <NetworkBackground />

      <div className="relative z-10 flex flex-col items-center justify-center px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 relative"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-neon-subtle flex items-center justify-center glow-blue">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/40"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-display text-2xl font-bold text-foreground mb-3"
        >
          Seu perfil está sendo <span className="text-gradient-neon">analisado</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-8"
        >
          Você será avisado assim que for aprovado para começar a usar a plataforma.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xs space-y-3 mb-10"
        >
          <div className="glass-card p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-xs font-medium text-foreground">Curadoria ativa</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A equipe ORBTY revisa cada perfil para garantir qualidade na plataforma.
              </p>
            </div>
          </div>

          <div className="glass-card p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-xs font-medium text-foreground">Acesso exclusivo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Após a aprovação, você terá acesso total a todas as funcionalidades.
              </p>
            </div>
          </div>
        </motion.div>

        {profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="glass-card px-5 py-3 mb-8"
          >
            <p className="text-xs text-muted-foreground">
              Cadastrado como: <span className="text-foreground font-medium">{profile.name}</span>
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="w-full max-w-xs space-y-3"
        >
          <button
            onClick={handleLogout}
            disabled={isLoggingOut || isRefreshing}
            className="w-full py-3 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? "Saindo..." : "Sair da conta"}
          </button>

          <button
            onClick={handleBackToWelcome}
            disabled={isLoggingOut || isRefreshing}
            className="w-full py-3 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Voltar para Welcome
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoggingOut}
            className="w-full py-3 rounded-xl text-sm text-primary hover:text-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? "Atualizando..." : "Atualizar status"}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-neon" />
          <span className="text-xs text-muted-foreground">Análise em andamento</span>
        </motion.div>
      </div>
    </div>
  );
};

export default PendingApproval;