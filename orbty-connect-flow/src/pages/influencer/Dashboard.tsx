import { motion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Sparkles,
  User,
  Zap,
  CircleHelp,
} from "lucide-react";

const InfluencerDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, approvalStatus, loading } = useAuth();

  const firstName = useMemo(() => {
    const raw =
      (profile as any)?.name ??
      (user as any)?.user_metadata?.name ??
      (user?.email ? user.email.split("@")[0] : "");
    const name = String(raw ?? "").trim();
    return name ? name.split(" ")[0] : "você";
  }, [profile, user]);

  const statusBadge = useMemo(() => {
    if (approvalStatus === "approved") {
      return {
        label: "Aprovada",
        desc: "Você já pode acompanhar suas campanhas e entregas por aqui.",
        icon: BadgeCheck,
        className: "border-accent/30 bg-accent/10 text-accent",
      };
    }
    if (approvalStatus === "pending") {
      return {
        label: "Em análise",
        desc: "Seu cadastro está sendo revisado. Assim que for aprovado, você terá acesso total.",
        icon: CalendarCheck,
        className: "border-warning/30 bg-warning/10 text-warning",
      };
    }
    if (approvalStatus === "rejected") {
      return {
        label: "Precisa de ajustes",
        desc: "Revise seu perfil e envie novamente para liberar o acesso.",
        icon: Sparkles,
        className: "border-destructive/30 bg-destructive/5 text-destructive",
      };
    }
    return {
      label: "Carregando…",
      desc: "Preparando seu painel.",
      icon: Zap,
      className: "border-border/50 bg-card/60 text-muted-foreground",
    };
  }, [approvalStatus]);

  const benefits = [
    {
      title: "Campanhas da sua região",
      desc: "Ações locais com foco em relevância e resultado.",
      icon: Sparkles,
    },
    {
      title: "Tudo centralizado",
      desc: "Detalhes, entregas e status dentro de cada campanha.",
      icon: CalendarCheck,
    },
    {
      title: "Organize sua rotina",
      desc: "Convites, confirmadas, entregues e aprovadas em um só lugar.",
      icon: BadgeCheck,
    },
  ];

  const steps = [
    {
      n: "01",
      title: "Complete seu perfil",
      desc: "Perfil completo aumenta suas chances de entrar em campanhas.",
      icon: User,
      action: () => navigate("/perfil"),
    },
    {
      n: "02",
      title: "Acesse suas campanhas",
      desc: "Convites, entregas e status ficam em “Minhas campanhas”.",
      icon: Zap,
      action: () => navigate("/minhas-campanhas"),
    },
    {
      n: "03",
      title: "Acompanhe seu histórico",
      desc: "Veja participações aprovadas e campanhas concluídas/encerradas.",
      icon: ArrowRight,
      action: () => navigate("/minhas-candidaturas"),
    },
  ];

  const quickActions = [
    {
      title: "Minhas campanhas",
      desc: "Convites, entregas e status.",
      icon: Zap,
      route: "/minhas-campanhas",
    },
    {
      title: "Histórico",
      desc: "Participações aprovadas e campanhas concluídas.",
      icon: ArrowRight,
      route: "/minhas-candidaturas",
    },
    {
      title: "Meu perfil",
      desc: "Atualizar informações.",
      icon: User,
      route: "/perfil",
    },
    {
      title: "Ajuda / FAQ",
      desc: "Dúvidas rápidas.",
      icon: CircleHelp,
      route: "/ajuda",
    },
  ];

  return (
    <MobileLayout title="Início" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">
            Painel do creator
          </p>

          <h2 className="font-display text-2xl font-bold text-foreground">
            Olá, <span className="text-gradient-neon">{firstName}</span>
          </h2>

          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            O Orbty conecta creators a campanhas regionais. Aqui você acompanha briefing,
            entregas e status — tudo dentro de cada campanha.
          </p>
        </motion.div>

        {/* STATUS + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Seu status</p>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${statusBadge.className}`}
                >
                  <statusBadge.icon className="w-3 h-3" />
                  {statusBadge.label}
                </span>

                {user?.email ? (
                  <span className="text-[10px] text-muted-foreground">{user.email}</span>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{statusBadge.desc}</p>
            </div>

            <button
              onClick={() => navigate("/perfil")}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Abrir perfil"
              disabled={loading}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/minhas-campanhas")}
              disabled={loading}
              className="py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-xs glow-blue transition-all"
            >
              Ir para minhas campanhas
            </button>

            <button
              onClick={() => navigate("/minhas-candidaturas")}
              disabled={loading}
              className="py-3 rounded-xl border border-border/50 bg-card/60 text-foreground font-semibold text-xs hover:bg-card transition-colors"
            >
              Ver histórico
            </button>
          </div>
        </motion.div>

        {/* BENEFÍCIOS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-3"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
            O que você ganha aqui
          </p>

          <div className="grid grid-cols-1 gap-3">
            {benefits.map((b) => (
              <div key={b.title} className="glass-card-hover p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-neon-subtle flex items-center justify-center shrink-0">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{b.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* COMO FUNCIONA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
            Como funciona
          </p>

          <div className="space-y-2">
            {steps.map((s, i) => (
              <motion.button
                type="button"
                key={s.n}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.06 }}
                onClick={s.action}
                disabled={loading}
                className="w-full glass-card-hover p-4 flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-xl border border-border/50 bg-card/60 flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Passo {s.n}
                  </p>
                  <h4 className="font-semibold text-foreground text-sm">{s.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ATALHOS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="space-y-3"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
            Atalhos
          </p>

          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((qa) => (
              <button
                key={qa.title}
                onClick={() => navigate(qa.route)}
                disabled={loading}
                className="w-full glass-card-hover p-4 flex items-center gap-3 text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-neon-subtle flex items-center justify-center shrink-0">
                  <qa.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{qa.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{qa.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </MobileLayout>
  );
};

export default InfluencerDashboard;