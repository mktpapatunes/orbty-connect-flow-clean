// src/services/campaignFiles.ts
import { supabase } from "@/integrations/supabase/client";

export type CampaignFileKind = "assets" | "deliverables";

export type CampaignFileItem = {
  kind: CampaignFileKind;
  campaignId: string;
  ownerId: string; // contractor_id ou influencer_id (folder owner)
  path: string; // full path inside bucket (without bucket name)
  name: string; // file name only
  size?: number | null;
  mimetype?: string | null;
  updated_at?: string | null;
};

const BUCKET = "campaign-files";

function safeFileName(original: string) {
  // evita nomes quebrados
  const cleaned = original
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return cleaned || "file";
}

function buildPath(params: {
  campaignId: string;
  kind: CampaignFileKind;
  ownerId: string;
  filename: string;
}) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${ts}_${safeFileName(params.filename)}`;
  // campaign-files/<campaignId>/<kind>/<ownerId>/<filename>
  return `${params.campaignId}/${params.kind}/${params.ownerId}/${filename}`;
}

export async function uploadCampaignFile(params: {
  campaignId: string;
  kind: CampaignFileKind;
  ownerId: string;
  file: File;
  upsert?: boolean;
}): Promise<{ path: string }> {
  if (!params.file) throw new Error("Arquivo inválido.");

  // hoje deixo imagem + pdf (briefing)
  if (!params.file.type?.startsWith("image/") && params.file.type !== "application/pdf") {
    throw new Error("Tipo de arquivo não permitido. Envie imagem ou PDF.");
  }

  if (params.file.size > 10 * 1024 * 1024) {
    throw new Error("Arquivo muito grande. Máximo 10MB.");
  }

  const path = buildPath({
    campaignId: params.campaignId,
    kind: params.kind,
    ownerId: params.ownerId,
    filename: params.file.name,
  });

  const { error } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    upsert: params.upsert ?? true,
    contentType: params.file.type || undefined,
    cacheControl: "3600",
  });

  if (error) throw error;

  return { path };
}

export async function listCampaignFiles(params: {
  campaignId: string;
  kind?: CampaignFileKind; // se não passar, lista tudo
}): Promise<CampaignFileItem[]> {
  const prefix = params.kind ? `${params.campaignId}/${params.kind}` : `${params.campaignId}`;

  async function listFolder(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).list(path, {
      limit: 100,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) throw error;
    return data ?? [];
  }

  const items: CampaignFileItem[] = [];

  const level1 = await listFolder(prefix); // ex: ["assets", "deliverables"] ou owners/arquivos
  for (const a of level1) {
    const l1Name = a.name;
    const l1Path = `${prefix}/${l1Name}`;

    const level2 = await listFolder(l1Path);

    if (level2.length === 0 && a.id) {
      // arquivo diretamente no prefix (não esperado)
      const parts = l1Path.split("/");
      const campaignId = parts[0];
      const kind = (parts[1] as CampaignFileKind) || "assets";
      const ownerId = parts[2] || "unknown";
      items.push({
        campaignId,
        kind,
        ownerId,
        path: l1Path,
        name: l1Name,
        size: (a as any).metadata?.size ?? null,
        mimetype: (a as any).metadata?.mimetype ?? null,
        updated_at: a.updated_at ?? null,
      });
      continue;
    }

    for (const b of level2) {
      const l2Name = b.name;
      const l2Path = `${l1Path}/${l2Name}`;

      const level3 = await listFolder(l2Path);

      if (level3.length === 0 && b.id) {
        // arquivo diretamente no owner (não esperado)
        const parts = l2Path.split("/");
        const campaignId = parts[0];
        const kind = parts[1] as CampaignFileKind;
        const ownerId = parts[2];
        items.push({
          campaignId,
          kind,
          ownerId,
          path: l2Path,
          name: l2Name,
          size: (b as any).metadata?.size ?? null,
          mimetype: (b as any).metadata?.mimetype ?? null,
          updated_at: b.updated_at ?? null,
        });
        continue;
      }

      // nível dos arquivos (owner folder)
      for (const f of level3) {
        if (!f.id) continue; // folder
        const parts = l2Path.split("/");
        const campaignId = parts[0];
        const kind = parts[1] as CampaignFileKind;
        const ownerId = parts[2];

        items.push({
          campaignId,
          kind,
          ownerId,
          path: `${l2Path}/${f.name}`,
          name: f.name,
          size: (f as any).metadata?.size ?? null,
          mimetype: (f as any).metadata?.mimetype ?? null,
          updated_at: f.updated_at ?? null,
        });
      }
    }
  }

  items.sort((x, y) => (y.updated_at || "").localeCompare(x.updated_at || ""));
  return items;
}

export async function getCampaignFileSignedUrl(params: {
  path: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(params.path, params.expiresInSeconds ?? 60 * 10);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Não foi possível gerar link do arquivo.");
  return data.signedUrl;
}

export async function deleteCampaignFile(params: { path: string }): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([params.path]);
  if (error) throw error;
}