import { supabase } from "@/integrations/supabase/client";
import { uploadOrgLogoAndGetPublicUrl } from "@/services/storage";

export async function updateOrganizationLogoWithUpload(orgId: string, file: File) {
  const url = await uploadOrgLogoAndGetPublicUrl(orgId, file);

  // Atualiza organizations.logo_url (RLS garante que só admin/owner consegue)
  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: url })
    .eq("id", orgId);

  if (error) throw error;

  return url;
}