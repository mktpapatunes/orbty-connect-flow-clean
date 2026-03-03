import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronDown,
  HelpCircle,
  Search,
  Mail,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

type Audience = "all" | "contractor" | "influencer";

type FAQRow = {
  id: string;
  question: string;
  answer: string;
  audience: Audience;
  sort_order: number;
  is_active: boolean;
};

const FALLBACK_FAQ: FAQRow[] = [
  {
    id: "fallback-1",
    question: "O que é o Orbty?",
    answer:
      "O Orbty conecta creators regionais a campanhas de empresas locais. Você acompanha briefing, entregas e status dentro de cada campanha.",
    audience: "all",
    sort_order: 10,
    is_active: true,
  },
  {
    id: "fallback-2",
    question: "Como funciona para creators?",
    answer:
      "Você recebe convites, confirma participação e acompanha entregas dentro da campanha. Tudo aparece em “Minhas campanhas”.",
    audience: "influencer",
    sort_order: 20,
    is_active: true,
  },
  {
    id: "fallback-3",
    question: "Como funciona para Marca/Negócios?",
    answer:
      "Você cria campanhas, acompanha participações e aprova entregas dentro de cada campanha.",
    audience: "contractor",
    sort_order: 20,
    is_active: true,
  },
];

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function buildWhatsAppLink(phoneE164: string, message: string) {
  const text = encodeURIComponent(message);
  // wa.me exige número em formato internacional sem +
  const number = phoneE164.replace("+", "").replace(/\D/g, "");
  return `https://wa.me/${number}?text=${text}`;
}

export default function FAQ() {
  const { user, userRole } = useAuth();

  // ===== Config de contato (ajuste com seus dados reais) =====
  const SUPPORT_EMAIL = "suporte@orbty.com"; // <-- troque
  const SUPPORT_WHATSAPP_E164 = "+55XXXXXXXXXXX"; // <-- troque (ex: +5511999999999)
  const SUPPORT_MESSAGE = `Olá! Preciso de ajuda no Orbty. Meu email: ${user?.email ?? "-"}`;

  const [items, setItems] = useState<FAQRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [audience, setAudience] = useState<Audience>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // define audience padrão baseado na role (sem travar usuário: ele pode trocar)
  useEffect(() => {
    if (userRole === "contractor") setAudience("contractor");
    else if (userRole === "influencer") setAudience("influencer");
    else setAudience("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  async function fetchFaq(initial = false) {
    if (initial) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("faq_items")
        .select("id,question,answer,audience,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("FAQ_FETCH_ERROR", error);
        setItems(FALLBACK_FAQ);
        return;
      }

      const cleaned = ((data || []) as any[]).filter((x) => x?.question && x?.answer);
      setItems(cleaned as FAQRow[]);
    } catch (e) {
      console.error("FAQ_FETCH_EXCEPTION", e);
      setItems(FALLBACK_FAQ);
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchFaq(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleTabs = useMemo(() => {
    const tabs: { key: Audience; label: string }[] = [
      { key: "all", label: "Geral" },
      { key: "influencer", label: "Creators" },
      { key: "contractor", label: "Marca/Negócios" },
    ];
    return tabs;
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);

    const byAudience = items.filter((it) => {
      if (audience === "all") return true;
      return it.audience === "all" || it.audience === audience;
    });

    if (!q) return byAudience;

    return byAudience.filter((it) => {
      const hay = normalize(`${it.question} ${it.answer}`);
      return hay.includes(q);
    });
  }, [items, audience, query]);

  const emptyStateText = useMemo(() => {
    if (!items.length) return "Nada para mostrar.";
    if (!filtered.length && query) return "Nenhum resultado para sua busca.";
    if (!filtered.length) return "Nenhuma dúvida disponível para essa categoria.";
    return "";
  }, [items.length, filtered.length, query]);

  return (
    <MobileLayout title="Ajuda & FAQ" showBack showHome navType={userRole === "contractor" ? "contractor" : "influencer"}>
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Ajuda & <span className="text-gradient-neon">FAQ</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Busque uma resposta rápida ou fale com a gente.
          </p>
        </motion.div>

        {/* Busca + refresh */}
        <div className="glass-card p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/50 bg-card/60 px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por palavra-chave…"
                className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <button
              onClick={() => fetchFaq(false)}
              className="w-10 h-10 rounded-xl border border-border/50 bg-card/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
              title="Atualizar"
              disabled={loading || refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Tabs por role */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            {roleTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setAudience(t.key)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  audience === t.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card text-muted-foreground border border-border/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <HelpCircle className="w-5 h-5" />
              <span className="text-sm">Carregando dúvidas…</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{emptyStateText}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, index) => {
              const isOpen = openId === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * index }}
                  className="glass-card-hover p-4"
                >
                  <button
                    onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold text-foreground">
                        {item.question}
                      </span>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-muted-foreground mt-3 whitespace-pre-line leading-relaxed">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Contato */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Não resolveu?
          </p>
          <h3 className="font-semibold text-foreground text-sm mt-1">
            Fale com a gente
          </h3>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Se sua dúvida não estiver aqui, você pode chamar no WhatsApp ou enviar um e-mail.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={buildWhatsAppLink(SUPPORT_WHATSAPP_E164, SUPPORT_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              className="py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-xs glow-blue transition-all flex items-center justify-center gap-2"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>

            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Ajuda no Orbty")}&body=${encodeURIComponent(SUPPORT_MESSAGE)}`}
              className="py-3 rounded-xl border border-border/50 bg-card/60 text-foreground font-semibold text-xs hover:bg-card transition-colors flex items-center justify-center gap-2"
              title="Enviar e-mail"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
          </div>

          <p className="text-[10px] text-muted-foreground mt-3">
            Dica: informe seu e-mail e o que você estava tentando fazer. Isso agiliza o suporte.
          </p>
        </motion.div>
      </div>
    </MobileLayout>
  );
}