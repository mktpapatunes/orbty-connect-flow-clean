// src/components/VerifiedBadge.tsx

import { CheckCircle2 } from "lucide-react";

type Props = {
  size?: "sm" | "md";
};

export default function VerifiedBadge({ size = "sm" }: Props) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <span
      title="Conta verificada pela Orbty"
      className="inline-flex items-center justify-center shrink-0"
    >
      <CheckCircle2
        className={`${iconSize} text-primary`}
        strokeWidth={2.5}
      />
    </span>
  );
}