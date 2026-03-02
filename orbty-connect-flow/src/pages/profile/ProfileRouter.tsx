import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileRouter() {
  const navigate = useNavigate();
  const { userRole, profile, loading, authReady, approvalStatus, isAdmin } = useAuth();

  useEffect(() => {
    if (loading || !authReady) return;

    if (isAdmin || userRole === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (profile === null) {
      navigate("/escolha-perfil", { replace: true });
      return;
    }

    if (approvalStatus === "pending") {
      navigate("/aguardando-aprovacao", { replace: true });
      return;
    }
    if (approvalStatus === "rejected") {
      navigate("/conta-rejeitada", { replace: true });
      return;
    }

    // ✅ Fallback igual ao ProtectedRoute
    const desiredRole = (profile as any)?.desired_role as "contractor" | "influencer" | "admin" | undefined;
    const roleToUse = userRole ?? desiredRole ?? null;

    if (roleToUse === "contractor") {
      navigate("/perfil-contratante", { replace: true });
      return;
    }

    if (roleToUse === "influencer") {
      navigate("/perfil-influenciadora", { replace: true });
      return;
    }

    navigate("/welcome", { replace: true });
  }, [navigate, userRole, profile, loading, authReady, approvalStatus, isAdmin]);

  return null;
}