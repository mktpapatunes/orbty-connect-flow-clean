import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/database";

function sanitizeRole(v: any): AppRole | null {
  const s = String(v ?? "").trim().toLowerCase();

  if (s === "contractor" || s === "influencer" || s === "admin") {
    return s as AppRole;
  }

  if (s === "creator") {
    return "influencer";
  }

  return null;
}

/**
 * Retorna a rota correta com base em role e approval status.
 * Também expõe redirectToDashboard para pós-login / pós-confirmação.
 */
export const useDashboardRedirect = () => {
  const navigate = useNavigate();
  const { userRole, approvalStatus, isAdmin, session, profile } = useAuth();

  const getDashboardPath = useCallback((): string | null => {
    if (isAdmin) {
      return "/admin";
    }

    // ainda carregando contexto
    if (approvalStatus === undefined && userRole === undefined && profile === undefined) {
      return null;
    }

    if (approvalStatus === "pending") {
      return "/aguardando-aprovacao";
    }

    if (approvalStatus === "rejected") {
      return "/conta-rejeitada";
    }

    const roleFromProfile = sanitizeRole((profile as any)?.desired_role);
    const roleToUse = sanitizeRole(userRole) ?? roleFromProfile ?? null;

    if (approvalStatus === "approved") {
      if (roleToUse === "contractor") {
        return "/dashboard-contratante";
      }

      if (roleToUse === "influencer") {
        return "/dashboard-influenciadora";
      }
    }

    return null;
  }, [userRole, approvalStatus, isAdmin, profile]);

  const redirectToDashboard = useCallback(() => {
    const path = getDashboardPath();

    console.log("AUTH_REDIRECT", {
      path,
      userRole,
      approvalStatus,
      isAdmin,
      hasSession: !!session,
    });

    if (path) {
      navigate(path, { replace: true });
    }
  }, [navigate, getDashboardPath, userRole, approvalStatus, isAdmin, session]);

  return { getDashboardPath, redirectToDashboard };
};