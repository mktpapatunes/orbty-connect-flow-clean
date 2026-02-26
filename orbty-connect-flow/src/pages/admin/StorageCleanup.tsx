import { useEffect, useMemo, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Obj = {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: any;
};

async function listAllPaths(bucket: string) {
  // Lista pastas na raiz
  const { data: root, error: rootErr } = await supabase.storage.from(bucket).list("", {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (rootErr) throw rootErr;

  // No storage do Supabase, "folder" geralmente vem sem id
  const folders = (root ?? []).filter((x: any) => !x.id).map((x: any) => x.name as string);

  const paths: string[] = [];

  // Em alguns casos pode existir arquivo na raiz (raro) — vamos capturar também
  const rootFiles = (root ?? []).filter((x: any) => !!x.id).map((x: any) => x.name as string);
  for (const f of rootFiles) paths.push(f);

  // Lista arquivos dentro de cada pasta
  for (const folder of folders) {
    const { data: files, error } = await supabase.storage.from(bucket).list(folder, {
      limit: 200,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) throw error;

    for (const file of files ?? []) {
      // se vier subpasta (sem id), ignore por enquanto
      if (!(file as any).id) continue;
      paths.push(`${folder}/${(file as any).name}`);
    }
  }

  return { root: (root ?? []) as Obj[], folders, paths };
}

export default function StorageCleanup() {
  const { isAdmin } = useAuth();

  const bucket = "campaign-assets";
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const [paths, setPaths] = useState<string[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [root, setRoot] = useState<Obj[]>([]);

  const total = useMemo(() => paths.length, [paths]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await listAllPaths(bucket);
      setPaths(res.paths);
      setFolders(res.folders);
      setRoot(res.root);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao listar objetos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeAll = async () => {
    if (!isAdmin) {
      toast.error("Apenas admin pode executar limpeza.");
      return;
    }

    if (paths.length === 0) {
      toast.message("Nada para apagar.");
      return;
    }

    const confirm = window.confirm(
      `Você tem certeza? Isso vai apagar ${paths.length} arquivo(s) do bucket "${bucket}".`
    );
    if (!confirm) return;

    setRemoving(true);
    try {
      // remove em lotes (seguro)
      const chunkSize = 100;
      for (let i = 0; i < paths.length; i += chunkSize) {
        const chunk = paths.slice(i, i + chunkSize);
        const { error } = await supabase.storage.from(bucket).remove(chunk);
        if (error) throw error;
      }

      toast.success("✅ Arquivos apagados com sucesso!");
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao apagar arquivos.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <MobileLayout title="Storage Cleanup" showBack navType="contractor">
      <div className="px-6 py-6 space-y-4">
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Bucket alvo</div>
              <div className="text-xs text-muted-foreground">{bucket}</div>
            </div>

            <button
              onClick={refresh}
              disabled={loading || removing}
              className="px-3 py-2 rounded-xl border border-border/50 bg-card/60 text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
              <div className="text-xs text-muted-foreground">Pastas encontradas</div>
              <div className="mt-2 text-xl font-semibold text-foreground">{folders.length}</div>
            </div>
            <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
              <div className="text-xs text-muted-foreground">Arquivos encontrados</div>
              <div className="mt-2 text-xl font-semibold text-foreground">{total}</div>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <p>
              Esta tela é temporária. Use apenas para apagar os arquivos de teste do bucket antigo.
              Depois de limpar, você pode excluir o bucket no dashboard.
            </p>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">Ações</div>

            <button
              onClick={removeAll}
              disabled={loading || removing || total === 0 || !isAdmin}
              className="px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Apagar tudo
            </button>
          </div>

          {!isAdmin && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Você não está como admin. Entre com uma conta admin para executar.
            </div>
          )}

          {total === 0 && !loading && (
            <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              Bucket já está vazio.
            </div>
          )}

          {total > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">Prévia (até 20):</div>
              <div className="space-y-2">
                {paths.slice(0, 20).map((p) => (
                  <div key={p} className="rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
                    {p}
                  </div>
                ))}
              </div>
              {paths.length > 20 && (
                <div className="text-[10px] text-muted-foreground">+ {paths.length - 20} arquivo(s) não exibidos.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}