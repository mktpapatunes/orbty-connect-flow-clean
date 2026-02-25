import { supabase } from "@/integrations/supabase/client";
import { uploadAvatarAndGetPublicUrl } from "@/services/storage";

export async function updateMyAvatarWithUpload(file: File) {
  const url = await uploadAvatarAndGetPublicUrl(file);

  // Atualiza SOMENTE avatar_url (os demais campos permanecem como estão hoje)
  // -> seu update_my_profile exige vários params, então pegamos o profile atual primeiro
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) throw pErr;
  if (!profile) throw new Error("Perfil não encontrado.");

  const { error } = await (supabase.rpc as any)("update_my_profile", {
    p_avatar_url: url,
    p_name: profile.name ?? null,
    p_bio: profile.bio ?? null,
    p_neighborhood: profile.neighborhood ?? null,
    p_age: profile.age ?? null,
    p_gender: profile.gender ?? null,
    p_content_style: profile.content_style ?? null,
    p_audience_gender: profile.audience_gender ? JSON.stringify(profile.audience_gender) : null,
  });

  if (error) throw error;

  return url;
}