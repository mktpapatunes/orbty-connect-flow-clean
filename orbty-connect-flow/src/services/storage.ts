import { supabase } from "@/integrations/supabase/client";

/**
 * Gera nome de arquivo com timestamp para evitar cache e colisão.
 */
function buildFileName(originalName: string) {
  const clean = originalName.replace(/[^\w.-]/g, "_");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${ts}_${clean}`;
}

export async function uploadAvatarAndGetPublicUrl(file: File): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Usuário não autenticado.");

  const fileName = buildFileName(file.name);
  const path = `${uid}/${fileName}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Não foi possível gerar URL pública do avatar.");
  return data.publicUrl;
}

export async function uploadOrgLogoAndGetPublicUrl(orgId: string, file: File): Promise<string> {
  const fileName = buildFileName(file.name);
  const path = `${orgId}/${fileName}`;

  const { error: upErr } = await supabase.storage
    .from("org-logos")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("org-logos").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Não foi possível gerar URL pública do logo.");
  return data.publicUrl;
}