import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileRouter() {
  const navigate = useNavigate();
  const { userRole, profile, loading, authReady, approvalStatus, isAdmin } = useAuth();

  useEffect(() => {
    if (loading || !authReady) return;

    // Admin: manda para /admin (ou mantenha no /perfil-antigo se preferir)
    if (isAdmin || userRole === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    // Se ainda não tem profile, o ProtectedRoute já redireciona,
    // mas mantemos fallback defensivo
    if (profile === null) {
      navigate("/escolha-perfil", { replace: true });
      return;
    }

    // Se pending/rejected, o ProtectedRoute já lida,
    // mas deixamos defensivo
    if (approvalStatus === "pending") {
      navigate("/aguardando-aprovacao", { replace: true });
      return;
    }
    if (approvalStatus === "rejected") {
      navigate("/conta-rejeitada", { replace: true });
      return;
    }

    if (userRole === "contractor") {
      navigate("/perfil-contratante", { replace: true });
      return;
    }

    if (userRole === "influencer") {
      navigate("/perfil-influenciadora", { replace: true });
      return;
    }

    // fallback
    navigate("/welcome", { replace: true });
  }, [navigate, userRole, profile, loading, authReady, approvalStatus, isAdmin]);

  return null;
}