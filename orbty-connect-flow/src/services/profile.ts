import { supabase } from "@/integrations/supabase/client";

export async function updateMyInstagramStats(input: {
  instagram_username: string;
  followers_count: number;
  audience_female_pct: number;
  audience_male_pct: number;
  audience_region?: string;
}) {
  const { data, error } = await supabase.rpc("update_my_instagram_stats" as any, {
    p_instagram_username: input.instagram_username,
    p_followers_count: input.followers_count,
    p_audience_female_pct: input.audience_female_pct,
    p_audience_male_pct: input.audience_male_pct,
    p_audience_region: input.audience_region ?? null,
  });

  if (error) throw error;
  return data as string; // id do snapshot
}

export async function createMyOrganization(input: {
  name: string;
  region_city?: string;
  region_state?: string;
  business_category?: string;
  product_or_brand?: string;
  website_url?: string;
}) {
  const { data, error } = await supabase.rpc("create_my_organization" as any, {
    p_name: input.name,
    p_region_city: input.region_city ?? null,
    p_region_state: input.region_state ?? null,
    p_business_category: input.business_category ?? null,
    p_product_or_brand: input.product_or_brand ?? null,
    p_website_url: input.website_url ?? null,
  });

  if (error) throw error;
  return data as string; // org id
}