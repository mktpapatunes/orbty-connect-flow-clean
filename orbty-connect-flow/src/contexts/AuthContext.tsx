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
  const sRaw = String(v ?? "").trim().toLowerCase();

  const s = sRaw === "contract" ? "contractor" : sRaw;

  if (s === "contractor" || s === "influencer" || s === "admin") return s as AppRole;
  if (s === "creator") return "influencer";
  return null;
}

function sanitizeApproval(v: any): ApprovalStatus | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s as ApprovalStatus;
  return null;
}

function inferRoleFromProfile(p?: unknown): AppRole | null {
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

  profile: Profile | null | undefined;
  userRole: AppRole | null | undefined;
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
      companyName?: string;
      jobTitle?: string;
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
  const sessionRef = useRef<Session | null>(null);

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [userRole, setUserRole] = useState<AppRole | null | undefined>(undefined);
  const [rpcApprovalStatus, setRpcApprovalStatus] = useState<ApprovalStatus | null | undefined>(
    undefined
  );

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const mountedRef = useRef(true);
  const registeringRef = useRef(false);
  const authReadyRef = useRef(false);

  const roleFromSession = inferRoleFromSession(session);
  const roleToUse: AppRole | null | undefined = userRole !== undefined ? userRole : roleFromSession;

  const isAdmin = roleToUse === "admin";

  const approvalStatus: ApprovalStatus | undefined = isAdmin
    ? "approved"
    : rpcApprovalStatus ?? inferApprovalFromProfile(profile) ?? undefined;

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

  const fetchUserData = useCallback(async (userId: string, currentSession?: Session | null) => {
    if (!userId) return;
    if (!mountedRef.current) return;

    try {
      const sess = currentSession ?? sessionRef.current;
      const roleFromSess = inferRoleFromSession(sess);

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

          if (mountedRef.current && approvalFromRpc) {
            setRpcApprovalStatus(approvalFromRpc);
          }
        }
      } catch (e) {
        console.error("get_my_context exception:", e);
      }

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
        const finalRole = roleFromRpc ?? roleFromSess ?? roleFromProfile ?? null;
        setUserRole(finalRole);

        setRpcApprovalStatus((prev) => prev ?? approvalFromRpc ?? inferApprovalFromProfile(p));
        return;
      }

      setProfile(null);
      setUserRole(roleFromRpc ?? roleFromSess ?? null);
      setRpcApprovalStatus((prev) => prev ?? approvalFromRpc ?? null);
    } catch (e) {
      console.error("fetchUserData exception:", e);
      if (mountedRef.current) {
        setProfile(null);
        setUserRole(inferRoleFromSession(currentSession ?? sessionRef.current));
      }
    }
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;
      if (event === "INITIAL_SESSION") return;

      setSession(newSession);
      sessionRef.current = newSession;

      if (event === "TOKEN_REFRESHED") {
        if (newSession?.user && (profile === undefined || userRole === undefined)) {
          fetchUserData(newSession.user.id, newSession).catch(() => {});
        }
        return;
      }

      if (!newSession) {
        clearUserState();
        return;
      }

      if (newSession.user && !registeringRef.current) {
        setProfile(undefined);
        setUserRole(undefined);
        setRpcApprovalStatus(undefined);
        setAuthReady(false);
        setLoading(true);

        fetchUserData(newSession.user.id, newSession)
          .catch((e) => console.error("onAuthStateChange fetchUserData error:", e))
          .finally(() => finalizeLoading());
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
        sessionRef.current = data.session;

        if (data.session?.user) {
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
  }, [finalizeLoading, clearUserState]);

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
            company_name: profileData.companyName,
            job_title: profileData.jobTitle,
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

      if (!authData.session) {
        localStorage.setItem(
          "orbty_pending_registration",
          JSON.stringify({ email: profileData.email, role, profile: profileData })
        );
        return { needsEmailConfirmation: true };
      }

      setSession(authData.session);
      sessionRef.current = authData.session;
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
      sessionRef.current = null;
      clearUserState();
      localStorage.removeItem("orbty_desired_role");
      window.location.replace("/welcome");
    }
  };

  const refreshProfile: AuthContextType["refreshProfile"] = async () => {
    const sess = sessionRef.current;
    if (!sess?.user) return;
    await fetchUserData(sess.user.id, sess);
  };

  useEffect(() => {
    console.log("AUTH_STATE", {
      authReady,
      loading,
      role: roleToUse,
      roleRaw: userRole,
      roleFromSession,
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
        userRole: roleToUse,
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