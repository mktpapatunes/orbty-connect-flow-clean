import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  Clock,
  User,
  Home,
  LogOut,
  Trophy,
  Settings,
  Orbit,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MobileLayoutProps {
  children: ReactNode;
  title?: ReactNode;

  /**
   * Props legadas. Com enforceGlobalHeader=true (padrão),
   * elas são ignoradas para back/home.
   */
  showBack?: boolean;

  /**
   * Mantido por compatibilidade, mas NÃO é usado no botão voltar.
   * (Voltar deve ser SEMPRE navigate(-1).)
   */
  backTo?: string;

  showNav?: boolean;
  showHome?: boolean;

  homeRoute?: string;
  navType?: "contractor" | "influencer";

  /**
   * ✅ NOVO (padrão true):
   * Força o comportamento global:
   * - back + home em todas as telas exceto dashboards
   * - back sempre navigate(-1)
   */
  enforceGlobalHeader?: boolean;
}

/* =========================
   NAV DEFINITIONS (legacy / optional)
========================= */

const contractorNav = [
  { icon: LayoutDashboard, label: "Início", path: "/dashboard-contratante" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

// legado (não usado no bottom nav atual do influencer)
const influencerNav = [
  { icon: LayoutDashboard, label: "Início", path: "/dashboard-influenciadora" },
  { icon: Clock, label: "Candidaturas", path: "/minhas-candidaturas" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

/* =========================
   COMPONENT
========================= */

const MobileLayout = ({
  children,
  title,

  // props legadas
  showBack,
  backTo, // mantido apenas para não quebrar chamadas existentes (ignorado no voltar)
  showNav = true,
  showHome,

  homeRoute,
  navType = "contractor",

  // ✅ novo comportamento global ligado por padrão
  enforceGlobalHeader = true,
}: MobileLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = navType === "contractor" ? contractorNav : influencerNav;
  const isContractor = navType === "contractor";
  const isInfluencer = navType === "influencer";

  const dashboardPath =
    homeRoute ||
    (navType === "contractor"
      ? "/dashboard-contratante"
      : "/dashboard-influenciadora");

  /**
   * ✅ Regra global correta:
   * Dashboard é sempre um destes dois paths (independente de navType/homeRoute).
   * Isso evita bug de dashboard do "outro role" aparecer com seta.
   */
  const isDashboard =
    location.pathname === "/dashboard-contratante" ||
    location.pathname === "/dashboard-influenciadora";

  /**
   * ✅ Força as regras globais por padrão:
   * - back + home em todas as telas exceto dashboard
   *
   * Se enforceGlobalHeader=false:
   * mantém comportamento antigo (respeita showBack/showHome).
   */
  const shouldShowBack = enforceGlobalHeader
    ? !isDashboard
    : typeof showBack === "boolean"
      ? showBack
      : !isDashboard;

  const shouldShowHome = enforceGlobalHeader
    ? !isDashboard
    : typeof showHome === "boolean"
      ? showHome
      : !isDashboard;

  const handleBack = () => {
    // ✅ regra principal: voltar sempre para a página anterior
    navigate(-1);
  };

  const handleHome = () => {
    navigate(dashboardPath);
  };

  const handleSignOut = async () => {
    const ok = window.confirm("Você tem certeza que deseja sair da conta?");
    if (!ok) return;
    await signOut();
    navigate("/welcome");
  };

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <div className="mobile-container flex flex-col bg-background">
      {/* =========================
          HEADER
      ========================= */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          {shouldShowBack && (
            <button
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              title="Voltar"
              aria-label="Voltar"
            >
              ←
            </button>
          )}

          <div className="flex-1 flex items-center min-w-0">
  {typeof title === "string" || typeof title === "number" ? (
    <h2 className="font-display font-semibold text-foreground text-lg leading-none truncate">
      {title ?? ""}
    </h2>
  ) : (
    <div className="flex items-center leading-none">
      {title ?? null}
    </div>
  )}
</div>

          {shouldShowHome && (
            <button
              onClick={handleHome}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Início"
              aria-label="Início"
            >
              <Home className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =========================
          CONTENT
      ========================= */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 overflow-y-auto pb-24"
      >
        {children}
      </motion.main>

      {/* =========================
          BOTTOM NAV
      ========================= */}
      {showNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-card/90 backdrop-blur-xl border-t border-border/50">
          {isContractor ? (
            /* ===== CONTRACTOR NAV ===== */
            <div className="flex items-center justify-between py-2 px-4">
              {/* Início */}
              <button
                onClick={() => navigate("/dashboard-contratante")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/dashboard-contratante")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] font-medium">Início</span>
                {isActivePath("/dashboard-contratante") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>

              {/* Ranking (inativo) */}
              <button
                type="button"
                disabled
                className="flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 text-muted-foreground opacity-60 cursor-not-allowed"
                title="Ranking (em breve)"
              >
                <Trophy className="w-5 h-5" />
                <span className="text-[10px] font-medium">Ranking</span>
              </button>

              {/* Criar (central destacado) */}
              <button
                onClick={() => navigate("/criar-campanha")}
                className="w-12 h-12 rounded-full bg-gradient-neon glow-blue flex items-center justify-center shadow-md transition hover:scale-105 active:scale-95"
                title="Criar campanha"
              >
                <Plus className="w-6 h-6 text-primary-foreground" />
              </button>

              {/* Perfil */}
              <button
                onClick={() => navigate("/perfil")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/perfil") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] font-medium">Perfil</span>
                {isActivePath("/perfil") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>

              {/* Config */}
              <button
                onClick={() => navigate("/configuracoes")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/configuracoes")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                title="Configurações"
              >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-medium">Config</span>
                {isActivePath("/configuracoes") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>
            </div>
          ) : isInfluencer ? (
            /* ===== INFLUENCER NAV ===== */
            <div className="flex items-center justify-between py-2 px-4">
              {/* Início */}
              <button
                onClick={() => navigate("/dashboard-influenciadora")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/dashboard-influenciadora")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] font-medium">Início</span>
                {isActivePath("/dashboard-influenciadora") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>

              {/* Ranking (inativo) */}
              <button
                type="button"
                disabled
                className="flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 text-muted-foreground opacity-60 cursor-not-allowed"
                title="Ranking (em breve)"
              >
                <Trophy className="w-5 h-5" />
                <span className="text-[10px] font-medium">Ranking</span>
              </button>

              {/* Minhas Campanhas */}
              <button
                onClick={() => navigate("/minhas-campanhas")}
                className="w-12 h-12 rounded-full bg-gradient-neon glow-blue flex items-center justify-center shadow-md transition hover:scale-105 active:scale-95"
                title="Minhas campanhas"
              >
                <Star className="w-4 h-4 />
              </button>

              {/* Perfil */}
              <button
                onClick={() => navigate("/perfil")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/perfil") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] font-medium">Perfil</span>
                {isActivePath("/perfil") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>

              {/* Config */}
              <button
                onClick={() => navigate("/configuracoes")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/configuracoes")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                title="Configurações"
              >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-medium">Config</span>
                {isActivePath("/configuracoes") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>
            </div>
          ) : (
            /* fallback */
            <div className="flex items-center justify-around py-2 px-4">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="w-1 h-1 rounded-full bg-primary"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      )}
    </div>
  );
};

export default MobileLayout;