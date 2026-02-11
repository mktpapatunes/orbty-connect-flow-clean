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
// Helpers
// ------------------------------------------------------------

async function checkInviteCodeSafe(code?: string): Promise<boolean> {
  if (!code) return false;
  try {
    const { data, error } = await (supabase.rpc as any)("validate_invite_code", { _code: code });
    if (error) {
      console.error("validate_invite_code error:", error);
      return false;
    }
    return !!data;
  } catch (e) {
    console.error("validate_invite_code exception:", e);
    return false;
  }
}

function inferRoleFromProfile(p?: unknown): AppRole | null {
  // No seu banco existe `desired_role` (mesmo que o type esteja desatualizado).
  const desired = (p as any)?.desired_role;
  if (desired === "contractor" || desired === "influencer" || desired === "admin") return desired;
  return null;
}

function inferApprovalFromProfile(p?: unknown): ApprovalStatus | null {
  const s = (p as any)?.approval_status;
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return null;
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
  const [userRole, setUserRole] = useState<AppRole | null | undefined>(undefined);
  const [rpcApprovalStatus, setRpcApprovalStatus] = useState<ApprovalStatus | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const mountedRef = useRef(true);
  const registeringRef = useRef(false);
  const authReadyRef = useRef(false);

  const isAdmin = userRole === "admin";

  // Admin bypass
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
   * Fonte de verdade:
   * - tenta RPC get_my_context (role + approval), mas NÃO depende disso
   * - SEMPRE tenta buscar o profile direto em `profiles`
   * - se role vier null, tenta inferir de `profiles.desired_role`
   */
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // 1) tenta RPC (se falhar, seguimos do mesmo jeito)
      try {
        const { data, error } = await supabase.rpc("get_my_context");
        if (error) {
          console.error("get_my_context error:", error);
        } else if (Array.isArray(data) && data.length > 0) {
          const ctx = data[0] as any;
          const role = (ctx?.role ?? null) as AppRole | null;
          const status = (ctx?.approval_status ?? null) as ApprovalStatus | null;
          if (mountedRef.current) {
            setUserRole(role);
            setRpcApprovalStatus(status);
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

      if (mountedRef.current) {
        if (profileData) {
          const p = profileData as unknown as Profile;
          setProfile(p);

          // role fallback (quando user_roles/RPC não retorna)
          setUserRole((prev) => {
            if (prev) return prev;
            return inferRoleFromProfile(p);
          });

          // approval fallback (quando RPC não retorna)
          setRpcApprovalStatus((prev) => {
            if (prev) return prev;
            return inferApprovalFromProfile(p);
          });
          return;
        }

        // Sem profile
        setProfile(null);
      }
    } catch (e) {
      console.error("fetchUserData exception:", e);
      if (mountedRef.current) setProfile(null);
    }
  }, []);

  // ------------------------------------------------------------
  // Auth lifecycle
  // ------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
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

        fetchUserData(newSession.user.id)
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
          await fetchUserData(data.session.user.id);
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
            role,
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

      await fetchUserData(authData.user.id);
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
    await fetchUserData(session.user.id);
  };

  // Debug útil
  useEffect(() => {
    console.log("AUTH_STATE", {
      authReady,
      loading,
      role: userRole,
      approval: approvalStatus,
      isAdmin,
      profileState: profile === undefined ? "undefined" : profile === null ? "null" : "object",
      hasSession: !!session,
    });
  }, [authReady, loading, userRole, approvalStatus, isAdmin, profile, session]);

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
