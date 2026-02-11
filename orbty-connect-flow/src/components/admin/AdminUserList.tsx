import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Instagram,
  MapPin,
  Users,
  Ticket,
  Sparkles,
  Megaphone,
  UserCheck,
  UserX,
  Loader2,
} from "lucide-react";
import type { AdminUser } from "@/hooks/useAdminData";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "text-warning", icon: Clock },
  approved: { label: "Aprovado", color: "text-neon-cyan", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", color: "text-destructive", icon: XCircle },
};

interface AdminUserListProps {
  users: AdminUser[];
  isLoading: boolean;
  showActions: boolean;
  onApprove?: (userId: string) => void;
  onReject?: (userId: string) => void;
  onSetRole?: (userId: string, role: "admin" | "contractor" | "influencer") => void;
  currentUserId?: string;
  emptyMessage: string;
  emptyDescription?: string;
}

const AdminUserList = ({
  users,
  isLoading,
  showActions,
  onApprove,
  onReject,
  onSetRole,
  currentUserId,
  emptyMessage,
  emptyDescription,
}: AdminUserListProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const sorted = [...users].sort((a, b) => {
    if (a.has_invite_code && !b.has_invite_code) return -1;
    if (!a.has_invite_code && b.has_invite_code) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (sorted.length === 0) {
    return (
      <div className="py-16 text-center">
        <Users className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {emptyDescription && (
          <p className="text-xs text-muted-foreground/60 mt-1">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 w-full">
      {sorted.map((user, i) => {
        const status = statusConfig[user.approval_status] || statusConfig.pending;
        const StatusIcon = status.icon;
        const isInfluencer = user.role === "influencer";
        const dateStr = new Date(user.created_at).toLocaleDateString("pt-BR");

        return (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card p-4 sm:p-5 space-y-3 w-full overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-neon-subtle flex items-center justify-center shrink-0">
                  {isInfluencer ? (
                    <Sparkles className="w-4 h-4 text-primary" />
                  ) : (
                    <Megaphone className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground text-sm truncate">{user.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {isInfluencer ? "Influenciadora" : user.role === "contractor" ? "Contratante" : user.role || "Sem role"}
                    <span className="ml-2 opacity-60">· {dateStr}</span>
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-1 shrink-0 ${status.color}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:text-xs font-medium">{status.label}</span>
              </div>
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
              {user.instagram && (
                <span className="flex items-center gap-1 truncate max-w-[160px] sm:max-w-none">
                  <Instagram className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user.instagram}</span>
                </span>
              )}
              {user.city && user.state && (
                <span className="flex items-center gap-1 truncate max-w-[140px] sm:max-w-none">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user.city}, {user.state}</span>
                </span>
              )}
              {user.followers && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 shrink-0" />
                  {user.followers}
                </span>
              )}
            </div>

            {/* Invite code badge */}
            {user.has_invite_code && (
              <div className="flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-[10px] font-medium text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                  Código de convite · Prioridade
                </span>
              </div>
            )}

            {/* Actions */}
            {showActions && user.approval_status === "pending" && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                <button
                  onClick={() => onApprove?.(user.id)}
                  className="py-2.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/20 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Aprovar
                </button>
                <button
                  onClick={() => onReject?.(user.id)}
                  className="py-2.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-destructive/20 transition-colors"
                >
                  <UserX className="w-3.5 h-3.5" />
                  Rejeitar
                </button>
              </div>
            )}

            {/* Role management */}
            {onSetRole && user.id !== currentUserId && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
                {user.role !== "admin" ? (
                  <button
                    onClick={() => onSetRole(user.id, "admin")}
                    className="flex-1 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                  >
                    Promover a Admin
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onSetRole(user.id, "contractor")}
                      className="flex-1 py-2 rounded-lg bg-secondary/50 text-foreground text-xs font-semibold hover:bg-secondary/70 transition-colors"
                    >
                      Rebaixar p/ Contractor
                    </button>
                    <button
                      onClick={() => onSetRole(user.id, "influencer")}
                      className="flex-1 py-2 rounded-lg bg-secondary/50 text-foreground text-xs font-semibold hover:bg-secondary/70 transition-colors"
                    >
                      Rebaixar p/ Influencer
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default AdminUserList;
