import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const autoPlayRef = useRef<number | null>(null);

  const scrollToIndex = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;

    const children = Array.from(el.children) as HTMLElement[];
    const target = children[index];

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      inline: "center",
    });
  };

  const startAuto = () => {
    if (!autoPlay || count <= 1) return;

    autoPlayRef.current = window.setInterval(() => {
      setActive((prev) => {
        const next = prev + 1 >= count ? 0 : prev + 1;
        scrollToIndex(next);
        return next;
      });
    }, autoPlayInterval);
  };

  const stopAuto = () => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  };

  useEffect(() => {
    startAuto();
    return stopAuto;
  }, [count]);

  if (!enabled.length) return null;

  return (
    <section className="w-full">
      <div className="relative">

        {/* ARROWS */}
        {count > 1 && (
          <>
            <button
              onClick={() => {
                const next = active - 1 < 0 ? count - 1 : active - 1;
                setActive(next);
                scrollToIndex(next);
              }}
              className="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/50"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={() => {
                const next = active + 1 >= count ? 0 : active + 1;
                setActive(next);
                scrollToIndex(next);
              }}
              className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/50"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* SLIDER */}
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto scroll-smooth cursor-grab active:cursor-grabbing select-none [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: "x mandatory" as any }}
        >
          {enabled.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                if (!b.href) return;

                if (isExternal(b.href)) {
                  window.open(b.href, "_blank");
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
            </button>
          ))}
        </div>
      </div>

      {/* DOTS */}
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {enabled.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setActive(i);
                scrollToIndex(i);
              }}
              className={[
                "h-2 rounded-full transition-all",
                active === i ? "w-6 bg-primary" : "w-2 bg-zinc-300/60",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </section>
  );
}