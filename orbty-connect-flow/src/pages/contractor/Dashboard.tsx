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
  BarChart3,
  CalendarCheck,
  ShieldCheck,
  TrendingUp,
  LineChart,
  Zap,
} from "lucide-react";

import HeroCarousel from "@/components/dashboard/HeroCarousel";
import BannersCarousel from "@/components/dashboard/BannersCarousel";

import {
  dashboardContractorHeroBanners,
  dashboardContractorNewsBanners,
} from "@/config/globalBanners";

const ContractorDashboard = () => {
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
        label: "Aprovado(a)",
        desc: "Você já pode criar campanhas e acompanhar as entregas.",
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
        desc: "Revise seu perfil para liberar o acesso completo à plataforma.",
        icon: BarChart3,
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

  const ctas = useMemo(() => {
    const primary =
      approvalStatus === "approved"
        ? { label: "Minhas campanhas", route: "/campanha" }
        : { label: "Ver campanhas", route: "/campanha" };

    const secondary =
      approvalStatus === "rejected"
        ? { label: "Ajustar perfil", route: "/perfil" }
        : { label: "Meu perfil", route: "/perfil" };

    return { primary, secondary };
  }, [approvalStatus]);

  const benefits = [
    {
      title: "Visibilidade e posicionamento",
      desc: "Encontre influenciadores da sua região para divulgar sua marca, evento ou produto com mais conexão local.",
      icon: TrendingUp,
    },
    {
      title: "Estratégia e resultados",
      desc: "Criação de campanha, aprovações, entregas e resultados em um só lugar.",
      icon: LineChart,
    },
    {
      title: "Segurança e controle",
      desc: "Divulgue com influenciadores verificados pela Orbty e tenha total controle sobre suas campanhas.",
      icon: ShieldCheck,
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
      navType="contractor"
    >
      <div className="space-y-6 overflow-x-hidden px-6 py-6">
        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
            Painel de marca/negócio
          </p>

          <h2 className="font-display text-2xl font-bold text-foreground">
            Olá, <span className="text-gradient-neon">{firstName}</span>
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A Orbty conecta sua marca/negócio a criadores de conteúdo da sua região. Aqui você divulga campanhas, produtos, músicas ou eventos
            para o público local — tudo dentro da plataforma.
          </p>
        </motion.div>

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <HeroCarousel
            banners={dashboardContractorHeroBanners}
            autoPlay
            autoPlayInterval={5000}
          />
        </motion.div>

        {/* STATUS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Seu status
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadge.className}`}
                >
                  <statusBadge.icon className="h-3 w-3" />
                  {statusBadge.label}
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {statusBadge.desc}
              </p>
            </div>

            <button
              onClick={() => navigate("/perfil")}
              className="text-muted-foreground hover:text-primary"
              disabled={loading}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate(ctas.primary.route)}
              disabled={loading}
              className="rounded-xl bg-gradient-neon py-3 text-xs font-semibold text-primary-foreground glow-blue"
            >
              {ctas.primary.label}
            </button>

            <button
              onClick={() => navigate(ctas.secondary.route)}
              disabled={loading}
              className="rounded-xl border border-border/50 bg-card/60 py-3 text-xs font-semibold text-foreground hover:bg-card"
            >
              {ctas.secondary.label}
            </button>
          </div>
        </motion.div>

        {/* BENEFÍCIOS DA ORBTY */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
            Benefícios da Orbty
          </p>

          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 + i * 0.05 }}
                className="glass-card-hover w-[78%] shrink-0 rounded-3xl px-4 py-5"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-neon-subtle shadow-[0_0_24px_hsl(var(--primary)/0.15)]">
                  <b.icon className="h-6 w-6 text-primary" />
                </div>

                <h3 className="mt-2 text-sm font-semibold leading-tight text-foreground">
                  {b.title}
                </h3>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {b.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* NOVIDADES */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <BannersCarousel
            title="Novidades para sua marca"
            banners={dashboardContractorNewsBanners}
            autoPlay
            autoPlayInterval={5000}
          />
        </motion.div>
      </div>
    </MobileLayout>
  );
};

export default ContractorDashboard;