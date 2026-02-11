import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Ticket,
  LogOut,
  Menu,
} from "lucide-react";
import NetworkBackground from "@/components/NetworkBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminData } from "@/hooks/useAdminData";
import AdminUserList from "@/components/admin/AdminUserList";
import AdminInviteCodes from "@/components/admin/AdminInviteCodes";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type AdminTab = "pending" | "approved" | "rejected" | "invites";

const sidebarItems: { key: AdminTab; label: string; icon: typeof Clock }[] = [
  { key: "pending", label: "Pendentes", icon: Clock },
  { key: "approved", label: "Aprovados", icon: CheckCircle2 },
  { key: "rejected", label: "Rejeitados", icon: XCircle },
  { key: "invites", label: "Invite Codes", icon: Ticket },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { signOut, session } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("pending");
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const {
    users,
    pendingUsers,
    approvedUsers,
    rejectedUsers,
    inviteCodes,
    isLoading,
    handleApprove,
    handleReject,
    handleCreateCode,
    handleToggleCode,
    handleSetRole,
  } = useAdminData();

  const handleLogout = async () => {
    await signOut();
    navigate("/welcome");
  };

  const getCount = (key: AdminTab) => {
    switch (key) {
      case "pending": return pendingUsers.length;
      case "approved": return approvedUsers.length;
      case "rejected": return rejectedUsers.length;
      case "invites": return inviteCodes.length;
    }
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSheetOpen(false);
  };

  const navContent = (
    <>
      {sidebarItems.map((item) => {
        const isActive = activeTab === item.key;
        const count = getCount(item.key);

        return (
          <button
            key={item.key}
            onClick={() => handleTabChange(item.key)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {count > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isActive
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <NetworkBackground />

      {/* Mobile topbar */}
      <div className="flex md:hidden items-center justify-between p-4 border-b border-border/30 bg-card/40 backdrop-blur-xl relative z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-display font-bold text-foreground text-sm">ORBTY</h1>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Painel Admin</p>
          </div>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground">
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-card/95 backdrop-blur-xl border-border/30 p-0">
            <SheetHeader className="px-6 py-5 border-b border-border/30">
              <SheetTitle className="flex items-center gap-3 text-left">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <span className="font-display font-bold text-foreground text-sm block">ORBTY</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Painel Admin</span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navContent}
            </nav>
            <div className="px-3 py-4 border-t border-border/30">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex min-h-0 relative">
        {/* Desktop sidebar */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="hidden md:flex w-64 shrink-0 border-r border-border/30 bg-card/40 backdrop-blur-xl flex-col z-10 relative md:min-h-screen"
        >
          {/* Logo */}
          <div className="px-6 py-5 border-b border-border/30">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <div>
                <h1 className="font-display font-bold text-foreground text-base">ORBTY</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Painel Admin</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navContent}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-border/30">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </motion.aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6">
            {/* Header */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                {activeTab === "pending" && (
                  <>Usuários <span className="text-gradient-neon">pendentes</span></>
                )}
                {activeTab === "approved" && (
                  <>Usuários <span className="text-gradient-neon">aprovados</span></>
                )}
                {activeTab === "rejected" && (
                  <>Usuários <span className="text-gradient-neon">rejeitados</span></>
                )}
                {activeTab === "invites" && (
                  <>Códigos de <span className="text-gradient-neon">convite</span></>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {activeTab === "pending" && "Revise e aprove ou rejeite os cadastros."}
                {activeTab === "approved" && "Usuários com acesso liberado à plataforma."}
                {activeTab === "rejected" && "Usuários rejeitados da plataforma."}
                {activeTab === "invites" && "Gerencie códigos de convite para prioridade no cadastro."}
              </p>
            </motion.div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              <div className="glass-card px-3 sm:px-4 py-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning shrink-0" />
                <span className="text-[10px] sm:text-xs text-muted-foreground">Pendentes:</span>
                <span className="font-display font-bold text-xs sm:text-sm text-foreground">{pendingUsers.length}</span>
              </div>
              <div className="glass-card px-3 sm:px-4 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0" />
                <span className="text-[10px] sm:text-xs text-muted-foreground">Aprovados:</span>
                <span className="font-display font-bold text-xs sm:text-sm text-foreground">{approvedUsers.length}</span>
              </div>
              <div className="glass-card px-3 sm:px-4 py-2 flex items-center gap-2 col-span-2 md:col-span-1">
                <Users className="w-4 h-4 text-accent shrink-0" />
                <span className="text-[10px] sm:text-xs text-muted-foreground">Total:</span>
                <span className="font-display font-bold text-xs sm:text-sm text-foreground">{users.length}</span>
              </div>
            </div>

            {/* Content */}
            {activeTab === "pending" && (
              <AdminUserList
                users={pendingUsers}
                isLoading={isLoading}
                showActions
                onApprove={handleApprove}
                onReject={handleReject}
                emptyMessage="Nenhum cadastro pendente"
                emptyDescription="Todos os usuários foram revisados."
              />
            )}

            {activeTab === "approved" && (
              <AdminUserList
                users={approvedUsers}
                isLoading={isLoading}
                showActions={false}
                onSetRole={handleSetRole}
                currentUserId={session?.user?.id}
                emptyMessage="Nenhum usuário aprovado ainda"
              />
            )}

            {activeTab === "rejected" && (
              <AdminUserList
                users={rejectedUsers}
                isLoading={isLoading}
                showActions={false}
                onSetRole={handleSetRole}
                currentUserId={session?.user?.id}
                emptyMessage="Nenhum usuário rejeitado"
              />
            )}

            {activeTab === "invites" && (
              <AdminInviteCodes
                codes={inviteCodes}
                isLoading={isLoading}
                onCreateCode={handleCreateCode}
                onToggleCode={handleToggleCode}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
