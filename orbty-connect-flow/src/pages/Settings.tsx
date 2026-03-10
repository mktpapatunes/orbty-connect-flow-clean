import { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  User,
  HelpCircle,
  LogOut,
  Shield,
  FolderKanban,
  Clock,
  LayoutDashboard,
  FileText,
  KeyRound,
} from "lucide-react";

type Item = {
  icon: any;
  title: string;
  desc?: string;
  route?: string;
  action?: () => void;
  disabled?: boolean;
};

export default function Settings() {
  const navigate = useNavigate();
  const { userRole, signOut } = useAuth();

  const navType = userRole === "contractor" ? "contractor" : "influencer";

  const handleSignOut = useCallback(async () => {
    const ok = window.confirm("Você tem certeza que deseja sair da conta?");
    if (!ok) return;

    await signOut();
    navigate("/welcome");
  }, [signOut, navigate]);

  const sections = useMemo(() => {
    const isInfluencer = userRole === "influencer";
    const isContractor = userRole === "contractor";

    const account: Item[] = [
      {
        icon: User,
        title: "Meu perfil",
        desc: "Dados da conta e configurações do perfil.",
        route: "/perfil",
      },

      ...(isInfluencer
        ? [
            {
              icon: FileText,
              title: "Dados pessoais",
              desc: "Informações pessoais e complementares.",
              route: "/perfil-influenciadora/dados-pessoais",
            } as Item,
          ]
        : []),

      ...(isContractor
        ? [
            {
              icon: FileText,
              title: "Dados pessoais",
              desc: "Informações de Marca/Negócios.",
              route: "/perfil-contratante/dados-pessoais",
            } as Item,
          ]
        : []),

      {
        icon: HelpCircle,
        title: "Ajuda / FAQ",
        desc: "Dúvidas frequentes e contato.",
        route: "/ajuda",
      },
    ];

    const campaigns: Item[] = [
      ...(isInfluencer
        ? [
            {
              icon: FolderKanban,
              title: "Minhas campanhas",
              desc: "Convites, entregas e status.",
              route: "/minhas-campanhas",
            } as Item,

            {
              icon: Clock,
              title: "Histórico",
              desc: "Participações aprovadas e campanhas concluídas.",
              route: "/minhas-candidaturas",
            } as Item,
          ]
        : []),

      ...(isContractor
        ? [
            {
              icon: LayoutDashboard,
              title: "Campanhas",
              desc: "Gerencie suas campanhas.",
              route: "/dashboard-contratante",
            } as Item,

            {
              icon: Clock,
              title: "Histórico",
              desc: "Campanhas finalizadas e resultados.",
              route: "/historico",
            } as Item,
          ]
        : []),
    ];

    const security: Item[] = [
      {
        icon: KeyRound,
        title: "Alterar senha",
        desc: "Atualize sua senha de acesso com segurança.",
        route: "/alterar-senha",
      },

      {
        icon: LogOut,
        title: "Sair da conta",
        desc: "Encerrar sessão no dispositivo.",
        action: handleSignOut,
      },
    ];

    return [
      { title: "Conta", items: account },
      { title: "Campanhas", items: campaigns },
      { title: "Segurança", items: security },
    ];
  }, [userRole, handleSignOut]);

  return (
    <MobileLayout title="Configurações" navType={navType} showBack showHome>
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Configurações <span className="text-gradient-neon">do app</span>
          </h2>

          <p className="text-sm text-muted-foreground mt-2">
            Acesse atalhos, ajuda e opções da sua conta.
          </p>
        </motion.div>

        {sections.map((section, sIdx) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + sIdx * 0.06 }}
            className="space-y-3"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
              {section.title}
            </p>

            <div className="space-y-3">
              {section.items.map((it) => {
                const Icon = it.icon;

                return (
                  <button
                    key={it.title}
                    type="button"
                    onClick={() => {
                      if (it.action) return it.action();
                      if (it.route) return navigate(it.route);
                    }}
                    className="w-full glass-card-hover p-5 flex items-center gap-4 text-left group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-neon-subtle flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">
                        {it.title}
                      </h3>

                      {it.desc && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {it.desc}
                        </p>
                      )}
                    </div>

                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}

        <div className="pt-2">
          <p className="text-[10px] text-muted-foreground text-center">
            Orbty • v1.0 (beta)
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}