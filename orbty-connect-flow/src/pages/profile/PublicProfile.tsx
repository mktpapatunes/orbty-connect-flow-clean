import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Instagram, Loader2, MapPin, Users } from "lucide-react";

type PublicProfileRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  instagram: string | null;
  followers: string | null;
  bio: string | null;
  avatar_url: string | null;
};

const PublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfileRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      if (!id) {
        setLoading(false);
        setProfile(null);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, city, state, instagram, followers, bio, avatar_url")
        .eq("id", id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("PUBLIC_PROFILE_FETCH_ERROR", error);
        setProfile(null);
      } else {
        setProfile((data as any) ?? null);
      }

      setLoading(false);
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <MobileLayout
      title="Perfil"
      showBack
      backTo="#"
      navType="contractor"
      showNav={false}
      showHome={false}
    >
      <div className="px-6 py-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : !profile ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Perfil não encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-primary font-bold">
                      {(profile.name || "U").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-foreground truncate">
                    {profile.name}
                  </h2>

                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {profile.city}, {profile.state}
                    </span>

                    {profile.instagram && (
                      <span className="inline-flex items-center gap-1">
                        <Instagram className="w-3.5 h-3.5" />
                        @{profile.instagram.replace("@", "")}
                      </span>
                    )}

                    {profile.followers && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {profile.followers} seguidores
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {profile.bio && (
              <div className="glass-card p-4">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default PublicProfile;