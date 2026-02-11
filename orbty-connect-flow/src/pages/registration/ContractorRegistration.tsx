import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, ChevronRight, Lock, Loader2 } from "lucide-react";
import NetworkBackground from "@/components/NetworkBackground";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ContractorRegistration = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    city: "",
    state: "",
    inviteCode: "",
  });

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
    if (!form.name.trim()) newErrors.name = "Nome é obrigatório";
    if (!form.email.trim()) newErrors.email = "Email é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Email inválido";
    if (!form.password.trim()) newErrors.password = "Senha é obrigatória";
    else if (form.password.length < 6) newErrors.password = "Senha deve ter no mínimo 6 caracteres";
    if (!form.phone.trim()) newErrors.phone = "Telefone é obrigatório";
    if (!form.city.trim()) newErrors.city = "Cidade é obrigatória";
    if (!form.state.trim()) newErrors.state = "Estado é obrigatório";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || isLoading) return;
    setIsLoading(true);

    const result = await register(form.email, form.password, "contractor", {
      name: form.name,
      email: form.email,
      phone: form.phone,
      city: form.city,
      state: form.state,
      inviteCode: form.inviteCode,
    });

    if (result.error) {
      const errLower = result.error.toLowerCase();
      if (errLower.includes("rate") || errLower.includes("limit") || errLower.includes("429")) {
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
  };

  const canProceed = form.name && form.email && form.password && form.phone && form.city && form.state;

  const fields = [
    { key: "name", label: "Nome completo", icon: User, placeholder: "Seu nome ou nome da empresa", type: "text" },
    { key: "email", label: "Email", icon: Mail, placeholder: "seu@email.com", type: "email" },
    { key: "password", label: "Senha", icon: Lock, placeholder: "Mínimo 6 caracteres", type: "password" },
    { key: "phone", label: "Telefone / WhatsApp", icon: Phone, placeholder: "(00) 00000-0000", type: "tel" },
    { key: "city", label: "Cidade", icon: MapPin, placeholder: "Sua cidade", type: "text" },
    { key: "state", label: "Estado", icon: MapPin, placeholder: "Seu estado", type: "text" },
    { key: "inviteCode", label: "Código de convite (opcional)", icon: User, placeholder: "Ex: ORBTY2026", type: "text" },
  ];

  return (
    <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      {/* Header */}
      <div className="relative z-10 pt-10 pb-6 px-8">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate("/escolha-perfil")}
          className="text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors"
        >
          ← Voltar
        </motion.button>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-2xl font-bold text-foreground mb-1"
        >
          Cadastro de <span className="text-gradient-neon">Contratante</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-sm"
        >
          Preencha seus dados para começar a criar campanhas
        </motion.p>
      </div>

      {/* Form */}
      <div className="relative z-10 flex-1 px-8 space-y-4 overflow-y-auto pb-32">
        {fields.map((field, i) => (
          <motion.div
            key={field.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.08 }}
          >
            <label className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
              <field.icon className="w-3.5 h-3.5" />
              {field.label}
            </label>
            <input
              type={field.type}
              value={form[field.key as keyof typeof form]}
              onChange={(e) => updateField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={`w-full bg-input border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${
                errors[field.key] ? "border-destructive/60" : "border-border/50"
              }`}
            />
            {errors[field.key] && (
              <p className="text-xs text-destructive mt-1">{errors[field.key]}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 px-8 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSubmit}
            disabled={!canProceed || isLoading}
            className={`w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
              canProceed && !isLoading
                ? "bg-gradient-neon text-primary-foreground glow-blue"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Criar minha conta
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
          <button
            onClick={() => navigate("/welcome")}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContractorRegistration;
