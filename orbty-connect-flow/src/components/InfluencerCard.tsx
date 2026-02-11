import { motion } from "framer-motion";
import { Users, Star, TrendingUp } from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";

interface InfluencerCardProps {
  name: string;
  city: string;
  followers: string;
  niche: string;
  engagement: string;
  photo: string;
  selected?: boolean;
  verified?: boolean;
  onSelect?: () => void;
}

const InfluencerCard = ({
  name,
  city,
  followers,
  niche,
  engagement,
  photo,
  selected = false,
  verified = false,
  onSelect,
}: InfluencerCardProps) => {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`w-full p-4 rounded-xl border transition-all duration-300 text-left ${
        selected
          ? "border-primary/60 bg-primary/5 glow-blue"
          : "border-border/50 bg-card/60 hover:border-primary/30"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-secondary shrink-0 ring-2 ring-border">
          <img src={photo} alt={name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground truncate">{name}</h4>
            {verified && <VerifiedBadge size="sm" showLabel={false} />}
          </div>
          <p className="text-xs text-muted-foreground">{city}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {niche}
            </span>
          </div>
        </div>
        {selected ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0"
          >
            <span className="text-primary-foreground text-xs font-bold">✓</span>
          </motion.div>
        ) : (
          <div className="w-7 h-7 rounded-full border-2 border-border/60 shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-foreground/80">{followers}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-foreground/80">{engagement}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-xs text-foreground/80">Alto alcance</span>
        </div>
      </div>
    </motion.button>
  );
};

export default InfluencerCard;
