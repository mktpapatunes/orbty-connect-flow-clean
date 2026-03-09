import { CheckCircle2 } from "lucide-react";

type Props = {
  size?: "sm" | "md";
  role?: "influencer" | "contractor";
};

export default function VerifiedBadge({
  size = "sm",
  role = "influencer",
}: Props) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const colorClass =
    role === "contractor" ? "text-yellow-400" : "text-primary";

  return (
    <span
      title="Conta verificada pela Orbty"
      className="inline-flex items-center justify-center shrink-0"
    >
      <CheckCircle2
        className={`${iconSize} ${colorClass}`}
        strokeWidth={2.5}
      />
    </span>
  );
}