import { motion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import TransparentLogo from "@/components/TransparentLogo";
import { useAuth } from "@/contexts/AuthContext";
import orbtyLogo from "@/assets/orbty-logo.png";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Sparkles,
  User,
  Zap,
  CircleHelp,
} from "lucide-react";

import HeroCarousel from "@/components/dashboard/HeroCarousel";
import BannersCarousel from "@/components/dashboard/BannersCarousel";
import {
  dashboardHeroBanners,
  dashboardNewsBanners,
} from "@/config/globalBanners";

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
    <MobileLayout
      title={
        <div className="relative h-10 w-[170px] overflow-visible">
          <TransparentLogo
            src={orbtyLogo}
            alt="ORBTY"
            threshold={50}
            className="absolute left-0 top-1/2 -translate-y-1/2 h-20 w-auto drop-shadow-[0_0_18px_hsl(200,100%,50%,0.35)]"
          />
        </div>
      }
      navType="influencer"
    >
      <div className="overflow-x-hidden px-6 py-6 space-y-6">
        {/* HERO TEXT */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
            Painel do creator
          </p>

          <h2 className="font-display text-2xl font-bold text-foreground">
            Olá, <span className="text-gradient-neon">{firstName}</span>
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            O Orbty conecta creators a campanhas regionais. Aqui você acompanha
            briefing, entregas e status — tudo dentro de cada campanha.
          </p>
        </motion.div>

        {/* HERO CAROUSEL GLOBAL */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <HeroCarousel
            banners={dashboardHeroBanners}
            autoPlay
            autoPlayInterval={5000}
          />
        </motion.div>

        {/* CARROSSEL GLOBAL */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
        >
          <BannersCarousel
            title="Novidades para você"
            banners={dashboardNewsBanners}
            autoPlay
            autoPlayInterval={5000}
          />
        </motion.div>

        {/* STATUS + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Seu status
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadge.className}`}
                >
                  <statusBadge.icon className="h-3 w-3" />
                  {statusBadge.label}
                </span>

                {user?.email ? (
                  <span className="text-[10px] text-muted-foreground">
                    {user.email}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {statusBadge.desc}
              </p>
            </div>

            <button
              onClick={() => navigate("/perfil")}
              className="text-muted-foreground transition-colors hover:text-primary"
              title="Abrir perfil"
              disabled={loading}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/minhas-campanhas")}
              disabled={loading}
              className="rounded-xl bg-gradient-neon py-3 text-xs font-semibold text-primary-foreground transition-all glow-blue"
            >
              Ir para minhas campanhas
            </button>

            <button
              onClick={() => navigate("/minhas-candidaturas")}
              disabled={loading}
              className="rounded-xl border border-border/50 bg-card/60 py-3 text-xs font-semibold text-foreground transition-colors hover:bg-card"
            >
              Ver histórico
            </button>
          </div>
        </motion.div>

        {/* BENEFÍCIOS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="space-y-3"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            O que você ganha aqui
          </p>

          <div className="grid grid-cols-1 gap-3">
            {benefits.map((b) => (
              <div key={b.title} className="glass-card-hover flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-neon-subtle">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* COMO FUNCIONA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="space-y-3"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Como funciona
          </p>

          <div className="space-y-2">
            {steps.map((s, i) => (
              <motion.button
                type="button"
                key={s.n}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.24 + i * 0.06 }}
                onClick={s.action}
                disabled={loading}
                className="glass-card-hover flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card/60">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Passo {s.n}
                  </p>
                  <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ATALHOS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="space-y-3"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Atalhos
          </p>

          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((qa) => (
              <button
                key={qa.title}
                onClick={() => navigate(qa.route)}
                disabled={loading}
                className="glass-card-hover group flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-neon-subtle">
                  <qa.icon className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{qa.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{qa.desc}</p>
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </MobileLayout>
  );
};

export default InfluencerDashboard;