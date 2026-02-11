import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import MobileLayout from "@/components/MobileLayout";
import { Clock, CheckCircle2, MapPin, Calendar, Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface HistoryCampaign {
  id: string;
  title: string;
  type: string;
  city: string;
  state: string;
  campaign_date: string | null;
  status: string;
  created_at: string;
}

const History = () => {
  const { user, userRole } = useAuth();
  const [campaigns, setCampaigns] = useState<HistoryCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;

      if (userRole === "contractor") {
        const { data } = await supabase.rpc("get_my_campaigns" as any);
        if (data) {
          setCampaigns(
            ((data as any[]).filter((c: any) => c.status === "closed") as unknown as HistoryCampaign[])
          );
        }
      } else {
        // Influencer: show accepted campaigns
        const { data: apps } = await supabase
          .from("campaign_applications")
          .select("campaign_id")
          .eq("influencer_id", user.id)
          .eq("status", "accepted");

        if (apps && apps.length > 0) {
          const ids = (apps as any[]).map((a: any) => a.campaign_id);
          const { data: campData } = await supabase
            .from("campaigns")
            .select("*")
            .in("id", ids)
            .order("created_at", { ascending: false });

          if (campData) {
            setCampaigns(campData as unknown as HistoryCampaign[]);
          }
        }
      }
      setIsLoading(false);
    };

    fetchHistory();
  }, [user, userRole]);

  const navType = userRole === "influencer" ? "influencer" : "contractor";

  return (
    <MobileLayout title="Histórico" showBack navType={navType as "contractor" | "influencer"}>
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Campanhas <span className="text-gradient-neon">anteriores</span>
          </h2>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center">
            <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha no histórico.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="glass-card p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{campaign.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{campaign.type}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium capitalize">{campaign.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{campaign.city}, {campaign.state}</span>
                  {campaign.campaign_date && (
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{campaign.campaign_date}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default History;
