import { useState } from "react";
import { motion } from "framer-motion";
import { Ticket, Plus, ToggleLeft, ToggleRight, Loader2, Copy, Check } from "lucide-react";
import type { InviteCode } from "@/hooks/useAdminData";

interface AdminInviteCodesProps {
  codes: InviteCode[];
  isLoading: boolean;
  onCreateCode: (code: string) => Promise<void>;
  onToggleCode: (id: string, isActive: boolean) => Promise<void>;
}

const AdminInviteCodes = ({
  codes,
  isLoading,
  onCreateCode,
  onToggleCode,
}: AdminInviteCodesProps) => {
  const [newCode, setNewCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newCode.trim()) return;
    setIsCreating(true);
    await onCreateCode(newCode);
    setNewCode("");
    setIsCreating(false);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Create new code */}
      <div className="glass-card p-4 sm:p-5 space-y-4 w-full overflow-hidden">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Criar novo código
        </h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Ex: ORBTY2025"
            maxLength={20}
            className="flex-1 px-4 py-3 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-mono tracking-wider w-full min-w-0"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCreate}
            disabled={!newCode.trim() || isCreating}
            className="px-5 py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Criar
          </motion.button>
        </div>
      </div>

      {/* Code list */}
      {codes.length === 0 ? (
        <div className="py-16 text-center">
          <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Nenhum código de convite criado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 w-full">
          {codes.map((code, i) => (
            <motion.div
              key={code.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-card p-4 flex items-center gap-3 sm:gap-4 w-full overflow-hidden"
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                code.is_active ? "bg-primary/10" : "bg-secondary/50"
              }`}>
                <Ticket className={`w-4 h-4 ${code.is_active ? "text-primary" : "text-muted-foreground"}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-mono text-xs sm:text-sm font-semibold tracking-wider truncate ${
                  code.is_active ? "text-foreground" : "text-muted-foreground line-through"
                }`}>
                  {code.code}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(code.created_at).toLocaleDateString("pt-BR")}
                  <span className="ml-2">
                    {code.is_active ? "· Ativo" : "· Inativo"}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(code.code, code.id)}
                  className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
                  title="Copiar código"
                >
                  {copiedId === code.id ? (
                    <Check className="w-4 h-4 text-accent" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onToggleCode(code.id, code.is_active)}
                  className={`p-2 rounded-lg transition-colors ${
                    code.is_active
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  title={code.is_active ? "Desativar" : "Ativar"}
                >
                  {code.is_active ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminInviteCodes;
