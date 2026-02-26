import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Instagram,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  ShieldCheck,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from "recharts";

type AudienceObj = Record<string, number>;

type ProfileRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  bio: string | null;
  avatar_url: string | null;
  instagram: string | null;
  followers: string | null;
  content_style: string | null;
  audience_gender: AudienceObj | null;
  audience_age: AudienceObj | null;
  audience_cities: AudienceObj | null;
  approval_status: string | null;
};

const sum = (obj: AudienceObj) =>
  Object.values(obj).reduce((a, b) => a + Number(b), 0);

const normalize = (obj: any): AudienceObj | null => {
  if (!obj || typeof obj !== "object") return null;
  const out: AudienceObj = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
};

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSelf = user?.id === id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!id) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,name,city,state,bio,avatar_url,instagram,followers,content_style,audience_gender,audience_age,audience_cities,approval_status"
        )
        .eq("id", id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error(error);
        setProfile(null);
      } else {
        setProfile(
          data
            ? {
                ...data,
                audience_gender: normalize(data.audience_gender),
                audience_age: normalize(data.audience_age),
                audience_cities: normalize(data.audience_cities),
              }
            : null
        );
      }

      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const isVerified = profile?.approval_status === "approved";

  const openInstagram = () => {
    if (!profile?.instagram) return;
    const handle = profile.instagram.replace(/^@/, "");
    window.open(`https://instagram.com/${handle}`, "_blank");
  };

  const PIE_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--secondary))",
    "hsl(var(--muted-foreground))",
  ];

  const renderPie = (dataObj: AudienceObj | null) => {
    if (!dataObj) return null;

    const total = sum(dataObj);
    if (!total) return null;

    const data = Object.entries(dataObj).map(([k, v]) => ({
      name: k,
      value: Number(v),
      pct: ((Number(v) / total) * 100).toFixed(0),
    }));

    return (
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={70}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <MobileLayout title="Perfil público" showBack>
      <div className="px-6 py-6 space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin w-6 h-6 text-primary" />
          </div>
        ) : !profile ? (
          <p className="text-center text-muted-foreground">
            Perfil não encontrado.
          </p>
        ) : (
          <>
            {/* Se for o dono */}
            {isSelf && (
              <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5">
                <p className="text-xs text-muted-foreground">
                  Você está visualizando seu perfil como público.
                </p>
                <button
                  onClick={() => navigate("/influencer/profile")}
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Ir para edição completa
                </button>
              </div>
            )}

            {/* Header */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">
                      {profile.name}
                    </h2>
                    {isVerified && <VerifiedBadge size="sm" />}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {profile.city}, {profile.state}
                  </div>
                </div>
              </div>
            </div>

            {/* Cards rápidos */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={openInstagram}
                className="p-4 rounded-2xl border bg-card/60"
              >
                <Instagram className="w-4 h-4 text-primary" />
                <div className="text-xs mt-2">Instagram</div>
                <div className="text-sm font-semibold">
                  {profile.instagram || "—"}
                </div>
              </button>

              <div className="p-4 rounded-2xl border bg-card/60">
                <Users className="w-4 h-4 text-primary" />
                <div className="text-xs mt-2">Seguidores</div>
                <div className="text-sm font-semibold">
                  {profile.followers || "—"}
                </div>
              </div>

              <div className="p-4 rounded-2xl border bg-card/60">
                <Sparkles className="w-4 h-4 text-primary" />
                <div className="text-xs mt-2">Estilo</div>
                <div className="text-sm font-semibold">
                  {profile.content_style || "—"}
                </div>
              </div>
            </div>

            {/* Audiência */}
            <div className="glass-card p-5 space-y-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase text-muted-foreground">
                  Audiência
                </span>
              </div>

              {renderPie(profile.audience_gender)}
              {renderPie(profile.audience_age)}

              {profile.audience_cities && (
                <div className="space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">
                    Principais cidades
                  </div>
                  {Object.entries(profile.audience_cities)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between text-sm"
                      >
                        <span>{k}</span>
                        <span>{v}%</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
}