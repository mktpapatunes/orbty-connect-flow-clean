import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import type { ApprovalStatus, AppRole, Profile } from "@/types/database";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

// ------------------------------------------------------------
// Helpers (sanitizers)
// ------------------------------------------------------------

function sanitizeRole(v: any): AppRole | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "contractor" || s === "influencer" || s === "admin") return s as AppRole;

  // alguns projetos antigos usam "creator"
  if (s === "creator") return "influencer";

  return null;
}

function sanitizeApproval(v: any): ApprovalStatus | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s as ApprovalStatus;
  return null;
}

function inferRoleFromProfile(p?: unknown): AppRole | null {
  // Fonte: profiles.desired_role
  return sanitizeRole((p as any)?.desired_role);
}

function inferApprovalFromProfile(p?: unknown): ApprovalStatus | null {
  return sanitizeApproval((p as any)?.approval_status);
}

function inferRoleFromSession(session: Session | null): AppRole | null {
  const metaRole =
    (session?.user as any)?.user_metadata?.role ??
    (session?.user as any)?.app_metadata?.role ??
    null;

  return sanitizeRole(metaRole);
}

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

interface AuthContextType {
  session: Session | null;
  user: User | null;

  // undefined = carregando
  // null = não existe
  // Profile = existe
  profile: Profile | null | undefined;

  // undefined = carregando
  // null = não tem role
  userRole: AppRole | null | undefined;

  // undefined = carregando
  approvalStatus: ApprovalStatus | undefined;

  isAdmin: boolean;
  loading: boolean;
  authReady: boolean;

  register: (
    email: string,
    password: string,
    role: "contractor" | "influencer",
    profileData: {
      name: string;
      email: string;
      phone: string;
      city: string;
      state: string;
      instagram?: string;
      followers?: string;
      inviteCode?: string;
    }
  ) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;

  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  // role/status separados, mas sempre sanitizados
  const [userRole, setUserRole] = useState<AppRole | null | undefined>(undefined);
  const [rpcApprovalStatus, setRpcApprovalStatus] = useState<ApprovalStatus | null | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const mountedRef = useRef(true);
  const registeringRef = useRef(false);
  const authReadyRef = useRef(false);

  // ✅ role defensivo (pra UI não “piscar” creator/pessoal)
  const roleFromSession = inferRoleFromSession(session);
  const roleToUse: AppRole | null | undefined =
    userRole !== undefined ? userRole : roleFromSession; // se userRole ainda não veio, usa o da sessão

  const isAdmin = roleToUse === "admin";

  // ✅ approval: admin bypass, depois RPC, depois profile
  const approvalStatus: ApprovalStatus | undefined = isAdmin
    ? "approved"
    : (rpcApprovalStatus ?? inferApprovalFromProfile(profile) ?? undefined);

  const clearUserState = useCallback(() => {
    if (!mountedRef.current) return;
    setProfile(null);
    setUserRole(null);
    setRpcApprovalStatus(null);
  }, []);

  const finalizeLoading = useCallback(() => {
    if (!mountedRef.current) return;
    setLoading(false);
    setAuthReady(true);
    authReadyRef.current = true;
  }, []);

