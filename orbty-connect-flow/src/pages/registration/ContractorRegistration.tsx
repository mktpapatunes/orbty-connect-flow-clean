import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  ChevronRight,
  Lock,
  Loader2,
  Building2,
  BriefcaseBusiness,
} from "lucide-react";
import NetworkBackground from "@/components/NetworkBackground";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CityUfPicker from "@/components/CityUfPicker";

const ContractorRegistration = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    companyName: "",
    jobTitle: "",
    password: "",
    email: "",
    phone: "",
    inviteCode: "",
    city: "",
    state: "",
  });

  const [cityValid, setCityValid] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = "Nome completo é obrigatório";
    if (!form.companyName.trim()) newErrors.companyName = "Nome da empresa é obrigatório";
    if (!form.jobTitle.trim()) newErrors.jobTitle = "Cargo/Função é obrigatório";

    if (!form.password.trim()) {
      newErrors.password = "Senha é obrigatória";
    } else if (form.password.length < 6) {
      newErrors.password = "Senha deve ter no mínimo 6 caracteres";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Email inválido";
    }

    if (!form.phone.trim()) newErrors.phone = "Telefone é obrigatório";

    if (!form.state.trim() || form.state.trim().length !== 2) {
      newErrors.state = "UF inválida (ex: SP, RJ)";
    }

    if (!form.city.trim()) {
      newErrors.city = "Cidade é obrigatória";
    } else if (!cityValid) {
      newErrors.city = "Selecione uma cidade válida na lista (IBGE)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || isLoading) return;

    setIsLoading(true);

    const result = await register(form.email, form.password, "contractor", {
      name: form.name,
      companyName: form.companyName,
      jobTitle: form.jobTitle,
      email: form.email,
      phone: form.phone,
      city: form.city,
      state: form.state,
      inviteCode: form.inviteCode || undefined,
    });

    if (result.error) {
      const errLower = result.error.toLowerCase();

      if (
        errLower.includes("rate") ||
        errLower.includes("limit") ||
        errLower.includes("429")
      ) {
        toast.error("Limite de envios atingido. Aguarde alguns minutos.");
      } else {
        toast.error(result.error);
      }

      setIsLoading(false);
      return;
    }

    if (result.needsEmailConfirmation) {
      toast.success("Conta criada! Confirme seu e-mail para continuar.");
      navigate("/check-email?email=" + encodeURIComponent(form.email));
    } else {
      toast.success("Cadastro realizado com sucesso!");
      navigate("/aguardando-aprovacao");
    }

    setIsLoading(false);
  };

  const canProceed =
    !!form.name.trim() &&
    !!form.companyName.trim() &&
    !!form.jobTitle.trim() &&
    !!form.password.trim() &&
    !!form.email.trim() &&
    !!form.phone.trim() &&
    !!form.city.trim() &&
    !!form.state.trim() &&
    cityValid;

  const fields = [
    {
      key: "name",
      label: "Nome completo",
      icon: User,
      placeholder: "Seu nome completo",
      type: "text",
    },
    {
      key: "companyName",
      label: "Nome da Empresa",
      icon: Building2,
      placeholder: "Nome da sua empresa",
      type: "text",
    },
    {
      key: "jobTitle",
      label: "Cargo/Função",
      icon: BriefcaseBusiness,
      placeholder: "Ex: Proprietário, Marketing, Gestor",
      type: "text",
    },
    {
      key: "password",
      label: "Senha",
      icon: Lock,
      placeholder: "Mínimo 6 caracteres",
      type: "password",
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      placeholder: "seu@email.com",
      type: "email",
    },
    {
      key: "phone",
      label: "Telefone / WhatsApp",
      icon: Phone,
      placeholder: "(00) 00000-0000",
      type: "tel",
    },
    {
      key: "inviteCode",
      label: "Código de convite",
      icon: User,
      placeholder: "Ex: ORBTY2026",
      type: "text",
    },
  ] as const;

  return (
    <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      {/* Header */}
      <div className="relative z-10 px-8 pb-6 pt-10">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate("/escolha-perfil")}
          className="mb-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Voltar
        </motion.button>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-1 font-display text-2xl font-bold text-foreground"
        >
          Cadastro de <span className="text-gradient-neon">Contratante</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground"
        >
          Preencha seus dados para começar a criar campanhas
        </motion.p>
      </div>

      {/* Form */}
      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto px-8 pb-32">
        {fields.map((field, i) => (
          <motion.div
            key={field.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.08 }}
          >
            <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <field.icon className="h-3.5 w-3.5" />
              {field.label}
            </label>

            <input
              type={field.type}
              value={form[field.key as keyof typeof form] as string}
              onChange={(e) => updateField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={`w-full rounded-xl border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                errors[field.key] ? "border-destructive/60" : "border-border/50"
              }`}
            />

            {errors[field.key] && (
              <p className="mt-1 text-xs text-destructive">{errors[field.key]}</p>
            )}
          </motion.div>
        ))}

        {/* Estado + Cidade */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 + fields.length * 0.08 }}
        >
          <CityUfPicker
            uf={form.state}
            city={form.city}
            required
            onChange={({ uf, city, cityValid }) => {
              setForm((prev) => ({ ...prev, state: uf, city }));
              setCityValid(cityValid);

              setErrors((prev) => {
                const next = { ...prev };
                if (next.state) delete next.state;
                if (next.city) delete next.city;
                return next;
              });
            }}
          />

          {errors.state && (
            <p className="mt-1 text-xs text-destructive">{errors.state}</p>
          )}
          {errors.city && (
            <p className="mt-1 text-xs text-destructive">{errors.city}</p>
          )}
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-border/30 bg-background/80 px-8 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSubmit}
            disabled={!canProceed || isLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold transition-all duration-300 ${
              canProceed && !isLoading
                ? "bg-gradient-neon text-primary-foreground glow-blue"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Criar minha conta
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            onClick={() => navigate("/welcome")}
            className="w-full py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContractorRegistration;