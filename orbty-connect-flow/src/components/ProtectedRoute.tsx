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

  // role fallback completo: userRole -> profile.desired_role -> session metadata
  const roleFromUserRole = sanitizeRole(userRole);
  const roleFromProfile = sanitizeRole((profile as any)?.desired_role);
  const roleFromMeta = sanitizeRole((session?.user as any)?.user_metadata?.role);

  const roleToUse: AppRole | null =
    roleFromUserRole ?? roleFromProfile ?? roleFromMeta ?? null;

  if (loading || !authReady) {
    return (
      <div className="mobile-container flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly) {
    if (!(isAdmin || roleToUse === "admin")) return <Navigate to="/login" replace />;
    return <>{children}</>;
  }

  if (isAdmin || roleToUse === "admin") {
    return <>{children}</>;
  }

  if (profile === undefined) {
    return (
      <div className="mobile-container flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (profile === null) {
    return <Navigate to="/escolha-perfil" replace />;
  }

  if (approvalStatus === undefined) {
    return (
      <div className="mobile-container flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (requireApproval && approvalStatus === "pending") {
    return <Navigate to="/aguardando-aprovacao" replace />;
  }

  if (requireApproval && approvalStatus === "rejected") {
    return <Navigate to="/conta-rejeitada" replace />;
  }

  // Sessão existe, mas role ainda não veio válido -> manda para escolha de perfil (não para login)
  if (!roleToUse) {
    return <Navigate to="/escolha-perfil" replace />;
  }

  if (requiredRole && roleToUse !== requiredRole) {
    if (roleToUse === "contractor") return <Navigate to="/dashboard-contratante" replace />;
    if (roleToUse === "influencer") return <Navigate to="/dashboard-influenciadora" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;