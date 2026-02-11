import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { Hourglass, CheckCircle2, XCircle, Loader2, MapPin, Calendar, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ApplicationWithCampaign {
  id: string;
  campaign_id: string;
  status: string;
  note: string | null;
  created_at: string;
  campaign_title?: string;
  campaign_type?: string;
  campaign_city?: string;
  campaign_state?: string;
  campaign_date?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Hourglass }> = {
  pending: { label: "Aguardando", color: "text-warning", icon: Hourglass },
  accepted: { label: "Aprovada", color: "text-accent", icon: CheckCircle2 },
  rejected: { label: "Não selecionada", color: "text-muted-foreground", icon: XCircle },
};

const MyApplications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!user) return;

      // Fetch applications
      const { data: apps, error } = await supabase
        .from("campaign_applications")
        .select("*")
        .eq("influencer_id", user.id)
        .order("created_at", { ascending: false });

      if (error || !apps) {
        setIsLoading(false);
        return;
      }

      // Fetch campaign details for accepted ones (via RLS) and public feed for others
      const { data: feedData } = await supabase.rpc("get_campaigns_public_feed" as any);
      const { data: acceptedData } = await supabase
        .from("campaigns")
        .select("id, title, type, city, state, campaign_date");

      const feedMap = new Map<string, any>();
      ((feedData || []) as any[]).forEach((c: any) => feedMap.set(c.id, c));
      ((acceptedData || []) as any[]).forEach((c: any) => feedMap.set(c.id, c));

      const enriched: ApplicationWithCampaign[] = (apps as any[]).map((a) => {
        const campaign = feedMap.get(a.campaign_id);
        return {
          ...a,
          campaign_title: campaign?.title || "Campanha",
          campaign_type: campaign?.type || "",
          campaign_city: campaign?.city || "",
          campaign_state: campaign?.state || "",
          campaign_date: campaign?.campaign_date,
        };
      });

      setApplications(enriched);
      setIsLoading(false);
    };

    fetchApplications();
  }, [user]);

  return (
    <MobileLayout title="Minhas candidaturas" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Suas <span className="text-gradient-neon">candidaturas</span>
          </h2>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="py-12 text-center">
            <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma candidatura enviada ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app, i) => {
              const st = statusConfig[app.status] || statusConfig.pending;
              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="glass-card-hover p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">{app.campaign_title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{app.campaign_type}</p>
                    </div>
                    <div className={`flex items-center gap-1 ${st.color}`}>
                      <st.icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{st.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {app.campaign_city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {app.campaign_city}, {app.campaign_state}
                      </span>
                    )}
                    {app.campaign_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {app.campaign_date}
                      </span>
                    )}
                  </div>

                  {app.status === "accepted" && (
                    <button
                      onClick={() => navigate(`/campanha-detalhe/${app.campaign_id}`)}
                      className="mt-3 w-full py-2.5 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ver detalhes completos
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default MyApplications;
