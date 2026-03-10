import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Trophy, Star, Building2, Users } from "lucide-react";

type RankingTab = "creators" | "businesses";

type CreatorProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type InfluencerRatingSummary = {
  influencer_id: string;
  rating_count: number | null;
};

type ParticipantRow = {
  influencer_id: string;
  approved_at: string | null;
};

type Organization = {
  id: string;
  created_by: string;
  name: string;
  logo_url: string | null;
};

type OrganizationRatingSummary = {
  organization_id: string;
  rating_count: number | null;
};

type CampaignRow = {
  created_by: string;
  completed_at: string | null;
};

type RankingCardItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  completedCount: number;
  reviewCount: number;
};

const AvatarFallback = ({ name }: { name: string }) => {
  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="w-14 h-14 rounded-2xl bg-gradient-neon-subtle border border-border/50 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
      {initials || "OR"}
    </div>
  );
};

const RankingCard = ({
  item,
  index,
  icon,
}: {
  item: RankingCardItem;
  index: number;
  icon: React.ReactNode;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
      className="glass-card-hover p-4 flex items-center gap-4"
    >
      <div className="relative shrink-0">
        {item.avatarUrl ? (
          <img
            src={item.avatarUrl}
            alt={item.name}
            className="w-14 h-14 rounded-2xl object-cover border border-border/50"
          />
        ) : (
          <AvatarFallback name={item.name} />
        )}

        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-md">
          {index + 1}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {item.name}
          </h3>
          <div className="text-primary shrink-0">{icon}</div>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            {item.completedCount} concluídas
          </span>

          <span className="inline-flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-primary" />
            {item.reviewCount} avaliações
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default function Ranking() {
  const { userRole } = useAuth();
  const navType = userRole === "contractor" ? "contractor" : "influencer";

  const [activeTab, setActiveTab] = useState<RankingTab>("creators");
  const [loading, setLoading] = useState(true);
  const [creatorItems, setCreatorItems] = useState<RankingCardItem[]>([]);
  const [businessItems, setBusinessItems] = useState<RankingCardItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRanking = async () => {
      try {
        setLoading(true);
        setError(null);

        const [
          creatorsProfilesRes,
          creatorsRatingsRes,
          participantsRes,
          organizationsRes,
          organizationsRatingsRes,
          campaignsRes,
        ] = await Promise.all([
          supabase
            .from("public_profiles")
            .select("id, name, avatar_url"),
          supabase
            .from("influencer_rating_summary")
            .select("influencer_id, rating_count"),
          supabase
            .from("campaign_participants")
            .select("influencer_id, approved_at")
            .not("approved_at", "is", null),
          supabase
            .from("organizations")
            .select("id, created_by, name, logo_url"),
          supabase
            .from("organization_rating_summary")
            .select("organization_id, rating_count"),
          supabase
            .from("campaigns")
            .select("created_by, completed_at")
            .not("completed_at", "is", null),
        ]);

        if (creatorsProfilesRes.error) throw creatorsProfilesRes.error;
        if (creatorsRatingsRes.error) throw creatorsRatingsRes.error;
        if (participantsRes.error) throw participantsRes.error;
        if (organizationsRes.error) throw organizationsRes.error;
        if (organizationsRatingsRes.error) throw organizationsRatingsRes.error;
        if (campaignsRes.error) throw campaignsRes.error;

        const creatorProfiles = (creatorsProfilesRes.data ?? []) as CreatorProfile[];
        const creatorRatings = (creatorsRatingsRes.data ?? []) as InfluencerRatingSummary[];
        const participantRows = (participantsRes.data ?? []) as ParticipantRow[];

        const organizations = (organizationsRes.data ?? []) as Organization[];
        const organizationRatings = (organizationsRatingsRes.data ?? []) as OrganizationRatingSummary[];
        const campaignRows = (campaignsRes.data ?? []) as CampaignRow[];

        const creatorCompletedMap = new Map<string, number>();
        for (const row of participantRows) {
          if (!row.influencer_id) continue;
          creatorCompletedMap.set(
            row.influencer_id,
            (creatorCompletedMap.get(row.influencer_id) ?? 0) + 1
          );
        }

        const creatorRatingMap = new Map<string, number>();
        for (const row of creatorRatings) {
          creatorRatingMap.set(row.influencer_id, Number(row.rating_count ?? 0));
        }

        const creators: RankingCardItem[] = creatorProfiles
          .map((profile) => ({
            id: profile.id,
            name: profile.name,
            avatarUrl: profile.avatar_url,
            completedCount: creatorCompletedMap.get(profile.id) ?? 0,
            reviewCount: creatorRatingMap.get(profile.id) ?? 0,
          }))
          .sort((a, b) => {
            if (b.completedCount !== a.completedCount) {
              return b.completedCount - a.completedCount;
            }

            if (b.reviewCount !== a.reviewCount) {
              return b.reviewCount - a.reviewCount;
            }

            return a.name.localeCompare(b.name, "pt-BR");
          });

        const businessCompletedMap = new Map<string, number>();
        for (const row of campaignRows) {
          if (!row.created_by) continue;
          businessCompletedMap.set(
            row.created_by,
            (businessCompletedMap.get(row.created_by) ?? 0) + 1
          );
        }

        const organizationRatingMap = new Map<string, number>();
        for (const row of organizationRatings) {
          organizationRatingMap.set(row.organization_id, Number(row.rating_count ?? 0));
        }

        const businesses: RankingCardItem[] = organizations
          .map((org) => ({
            id: org.id,
            name: org.name,
            avatarUrl: org.logo_url,
            completedCount: businessCompletedMap.get(org.created_by) ?? 0,
            reviewCount: organizationRatingMap.get(org.id) ?? 0,
          }))
          .sort((a, b) => {
            if (b.completedCount !== a.completedCount) {
              return b.completedCount - a.completedCount;
            }

            if (b.reviewCount !== a.reviewCount) {
              return b.reviewCount - a.reviewCount;
            }

            return a.name.localeCompare(b.name, "pt-BR");
          });

        setCreatorItems(creators);
        setBusinessItems(businesses);
      } catch (err) {
        console.error("[Ranking] load error:", err);
        setError("Não foi possível carregar o ranking.");
      } finally {
        setLoading(false);
      }
    };

    void loadRanking();
  }, []);

  const currentItems = useMemo(
    () => (activeTab === "creators" ? creatorItems : businessItems),
    [activeTab, creatorItems, businessItems]
  );

  return (
    <MobileLayout title="Ranking" navType={navType} showBack showHome>
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Ranking <span className="text-gradient-neon">Orbty</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Descubra quem mais se destaca na plataforma e acompanhe a evolução da comunidade.
          </p>
        </motion.div>

        <div className="glass-card p-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("creators")}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "creators"
                ? "bg-gradient-neon text-primary-foreground glow-blue"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4" />
              Creators
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("businesses")}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "businesses"
                ? "bg-gradient-neon text-primary-foreground glow-blue"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Marcas/Negócios
            </span>
          </button>
        </div>

        {loading ? (
          <div className="glass-card p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando ranking...</p>
          </div>
        ) : error ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não há dados suficientes para exibir este ranking.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentItems.map((item, index) => (
              <RankingCard
                key={item.id}
                item={item}
                index={index}
                icon={
                  activeTab === "creators" ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )
                }
              />
            ))}
          </div>
        )}

        <div className="pt-1">
          <p className="text-[11px] text-center text-muted-foreground">
            Ordenado por campanhas concluídas e quantidade de avaliações.
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}