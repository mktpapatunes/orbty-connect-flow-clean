import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Megaphone, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import NetworkBackground from "@/components/NetworkBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardRedirect } from "@/hooks/useDashboardRedirect";

const ProfileChoice = () => {
  const navigate = useNavigate();
  const { session, userRole, isAdmin, authReady, profile, approvalStatus, signOut } = useAuth();
  const { redirectToDashboard } = useDashboardRedirect();

  // Se já está logado e já tem profile + contexto, manda pro destino
  useEffect(() => {
    if (!authReady || !session) return;
    // If user has a profile, redirect when data is ready
    if (profile && (isAdmin || userRole || approvalStatus)) {
      redirectToDashboard();
    }
  }, [authReady, session, profile, isAdmin, userRole, approvalStatus, redirectToDashboard]);

  // Se está logado e ainda carregando profile/contexto, mostra loader
  if (session && authReady) {
    if (profile === undefined) {
      return (
        <div className="mobile-container flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      );
    }
    // User already has a profile — show loader while waiting for redirect
    if (profile !== null) {
      return (
        <div className="mobile-container flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      );
    }
  }

  const roles = [{
    id: "contratante",
    title: "Quero divulgar um evento, música ou marca",
    description: "Conecte seu produto ou negócio ao público certo com criadores regionais",
    icon: Megaphone,
    route: "/cadastro-contratante"
  }, {
    id: "influenciadora",
    title: "Quero ser creator na Orbty",
    description: "Divulgue produtos e campanhas e ganhe com seu conteúdo",
    icon: Sparkles,
    route: "/cadastro-influenciadora"
  }];
  return <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      {/* Header */}
      <div className="relative z-10 pt-16 pb-8 px-8">
        <motion.button initial={{
        opacity: 0
      }} animate={{
        opacity: 1
        }} onClick={() => navigate("/welcome")} className="text-muted-foreground text-sm mb-12 hover:text-foreground transition-colors">
          ← Voltar ao início
        </motion.button>

        {/* ✅ Evita o "fiquei logado e travado" */}
        {session && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={async () => {
              await signOut();
            }}
            className="text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            Sair
          </motion.button>
        )}

        <motion.h1 initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.1
      }} className="font-display text-3xl font-bold text-foreground mb-2">
          Como você quer usar o{" "}
          <span className="text-gradient-neon">Orbty</span>?
        </motion.h1>
        <motion.p initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.2
      }} className="text-muted-foreground text-sm">
          Escolha seu perfil para começar
        </motion.p>
      </div>

      {/* Role Selection */}
      <div className="relative z-10 flex-1 px-8 space-y-4">
        {roles.map((role, i) => <motion.button key={role.id} initial={{
        opacity: 0,
        x: -20
      }} animate={{
        opacity: 1,
        x: 0
      }} transition={{
        delay: 0.3 + i * 0.15
      }} whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }} onClick={() => {
        localStorage.setItem("orbty_desired_role", role.id === "contratante" ? "contractor" : "influencer");
        navigate(role.route);
      }} className="w-full glass-card-hover p-6 flex items-center gap-5 text-left group">
            <div className="w-14 h-14 rounded-xl bg-gradient-neon-subtle flex items-center justify-center shrink-0 group-hover:glow-blue transition-all duration-300">
              <role.icon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-lg text-white">
                {role.title}
              </h3>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                {role.description}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </motion.button>)}
      </div>

      {/* Bottom */}
      <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      delay: 0.7
    }} className="relative z-10 px-8 py-8">
        <p className="text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos{" "}
          <span className="text-primary cursor-pointer">Termos de Uso</span> e{" "}
          <span className="text-primary cursor-pointer">Política de Privacidade</span>
        </p>
      </motion.div>
    </div>;
};
export default ProfileChoice;