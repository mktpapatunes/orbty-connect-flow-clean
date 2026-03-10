import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2,
  Trophy,
  Star,
  Building2,
  Users,
  MapPin,
  Instagram,
  X,
  Medal,
  Search,
  Crown,
} from "lucide-react";

type RankingTab = "creators" | "businesses";

type CreatorProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  instagram: string | null;
};

type InfluencerRatingSummary = {
  influencer_id: string;
  avg_rating: number | string | null;
};

type ParticipantRow = {
  influencer_id: string;
  approved_at: string | null;
};

type AdminUserRow = {
  user_id: string;
};

type RankingBusinessRow = {
  id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  instagram: string | null;
  avg_rating: number | string | null;
  completed_count: number | null;
};

type RankingCardItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  completedCount: number;
  avgRating: number | null;
  city?: string | null;
  state?: string | null;
  bio?: string | null;
  instagram?: string | null;
};

const formatRating = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(1).replace(".", ",");
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
    <div className="w-16 h-16 rounded-2xl bg-gradient-neon-subtle border border-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0 shadow-sm">
      {initials || "OR"}
    </div>
  );
};

const ModalAvatarFallback = ({ name }: { name: string }) => {
  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="w-20 h-20 rounded-3xl bg-gradient-neon-subtle border border-primary/20 flex items-center justify-center text-primary font-semibold text-lg shadow-md shrink-0">
      {initials || "OR"}
    </div>
  );
};

const RankBadge = ({ index }: { index: number }) => {
  if (index === 0) {
    return (
      <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-gradient-neon text-primary-foreground flex items-center justify-center shadow-lg">
        <Crown className="w-4 h-4" />
      </div>
    );
  }

  if (index === 1 || index === 2) {
    return (
      <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shadow-md">
        <Medal className="w-4 h-4 text-primary" />
      </div>
    );
  }

  return (
    <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-card border border-border text-foreground text-[11px] font-bold flex items-center justify-center shadow-sm">
      {index + 1}
    </div>
  );
};

