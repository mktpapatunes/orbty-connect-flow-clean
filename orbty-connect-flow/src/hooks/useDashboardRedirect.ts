import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns the correct dashboard path based on user role and approval status.
 * Also provides a `redirectToDashboard` function for post-login/signup use.
 */
export const useDashboardRedirect = () => {
  const navigate = useNavigate();
  const { userRole, approvalStatus, isAdmin, session, profile } = useAuth();

  const getDashboardPath = useCallback((): string | null => {
    // Admin always takes priority
    if (isAdmin) return "/admin";

    // Still loading — don't redirect anywhere yet
    if (approvalStatus === undefined && userRole === undefined) return null;

    if (approvalStatus === "pending") return "/aguardando-aprovacao";
    if (approvalStatus === "rejected") return "/conta-rejeitada";

    // Fallback: alguns ambientes não retornam role via user_roles/RPC.
    // Quando isso acontece, usamos o que estiver salvo no profile.
    const desiredRole = (profile as any)?.desired_role as
      | "contractor"
      | "influencer"
      | "admin"
      | undefined;

    const roleToUse = userRole ?? desiredRole ?? null;

    if (roleToUse === "contractor") return "/dashboard-contratante";
    if (roleToUse === "influencer") return "/dashboard-influenciadora";

    // Session exists but no role/profile → incomplete
    return null;
  }, [userRole, approvalStatus, isAdmin, profile]);

  const redirectToDashboard = useCallback(() => {
    const path = getDashboardPath();
    console.log("AUTH_REDIRECT", { path, userRole, approvalStatus, isAdmin, hasSession: !!session });
    if (path) {
      navigate(path, { replace: true });
    }
    // If path is null, do nothing — data is still loading
  }, [navigate, getDashboardPath, userRole, approvalStatus, isAdmin, session]);

  return { getDashboardPath, redirectToDashboard };
};
