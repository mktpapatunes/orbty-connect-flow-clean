import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GlobalBanner } from "@/config/globalBanners";

function isExternal(url?: string) {
  return !!url && /^https?:\/\//i.test(url);
}

export default function HeroCarousel({
  banners,
  autoPlay = true,
  autoPlayInterval = 5000,
}: {
  banners: GlobalBanner[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
}) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const enabled = useMemo(
    () => banners.filter((b) => b.enabled !== false),
    [banners]
  );

  const [active, setActive] = useState(0);
  const count = enabled.length;

  const autoRef = useRef<number | null>(null);

  const scrollToIndex = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;

    const children = Array.from(el.children) as HTMLElement[];
    const target = children[index];

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const startAuto = () => {
    if (!autoPlay || count <= 1) return;

    autoRef.current = window.setInterval(() => {
      setActive((prev) => {
        const next = prev + 1 >= count ? 0 : prev + 1;
        scrollToIndex(next);
        return next;
      });
    }, autoPlayInterval);
  };

  const stopAuto = () => {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
  };

  useEffect(() => {
    startAuto();
    return stopAuto;
  }, [count]);

  if (!enabled.length) return null;

  return (
    <section className="w-full">
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto scroll-smooth select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" as any }}
      >
        {enabled.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              if (!b.href) return;

              if (isExternal(b.href)) {
                window.open(b.href, "_blank", "noopener,noreferrer");
              } else {
                navigate(b.href);
              }
            }}
            className="relative w-full shrink-0 overflow-hidden rounded-[28px]"
            style={{ scrollSnapAlign: "center" as any }}
          >
            <img
              src={b.imageUrl}
              alt={b.alt}
              className="h-[220px] w-full object-cover"
              draggable={false}
            />

            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/30" />
          </button>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-2 flex justify-center gap-2">
          {enabled.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                stopAuto();
                scrollToIndex(i);
                setActive(i);
                startAuto();
              }}
              className={[
                "h-2.5 rounded-full transition-all",
                active === i ? "w-6 bg-primary" : "w-2.5 bg-zinc-300/60",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </section>
  );
}