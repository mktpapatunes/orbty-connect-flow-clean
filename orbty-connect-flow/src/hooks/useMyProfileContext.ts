import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MyProfileContext = {
  role: string;
  profile: any;
  organization: any | null;
  organization_metrics: any | null;
  instagram: any | null;
  influencer_metrics: any | null;
};

type State =
  | { loading: true; error: null; data: null }
  | { loading: false; error: string; data: null }
  | { loading: false; error: null; data: MyProfileContext };

export function useMyProfileContext() {
  const [state, setState] = useState<State>({ loading: true, error: null, data: null });

  const aliveRef = useRef(true);

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.rpc("get_my_profile_context" as any);

    if (!aliveRef.current) return;

    if (error) {
      setState({ loading: false, error: error.message, data: null });
      return;
    }

    setState({ loading: false, error: null, data: data as MyProfileContext });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    refetch();
    return () => {
      aliveRef.current = false;
    };
  }, [refetch]);

  return { ...state, refetch };
}