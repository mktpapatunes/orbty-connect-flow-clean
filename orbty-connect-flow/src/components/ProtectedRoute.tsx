import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/database";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requireApproval?: boolean;
  adminOnly?: boolean;
}

/** garante que nunca entra "" / lixo */
function sanitizeRole(v: any): AppRole | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "contractor" || s === "influencer" || s === "admin") return s as AppRole;
  if (s === "creator") return "influencer";
  return null;
}

const ProtectedRoute = ({
  children,
  requiredRole,
  requireApproval = true,
  adminOnly = false,
}: ProtectedRouteProps) => {
  const { session, profile, userRole, approvalStatus, isAdmin, loading, authReady } = useAuth();

  // 🔒 role fallback completo: userRole -> profile.desired_role -> session metadata
  const roleFromUserRole = sanitizeRole(userRole);
  const roleFromProfile = sanitizeRole((profile as any)?.desired_role);
  const roleFromMeta = sanitizeRole((session?.user as any)?.user_metadata?.role);

  const roleToUse: AppRole | null | undefined =
    roleFromUserRole ?? roleFromProfile ?? roleFromMeta ?? null;

  // Still loading initial auth
  if (loading || !authReady) {
    return (
      <div className="mobile-container flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Admin-only route
  if (adminOnly) {
    if (!(isAdmin || roleToUse === "admin")) return <Navigate to="/login" replace />;
    return <>{children}</>;
  }

  // Admin can access any route
  if (isAdmin || roleToUse === "admin") {
    return <>{children}</>;
  }

  // Wait for profile to load (undefined = loading, null = doesn't exist)
  if (profile === undefined) {
    return (
      <div className="mobile-container flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // No profile — user needs to register
  if (profile === null) {
    return <Navigate to="/escolha-perfil" replace />;
  }

  // Wait for approval status to load (undefined = loading)
  if (approvalStatus === undefined) {
    return (
      <div className="mobile-container flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Check approval
  if (requireApproval && approvalStatus === "pending") {
    return <Navigate to="/aguardando-aprovacao" replace />;
  }

  if (requireApproval && approvalStatus === "rejected") {
    return <Navigate to="/conta-rejeitada" replace />;
  }

  // Se por algum motivo ainda não temos role válido, não manda pro login (sessão existe).
  // Direciona pro fluxo de escolha ou tenta refresh manualmente via tela.
  if (!roleToUse) {
    return <Navigate to="/escolha-perfil" replace />;
  }

  // Check role — redirect to correct dashboard
  if (requiredRole && roleToUse !== requiredRole) {
    if (roleToUse === "contractor") return <Navigate to="/dashboard-contratante" replace />;
    if (roleToUse === "influencer") return <Navigate to="/dashboard-influenciadora" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;