const RankingProfileModal = ({
  open,
  onClose,
  item,
  type,
}: {
  open: boolean;
  onClose: () => void;
  item: RankingCardItem | null;
  type: RankingTab;
}) => {
  useEffect(() => {
    if (!open) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [open]);

  if (!item) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ranking-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <motion.div
              key="ranking-modal-content"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md"
            >
              <div className="glass-card p-6 shadow-2xl border border-primary/20 max-h-[85vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="shrink-0">
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt={item.name}
                          className="w-20 h-20 rounded-3xl object-cover border border-border/50 shadow-md"
                        />
                      ) : (
                        <ModalAvatarFallback name={item.name} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="text-lg font-bold text-foreground break-words leading-tight">
                        {item.name}
                      </h3>

                      <p className="text-xs text-muted-foreground mt-1">
                        {type === "creators" ? "Creator" : "Marca / Negócio"}
                      </p>

                      {(item.city || item.state) && (
                        <div className="mt-2 inline-flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <span className="break-words">
                            {[item.city, item.state].filter(Boolean).join(" • ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shrink-0"
                    aria-label="Fechar modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                      Avaliações
                    </p>
                    <div className="flex items-center gap-1 text-foreground font-semibold">
                      <Star className="w-4 h-4 text-primary" />
                      <span>{formatRating(item.avgRating)} / 5</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                      Concluídas
                    </p>
                    <div className="flex items-center gap-1 text-foreground font-semibold">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span>{item.completedCount}</span>
                    </div>
                  </div>
                </div>

                {item.bio && (
                  <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4 mb-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      Sobre
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed break-words">
                      {item.bio}
                    </p>
                  </div>
                )}

                {item.instagram && (
                  <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      Instagram
                    </p>
                    <div className="inline-flex items-start gap-2 text-sm text-foreground max-w-full">
                      <Instagram className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="break-all">{item.instagram}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

const RankingCard = ({
  item,
  index,
  type,
  onOpenProfile,
}: {
  item: RankingCardItem;
  index: number;
  type: RankingTab;
  onOpenProfile: (item: RankingCardItem) => void;
}) => {
  const isTop3 = index < 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index }}
      className={`relative overflow-hidden rounded-3xl border p-4 flex items-center gap-4 ${
        isTop3
          ? "bg-gradient-to-br from-primary/10 via-card to-card border-primary/20 shadow-lg"
          : "bg-card/70 border-border/50"
      }`}
    >
      {isTop3 && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(120,80,255,0.12),transparent_35%)]" />
      )}

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => onOpenProfile(item)}
          className="relative block transition-transform hover:scale-[1.02] active:scale-[0.99]"
          aria-label={`Abrir perfil de ${item.name}`}
        >
          {item.avatarUrl ? (
            <img
              src={item.avatarUrl}
              alt={item.name}
              className="w-16 h-16 rounded-2xl object-cover border border-border/50 shadow-md"
            />
          ) : (
            <AvatarFallback name={item.name} />
          )}

          <RankBadge index={index} />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {item.name}
            </h3>

            {(item.city || item.state) && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {[item.city, item.state].filter(Boolean).join(" • ")}
              </p>
            )}
          </div>

          <div className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            {type === "creators" ? (
              <Users className="w-3.5 h-3.5" />
            ) : (
              <Building2 className="w-3.5 h-3.5" />
            )}
            {type === "creators" ? "Creator" : "Marca"}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Avaliações
            </p>
            <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <Star className="w-3.5 h-3.5 text-primary" />
              <span>{formatRating(item.avgRating)} / 5</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Concluídas
            </p>
            <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <span>{item.completedCount}</span>
            </div>
          </div>
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
  const [selectedItem, setSelectedItem] = useState<RankingCardItem | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadRanking = async () => {
      try {
        setLoading(true);
        setError(null);

        const [
          creatorsProfilesRes,
          creatorsRatingsRes,
          participantsRes,
          businessesRankingRes,
          adminIdsRes,
        ] = await Promise.all([
          supabase
            .from("public_profiles")
            .select("id, name, avatar_url, city, state, bio, instagram"),
          supabase
            .from("influencer_rating_summary")
            .select("influencer_id, avg_rating"),
          supabase
            .from("campaign_participants")
            .select("influencer_id, approved_at")
            .not("approved_at", "is", null),
          supabase.rpc("get_ranking_businesses"),
          supabase.rpc("get_admin_user_ids"),
        ]);

        if (creatorsProfilesRes.error) throw creatorsProfilesRes.error;
        if (creatorsRatingsRes.error) throw creatorsRatingsRes.error;
        if (participantsRes.error) throw participantsRes.error;
        if (businessesRankingRes.error) throw businessesRankingRes.error;
        if (adminIdsRes.error) throw adminIdsRes.error;

        const creatorProfiles = (creatorsProfilesRes.data ?? []) as CreatorProfile[];
        const creatorRatings = (creatorsRatingsRes.data ?? []) as InfluencerRatingSummary[];
        const participantRows = (participantsRes.data ?? []) as ParticipantRow[];
        const businessesRankingRows = (businessesRankingRes.data ?? []) as RankingBusinessRow[];
        const adminRows = (adminIdsRes.data ?? []) as AdminUserRow[];

        const adminIds = new Set(adminRows.map((row) => row.user_id));

        const creatorCompletedMap = new Map<string, number>();
        for (const row of participantRows) {
          if (!row.influencer_id) continue;
          creatorCompletedMap.set(
            row.influencer_id,
            (creatorCompletedMap.get(row.influencer_id) ?? 0) + 1
          );
        }

        const creatorRatingMap = new Map<string, number | null>();
        for (const row of creatorRatings) {
          creatorRatingMap.set(
            row.influencer_id,
            row.avg_rating === null ? null : Number(row.avg_rating)
          );
        }

        const creators: RankingCardItem[] = creatorProfiles
          .filter((profile) => !adminIds.has(profile.id))
          .map((profile) => ({
            id: profile.id,
            name: profile.name,
            avatarUrl: profile.avatar_url,
            completedCount: creatorCompletedMap.get(profile.id) ?? 0,
            avgRating: creatorRatingMap.get(profile.id) ?? null,
            city: profile.city,
            state: profile.state,
            bio: profile.bio,
            instagram: profile.instagram,
          }))
          .sort((a, b) => {
            const aRating = a.avgRating ?? -1;
            const bRating = b.avgRating ?? -1;

            if (b.completedCount !== a.completedCount) {
              return b.completedCount - a.completedCount;
            }

            if (bRating !== aRating) {
              return bRating - aRating;
            }

            return a.name.localeCompare(b.name, "pt-BR");
          });

        const businesses: RankingCardItem[] = businessesRankingRows.map((row) => ({
          id: row.id,
          name: row.name,
          avatarUrl: row.logo_url,
          completedCount: Number(row.completed_count ?? 0),
          avgRating: row.avg_rating === null ? null : Number(row.avg_rating),
          city: row.city,
          state: row.state,
          bio: row.bio,
          instagram: row.instagram,
        }));

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

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return currentItems;

    return currentItems.filter((item) => item.name.toLowerCase().includes(term));
  }, [currentItems, search]);

  return (
    <MobileLayout title="Ranking" navType={navType} showBack showHome>
      <div className="px-6 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <h2 className="font-display text-2xl font-bold text-foreground">
            Ranking <span className="text-gradient-neon">Orbty</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Acompanhe quem mais evolui na plataforma e use isso como incentivo para crescer na comunidade.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.28 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-1 shadow-lg"
        >
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(120,80,255,0.12),transparent_35%)]" />
          <div className="relative grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("creators")}
              className={`py-3 rounded-2xl text-sm font-medium transition-all ${
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
              className={`py-3 rounded-2xl text-sm font-medium transition-all ${
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.28 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Buscar ${
              activeTab === "creators" ? "creator" : "marca/negócio"
            }`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-4 rounded-2xl bg-secondary/40 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </motion.div>

        {loading ? (
          <div className="glass-card p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando ranking...</p>
          </div>
        ) : error ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum perfil encontrado para esta busca.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item, index) => (
              <RankingCard
                key={item.id}
                item={item}
                index={index}
                type={activeTab}
                onOpenProfile={setSelectedItem}
              />
            ))}
          </div>
        )}

        <div className="pt-1">
          <p className="text-[11px] text-center text-muted-foreground">
            Ordenado por campanhas concluídas e nota média do perfil.
          </p>
        </div>
      </div>

      <RankingProfileModal
        open={!!selectedItem}
        item={selectedItem}
        type={activeTab}
        onClose={() => setSelectedItem(null)}
      />
    </MobileLayout>
  );
}