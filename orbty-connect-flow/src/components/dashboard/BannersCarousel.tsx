import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GlobalBanner } from "@/config/globalBanners";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isExternal(url?: string) {
  return !!url && /^https?:\/\//i.test(url);
}

export default function BannersCarousel({
  title,
  banners,
  autoPlay = true,
  autoPlayInterval = 4500,
}: {
  title: string;
  banners: GlobalBanner[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
}) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const enabled = useMemo(() => banners.filter((b) => b.enabled !== false), [banners]);
  const count = enabled.length;

  // drag state
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const autoPlayRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<number | null>(null);

  const updateActiveByScroll = () => {
    const el = scrollerRef.current;
    if (!el || count === 0) return;

    const children = Array.from(el.children) as HTMLElement[];
    if (!children.length) return;

    const elRect = el.getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2;

    let bestIdx = 0;
    let bestDist = Infinity;

    children.forEach((child, idx) => {
      const r = child.getBoundingClientRect();
      const childCenter = r.left + r.width / 2;
      const dist = Math.abs(childCenter - centerX);

      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    setActive(clamp(bestIdx, 0, count - 1));
  };

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    if (!el) return;

    const children = Array.from(el.children) as HTMLElement[];
    const target = children[index];
    if (!target) return;

    target.scrollIntoView({
      behavior,
      inline: "center",
      block: "nearest",
    });
  };

  const stopAutoPlay = () => {
    if (autoPlayRef.current) {
      window.clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  };

  const resumeAutoPlayLater = () => {
    if (!autoPlay) return;

    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current);
    }

    resumeTimeoutRef.current = window.setTimeout(() => {
      startAutoPlay();
    }, 5000);
  };

  const startAutoPlay = () => {
    stopAutoPlay();

    if (!autoPlay || count <= 1) return;

    autoPlayRef.current = window.setInterval(() => {
      setActive((prev) => {
        const next = prev + 1 >= count ? 0 : prev + 1;
        scrollToIndex(next);
        return next;
      });
    }, autoPlayInterval);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || count === 0) return;

    const onScroll = () => {
      updateActiveByScroll();
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [count]);

  useEffect(() => {
    startAutoPlay();

    return () => {
      stopAutoPlay();

      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [count, autoPlay, autoPlayInterval]);

  const dots = useMemo(() => Array.from({ length: count }), [count]);

  if (count === 0) return null;

  return (
    <section className="mt-6">
      <div className="px-0 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          {title}
        </p>

        {count > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopAutoPlay();
                const next = active - 1 < 0 ? count - 1 : active - 1;
                scrollToIndex(next);
                setActive(next);
                resumeAutoPlayLater();
              }}
              className="h-8 w-8 rounded-full border border-border/50 bg-card/60 text-sm text-foreground hover:bg-card transition-colors"
              aria-label="Banner anterior"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => {
                stopAutoPlay();
                const next = active + 1 >= count ? 0 : active + 1;
                scrollToIndex(next);
                setActive(next);
                resumeAutoPlayLater();
              }}
              className="h-8 w-8 rounded-full border border-border/50 bg-card/60 text-sm text-foreground hover:bg-card transition-colors"
              aria-label="Próximo banner"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={scrollerRef}
        className="mt-3 flex gap-3 overflow-x-auto pb-2 select-none cursor-grab active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" as any }}
        onMouseDown={(e) => {
          const el = scrollerRef.current;
          if (!el) return;

          isDraggingRef.current = true;
          dragMovedRef.current = false;
          startXRef.current = e.pageX;
          scrollLeftRef.current = el.scrollLeft;

          stopAutoPlay();
        }}
        onMouseMove={(e) => {
          const el = scrollerRef.current;
          if (!el || !isDraggingRef.current) return;

          const delta = e.pageX - startXRef.current;

          if (Math.abs(delta) > 6) {
            dragMovedRef.current = true;
          }

          el.scrollLeft = scrollLeftRef.current - delta;
        }}
        onMouseUp={() => {
          if (!isDraggingRef.current) return;
          isDraggingRef.current = false;
          updateActiveByScroll();
          resumeAutoPlayLater();
        }}
        onMouseLeave={() => {
          if (!isDraggingRef.current) return;
          isDraggingRef.current = false;
          updateActiveByScroll();
          resumeAutoPlayLater();
        }}
        onTouchStart={() => {
          stopAutoPlay();
        }}
        onTouchEnd={() => {
          updateActiveByScroll();
          resumeAutoPlayLater();
        }}
      >
        {enabled.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={(e) => {
              if (dragMovedRef.current) {
                e.preventDefault();
                return;
              }

              if (!b.href) return;

              stopAutoPlay();

              if (isExternal(b.href)) {
                window.open(b.href, "_blank", "noopener,noreferrer");
              } else {
                navigate(b.href);
              }

              resumeAutoPlayLater();
            }}
            className="relative w-[88%] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-sm"
            style={{ scrollSnapAlign: "center" as any }}
          >
            <img
              src={b.imageUrl}
              alt={b.alt}
              className="h-[150px] w-full object-cover pointer-events-none"
              loading="lazy"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/20" />
          </button>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-center gap-2">
        {dots.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              stopAutoPlay();
              scrollToIndex(i);
              setActive(i);
              resumeAutoPlayLater();
            }}
            aria-label={`Ir para banner ${i + 1}`}
            className={[
              "h-2.5 rounded-full transition-all",
              i === active ? "w-6 bg-primary" : "w-2.5 bg-zinc-300/60",
            ].join(" ")}
          />
        ))}
      </div>
    </section>
  );
}