import { motion } from "framer-motion";
import { XCircle, Mail } from "lucide-react";
import NetworkBackground from "@/components/NetworkBackground";
import { useAuth } from "@/contexts/AuthContext";

const RejectedStatus = () => {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    console.log("[UI] logout clicked");
    await signOut();
  };

  return (
    <div className="mobile-container relative flex flex-col items-center justify-center bg-background">
      <NetworkBackground />

      <div className="relative z-10 flex flex-col items-center justify-center px-8 text-center">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-destructive" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-display text-2xl font-bold text-foreground mb-3"
        >
          Cadastro não aprovado
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-8"
        >
          Infelizmente seu perfil não atendeu aos critérios da plataforma neste momento.
        </motion.p>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-4 flex items-start gap-3 w-full max-w-xs mb-10"
        >
          <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-xs font-medium text-foreground">Precisa de ajuda?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Entre em contato com nossa equipe para mais informações sobre o motivo da rejeição.
            </p>
          </div>
        </motion.div>

        {/* Action */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-xs"
        >
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            Sair da conta
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default RejectedStatus;
