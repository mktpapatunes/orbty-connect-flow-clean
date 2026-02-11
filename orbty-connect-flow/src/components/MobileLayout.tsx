import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Clock, User, Home, LogOut } from "lucide-react";
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

const contractorNav = [
  { icon: LayoutDashboard, label: "Início", path: "/dashboard-contratante" },
  { icon: PlusCircle, label: "Criar", path: "/campanha/tipo" },
  { icon: Clock, label: "Histórico", path: "/historico" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

const influencerNav = [
  { icon: LayoutDashboard, label: "Início", path: "/dashboard-influenciadora" },
  { icon: Clock, label: "Candidaturas", path: "/minhas-candidaturas" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

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

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  const handleHome = () => {
    const home = homeRoute || (navType === "contractor" ? "/dashboard-contratante" : "/dashboard-influenciadora");
    navigate(home);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/welcome");
  };

  return (
    <div className="mobile-container flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
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

      {/* Content */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 overflow-y-auto pb-24"
      >
        {children}
      </motion.main>

      {/* Bottom Nav */}
      {showNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-card/90 backdrop-blur-xl border-t border-border/50">
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
        </nav>
      )}
    </div>
  );
};

export default MobileLayout;
