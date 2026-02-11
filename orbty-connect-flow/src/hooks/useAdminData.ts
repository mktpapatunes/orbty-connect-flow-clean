import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  instagram?: string;
  city?: string;
  state?: string;
  followers?: string;
  phone?: string;
  approval_status: "pending" | "approved" | "rejected" | string;
  has_invite_code: boolean;
  invite_code?: string;
  created_at: string;
  updated_at: string;
  role?: string;
}

export interface InviteCode {
  id: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export const useAdminData = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const [{ data: usersData, error: usersError }, { data: codesData, error: codesError }] =
      await Promise.all([
        supabase.rpc("admin_list_users"),
        supabase.rpc("admin_list_invite_codes"),
      ]);

    if (usersError) toast.error("Erro ao carregar usuários");
    else setUsers((usersData || []) as AdminUser[]);

    if (codesError) toast.error("Erro ao carregar códigos de convite");
    else setInviteCodes((codesData || []) as InviteCode[]);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (userId: string) => {
    const { error } = await supabase.rpc("admin_approve_user", { p_user_id: userId });
    if (error) return toast.error("Erro ao aprovar usuário");

    toast.success("Usuário aprovado!");
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, approval_status: "approved" } : u))
    );
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase.rpc("admin_reject_user", { p_user_id: userId });
    if (error) return toast.error("Erro ao rejeitar usuário");

    toast.success("Usuário rejeitado!");
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, approval_status: "rejected" } : u))
    );
  };

  const handleCreateCode = async (code: string) => {
    const { error } = await supabase.rpc("admin_create_invite_code", {
      p_code: code.toUpperCase().trim(),
    });
    if (error) {
      toast.error("Erro ao criar código");
      return;
    }

    toast.success("Código criado!");
    await fetchData();
  };

  const handleToggleCode = async (id: string, isActive: boolean) => {
    const { error } = await supabase.rpc("admin_toggle_invite_code", {
      p_code_id: id,
      p_active: !isActive,
    });
    if (error) {
      toast.error("Erro ao atualizar código");
      return;
    }

    toast.success(isActive ? "Código desativado" : "Código ativado");
    setInviteCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !isActive } : c))
    );
  };

  const handleSetRole = async (userId: string, role: "admin" | "contractor" | "influencer") => {
    const { error } = await supabase.rpc("admin_set_user_role" as any, {
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      toast.error("Erro ao alterar role");
      console.error(error);
      return;
    }
    toast.success("Role atualizada!");
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
  };

  const pendingUsers = users.filter((u) => u.approval_status === "pending");
  const approvedUsers = users.filter((u) => u.approval_status === "approved");
  const rejectedUsers = users.filter((u) => u.approval_status === "rejected");

  return {
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
    refetch: fetchData,
  };
};