  /**
   * Fonte de verdade de role:
   * 1) profiles.desired_role
   * 2) session.user_metadata.role
   * 3) RPC get_my_context.role (sanitizado)
   */
  const fetchUserData = useCallback(
    async (userId: string, currentSession?: Session | null) => {
      try {
        const sess = currentSession ?? session;

        // 0) role possível pela sessão (rápido)
        const roleFromSess = inferRoleFromSession(sess);

        // 1) tenta RPC (se falhar, segue)
        let roleFromRpc: AppRole | null = null;
        let approvalFromRpc: ApprovalStatus | null = null;

        try {
          const { data, error } = await supabase.rpc("get_my_context");
          if (error) {
            console.error("get_my_context error:", error);
          } else if (Array.isArray(data) && data.length > 0) {
            const ctx = data[0] as any;

            roleFromRpc = sanitizeRole(ctx?.role);
            approvalFromRpc = sanitizeApproval(ctx?.approval_status);

            if (mountedRef.current) {
              if (approvalFromRpc) setRpcApprovalStatus(approvalFromRpc);
            }
          }
        } catch (e) {
          console.error("get_my_context exception:", e);
        }

        // 2) busca profile SEMPRE
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("profiles select error:", profileError);
        }

        if (!mountedRef.current) return;

        if (profileData) {
          const p = profileData as unknown as Profile;
          setProfile(p);

          const roleFromProfile = inferRoleFromProfile(p);
          const finalRole = roleFromProfile ?? roleFromSess ?? roleFromRpc ?? null;

          setUserRole(finalRole);

          // approval fallback (se RPC não veio)
          setRpcApprovalStatus((prev) => prev ?? approvalFromRpc ?? inferApprovalFromProfile(p));

          return;
        }

        // Sem profile
        setProfile(null);

        // Mesmo sem profile, ainda tenta usar role da sessão/RPC
        setUserRole(roleFromSess ?? roleFromRpc ?? null);

        // Sem profile: deixa approval como veio do RPC (se veio)
        setRpcApprovalStatus((prev) => prev ?? approvalFromRpc ?? null);
      } catch (e) {
        console.error("fetchUserData exception:", e);
        if (mountedRef.current) {
          setProfile(null);
          setUserRole(inferRoleFromSession(currentSession ?? session)); // pelo menos metadata
        }
      }
    },
    [session]
  );

  // ------------------------------------------------------------
  // Auth lifecycle
  // ------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;
      if (event === "INITIAL_SESSION") return;

      setSession(newSession);

      if (newSession?.user && !registeringRef.current) {
        // reset to loading before fetching
        setProfile(undefined);
        setUserRole(undefined);
        setRpcApprovalStatus(undefined);
        setAuthReady(false);
        setLoading(true);

        fetchUserData(newSession.user.id, newSession)
          .catch((e) => console.error("onAuthStateChange fetchUserData error:", e))
          .finally(() => finalizeLoading());
      }

      if (!newSession) {
        clearUserState();
      }
    });

    const initializeAuth = async () => {
      const failSafeTimer = setTimeout(() => {
        if (mountedRef.current && !authReadyRef.current) {
          console.warn("AUTH_FAILSAFE: forcing authReady after timeout");
          toast.error("Não foi possível carregar seus dados. Tente novamente.");
          finalizeLoading();
        }
      }, 8000);

      try {
        const { data } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        setSession(data.session);

        if (data.session?.user) {
          // ✅ já seta role rápido pela session (evita layout errado antes do profile)
          setUserRole(inferRoleFromSession(data.session));

          await fetchUserData(data.session.user.id, data.session);
        } else {
          clearUserState();
        }
      } catch (e) {
        console.error("initializeAuth exception:", e);
        clearUserState();
      } finally {
        clearTimeout(failSafeTimer);
        finalizeLoading();
      }
    };

    initializeAuth();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData, finalizeLoading, clearUserState]);

  // ------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------

  const register: AuthContextType["register"] = async (email, password, role, profileData) => {
    registeringRef.current = true;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/login",
          data: {
            name: profileData.name,
            email: profileData.email,
            phone: profileData.phone,
            city: profileData.city,
            state: profileData.state,
            instagram: profileData.instagram,
            followers: profileData.followers,
            invite_code: profileData.inviteCode,
            role, // ✅ role SEMPRE aqui (é isso que seu trigger usa)
          },
        },
      });

      if (authError) return { error: authError.message };
      if (!authData.user) return { error: "Erro ao criar conta" };

      localStorage.removeItem("orbty_desired_role");

      // Sem session = precisa confirmar e-mail
      if (!authData.session) {
        localStorage.setItem(
          "orbty_pending_registration",
          JSON.stringify({ email: profileData.email, role, profile: profileData })
        );
        return { needsEmailConfirmation: true };
      }

      // ✅ garante role correto imediatamente (antes do profile carregar)
      setSession(authData.session);
      setUserRole(sanitizeRole(role));

      await fetchUserData(authData.user.id, authData.session);
      return {};
    } catch (e: any) {
      return { error: e?.message || "Erro desconhecido" };
    } finally {
      registeringRef.current = false;
    }
  };

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signOut: AuthContextType["signOut"] = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      clearUserState();
      localStorage.removeItem("orbty_desired_role");
      window.location.replace("/welcome");
    }
  };

  const refreshProfile: AuthContextType["refreshProfile"] = async () => {
    if (!session?.user) return;
    await fetchUserData(session.user.id, session);
  };

  // Debug útil
  useEffect(() => {
    console.log("AUTH_STATE", {
      authReady,
      loading,
      role: roleToUse,
      roleRaw: userRole,
      roleFromSession: roleFromSession,
      approval: approvalStatus,
      isAdmin,
      profileState: profile === undefined ? "undefined" : profile === null ? "null" : "object",
      hasSession: !!session,
    });
  }, [authReady, loading, roleToUse, userRole, roleFromSession, approvalStatus, isAdmin, profile, session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        userRole,
        approvalStatus,
        isAdmin,
        loading,
        authReady,
        register,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};