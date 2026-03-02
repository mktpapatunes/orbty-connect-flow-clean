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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MobileLayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
  backTo?: string;
  showNav?: boolean;
  showHome?: boolean;
  homeRoute?: string;
  navType?: "contractor" | "influencer";
}

/* =========================
   NAV DEFINITIONS
========================= */

const contractorNav = [
  { icon: LayoutDashboard, label: "Início", path: "/dashboard-contratante" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

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
  showBack = false,
  backTo,
  showNav = true,
  showHome = false,
  homeRoute,
  navType = "contractor",
}: MobileLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = navType === "contractor" ? contractorNav : influencerNav;
  const isContractor = navType === "contractor";

  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };

  const handleHome = () => {
    const home =
      homeRoute ||
      (navType === "contractor"
        ? "/dashboard-contratante"
        : "/dashboard-influenciadora");
    navigate(home);
  };

  const handleSignOut = async () => {
    const ok = window.confirm("Você tem certeza que deseja sair da conta?");
    if (!ok) return;

    await signOut();
    navigate("/welcome");
  };

  return (
    <div className="mobile-container flex flex-col bg-background">
      {/* =========================
          HEADER
      ========================= */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              title="Voltar"
            >
              ←
            </button>
          )}

          <h2 className="font-display font-semibold text-foreground text-lg flex-1">
            {title}
          </h2>

          {showHome && (
            <button
              onClick={handleHome}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Voltar ao dashboard"
            >
              <Home className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Sair"
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
            <div className="flex items-center justify-between py-2 px-6">
              {/* Início */}
              <button
                onClick={() => navigate("/dashboard-contratante")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  location.pathname === "/dashboard-contratante"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] font-medium">Início</span>
                {location.pathname === "/dashboard-contratante" && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>

              {/* Criar (central destacado + maior + glow pulsando + hover) */}
              <motion.button
                onClick={() => navigate("/criar-campanha")}
                title="Criar campanha"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.96 }}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(59,130,246,0.0)",
                    "0 0 18px 6px rgba(59,130,246,0.25)",
                    "0 0 0 0 rgba(59,130,246,0.0)",
                  ],
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="w-14 h-14 rounded-full bg-gradient-neon flex items-center justify-center shadow-xl"
              >
                {/* “anel” sutil para dar acabamento */}
                <span className="absolute w-14 h-14 rounded-full ring-2 ring-white/10 pointer-events-none" />
                <Plus className="w-7 h-7 text-primary-foreground" />
              </motion.button>

              {/* Perfil */}
              <button
                onClick={() => navigate("/perfil")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  location.pathname === "/perfil"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] font-medium">Perfil</span>
                {location.pathname === "/perfil" && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>
            </div>
          ) : (
            /* ===== INFLUENCER NAV (mantido) ===== */
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
                    <span className="text-[10px] font-medium">
                      {item.label}
                    </span>
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