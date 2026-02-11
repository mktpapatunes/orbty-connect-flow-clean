import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: "w-3.5 h-3.5", badge: "px-1.5 py-0.5", text: "text-[10px]" },
  md: { icon: "w-4 h-4", badge: "px-2 py-1", text: "text-xs" },
  lg: { icon: "w-5 h-5", badge: "px-3 py-1.5", text: "text-sm" },
};

const VerifiedBadge = ({ size = "md", showLabel = true, className = "" }: VerifiedBadgeProps) => {
  const s = sizeMap[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 ${s.badge} ${className}`}
    >
      <BadgeCheck className={`${s.icon} text-primary`} />
      {showLabel && (
        <span className={`${s.text} font-medium text-primary whitespace-nowrap`}>
          Verificada ORBTY
        </span>
      )}
    </motion.div>
  );
};

export default VerifiedBadge;
