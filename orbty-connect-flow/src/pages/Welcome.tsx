import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NetworkBackground from "@/components/NetworkBackground";
import TransparentLogo from "@/components/TransparentLogo";
import networkBg from "@/assets/network-bg.jpg";
import orbtyLogo from "@/assets/orbty-logo.png";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="mobile-container relative overflow-hidden flex flex-col items-center justify-center bg-background">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={networkBg}
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
      </div>

      {/* Animated network dots */}
      <NetworkBackground />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-16 px-8">
        {/* Logo with blend + glow animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-2 relative flex items-center justify-center"
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 rounded-full bg-primary/15 blur-3xl animate-logo-glow" />
          </div>
          <TransparentLogo
            src={orbtyLogo}
            alt="ORBTY"
            threshold={50}
            className="w-80 h-auto relative z-10 drop-shadow-[0_0_40px_hsl(200,100%,50%,0.35)]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-6"
        >
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-muted-foreground text-center">
            Marketing Regional Inteligente
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="text-foreground/80 text-center text-base leading-relaxed mb-3 max-w-xs font-medium"
        >
          Conecte sua campanha ao público certo, na região certa.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="text-muted-foreground text-center text-xs leading-relaxed mb-12 max-w-xs"
        >
          Marketing inteligente com criadores reais
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/escolha-perfil")}
          className="w-full max-w-xs py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-base tracking-wide glow-blue transition-all duration-300"
        >
          Começar agora
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/login")}
          className="w-full max-w-xs py-3 mt-3 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm hover:text-foreground hover:border-primary/30 transition-all duration-300"
        >
          Já tenho conta · Entrar
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.6 }}
          className="mt-6 flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-logo-glow" />
            <span className="text-xs text-muted-foreground">Plataforma online · v1.0</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Welcome;
