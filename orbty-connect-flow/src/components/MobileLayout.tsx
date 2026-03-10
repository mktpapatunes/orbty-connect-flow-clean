import { ReactNode, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Star,
  Bell,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  read_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

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
   HELPERS
========================= */

function formatRelativeBR(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min atrás`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? "s" : ""} atrás`;

  return d.toLocaleDateString("pt-BR");
}

/* =========================
   COMPONENT
========================= */

const MobileLayout = ({
  children,
  title,

  // props legadas
  showBack,
  backTo,
  showNav = true,
  showHome,

  homeRoute,
  navType = "contractor",

  // ✅ novo comportamento global ligado por padrão
  enforceGlobalHeader = true,
}: MobileLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();

  const navItems = navType === "contractor" ? contractorNav : influencerNav;
  const isContractor = navType === "contractor";
  const isInfluencer = navType === "influencer";

  const dashboardPath =
    homeRoute ||
    (navType === "contractor"
      ? "/dashboard-contratante"
      : "/dashboard-influenciadora");

  const isDashboard =
    location.pathname === "/dashboard-contratante" ||
    location.pathname === "/dashboard-influenciadora";

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

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleBack = () => {
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

  const fetchNotifications = async () => {
    if (!user || !isInfluencer) {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("FETCH_NOTIFICATIONS_ERROR", error);
        return;
      }

      setNotifications((data || []) as NotificationRow[]);
    } catch (e) {
      console.error("FETCH_NOTIFICATIONS_EXCEPTION", e);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !isInfluencer) {
      setNotifications([]);
      return;
    }

    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isInfluencer]);

  useEffect(() => {
    if (!notificationsOpen) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [notificationsOpen]);

  const markNotificationAsRead = async (notificationId: string) => {
    if (!notificationId) return;

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              read: true,
              read_at: item.read_at || new Date().toISOString(),
            }
          : item
      )
    );

    try {
      const { error } = await supabase
        .from("notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) {
        console.error("MARK_NOTIFICATION_AS_READ_ERROR", error);
        await fetchNotifications();
      }
    } catch (e) {
      console.error("MARK_NOTIFICATION_AS_READ_EXCEPTION", e);
      await fetchNotifications();
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!user || unreadCount === 0 || notificationsBusy) return;

    setNotificationsBusy(true);

    const optimistic = notifications.map((item) =>
      item.read
        ? item
        : {
            ...item,
            read: true,
            read_at: item.read_at || new Date().toISOString(),
          }
    );

    setNotifications(optimistic);

    try {
      const ids = notifications.filter((n) => !n.read).map((n) => n.id);

      if (ids.length === 0) {
        setNotificationsBusy(false);
        return;
      }

      const { error } = await supabase
        .from("notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) {
        console.error("MARK_ALL_NOTIFICATIONS_AS_READ_ERROR", error);
        toast.error("Não foi possível marcar as notificações como lidas.");
        await fetchNotifications();
        return;
      }

      toast.success("Notificações marcadas como lidas.");
    } catch (e) {
      console.error("MARK_ALL_NOTIFICATIONS_AS_READ_EXCEPTION", e);
      toast.error("Não foi possível marcar as notificações como lidas.");
      await fetchNotifications();
    } finally {
      setNotificationsBusy(false);
    }
  };

  const handleNotificationClick = async (notification: NotificationRow) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    setNotificationsOpen(false);
    navigate(notification.link || "/minhas-campanhas");
  };

  return (
    <div className="mobile-container flex flex-col bg-background">
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

          {isInfluencer && (
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative text-muted-foreground hover:text-primary transition-colors"
              title="Notificações"
              aria-label="Notificações"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border border-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

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

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 overflow-y-auto pb-24"
      >
        {children}
      </motion.main>

      {showNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-card/90 backdrop-blur-xl border-t border-border/50">
          {isContractor ? (
            <div className="flex items-center justify-between py-2 px-4">
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

              <button
                onClick={() => navigate("/ranking")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/ranking") ? "text-primary" : "text-muted-foreground"
                }`}
                title="Ranking"
              >
                <Trophy className="w-5 h-5" />
                <span className="text-[10px] font-medium">Ranking</span>
                {isActivePath("/ranking") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>

              <button
                onClick={() => navigate("/criar-campanha")}
                className="w-12 h-12 rounded-full bg-gradient-neon glow-blue flex items-center justify-center shadow-md transition hover:scale-105 active:scale-95"
                title="Criar campanha"
              >
                <Plus className="w-6 h-6 text-primary-foreground" />
              </button>

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
            <div className="flex items-center justify-between py-2 px-4">
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

              <button
                onClick={() => navigate("/ranking")}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActivePath("/ranking") ? "text-primary" : "text-muted-foreground"
                }`}
                title="Ranking"
              >
                <Trophy className="w-5 h-5" />
                <span className="text-[10px] font-medium">Ranking</span>
                {isActivePath("/ranking") && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>

              <button
                onClick={() => navigate("/minhas-campanhas")}
                className="w-12 h-12 rounded-full bg-gradient-neon glow-blue flex items-center justify-center shadow-md transition hover:scale-105 active:scale-95"
                title="Minhas campanhas"
              >
                <Star className="w-6 h-6 text-primary-foreground" />
              </button>

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

      <AnimatePresence>
        {notificationsOpen && isInfluencer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setNotificationsOpen(false);
            }}
          >
            <div className="fixed inset-0 flex items-start justify-center p-4 pt-20">
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="w-full max-w-[520px] rounded-3xl border border-border/50 bg-background/95 shadow-2xl overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-4 border-b border-border/40">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-foreground">
                        Notificações
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {unreadCount > 0
                          ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`
                          : "Tudo em dia"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={markAllNotificationsAsRead}
                        disabled={unreadCount === 0 || notificationsBusy}
                        className="rounded-2xl border border-border/50 bg-card/60 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-card/80 transition disabled:opacity-60"
                      >
                        {notificationsBusy ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Salvando...
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <CheckCheck className="w-4 h-4" />
                            Marcar todas
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-[70vh] overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <div className="text-sm text-muted-foreground">
                        Você ainda não tem notificações.
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {notifications.map((notification) => {
                        const isUnread = !notification.read;
                        const campaignTitle = String(
                          notification.metadata?.campaign_title || ""
                        ).trim();

                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left px-5 py-4 transition ${
                              isUnread
                                ? "bg-primary/5 hover:bg-primary/10"
                                : "hover:bg-card/60"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="pt-1">
                                <div
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    isUnread ? "bg-primary" : "bg-border"
                                  }`}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-foreground">
                                      {notification.title}
                                    </div>

                                    <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                      {notification.message}
                                    </div>

                                    {campaignTitle ? (
                                      <div className="mt-2 text-xs text-primary font-medium truncate">
                                        Campanha: {campaignTitle}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                                    {formatRelativeBR(notification.created_at)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileLayout;