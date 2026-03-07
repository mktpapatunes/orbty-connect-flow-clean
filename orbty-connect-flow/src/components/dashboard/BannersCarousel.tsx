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

  const enabled = useMemo(
    () => banners.filter((b) => b.enabled !== false),
    [banners]
  );
  const count = enabled.length;

  const autoPlayRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<number | null>(null);

  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  const getChildren = () => {
    const el = scrollerRef.current;
    if (!el) return [];
    return Array.from(el.children) as HTMLElement[];
  };

  const getTargetLeft = (index: number) => {
    const el = scrollerRef.current;
    const children = getChildren();
    const target = children[index];

    if (!el || !target) return 0;

    const left = target.offsetLeft - (el.clientWidth - target.clientWidth) / 2;
    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);

    return clamp(left, 0, maxLeft);
  };

  const scrollToIndex = (
    index: number,
    behavior: ScrollBehavior = "smooth"
  ) => {
    const el = scrollerRef.current;
    if (!el) return;

    el.scrollTo({
      left: getTargetLeft(index),
      behavior,
    });
  };

  const goTo = (index: number, behavior: ScrollBehavior = "smooth") => {
    if (count === 0) return;

    const next = clamp(index, 0, count - 1);
    setActive(next);

    window.requestAnimationFrame(() => {
      scrollToIndex(next, behavior);
    });
  };

  const updateActiveByScroll = () => {
    const el = scrollerRef.current;
    if (!el || count === 0) return;

    const center = el.scrollLeft + el.clientWidth / 2;
    const children = getChildren();

    let bestIdx = 0;
    let bestDist = Infinity;

    children.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.clientWidth / 2;
      const dist = Math.abs(childCenter - center);

      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    setActive(clamp(bestIdx, 0, count - 1));
  };

  const stopAutoPlay = () => {
    if (autoPlayRef.current) {
      window.clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  };

  const startAutoPlay = () => {
    stopAutoPlay();

    if (!autoPlay || count <= 1) return;

    autoPlayRef.current = window.setInterval(() => {
      setActive((prev) => {
        const next = prev + 1 >= count ? 0 : prev + 1;

        window.requestAnimationFrame(() => {
          scrollToIndex(next, "smooth");
        });

        return next;
      });
    }, autoPlayInterval);
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

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || count === 0) return;

    const onScroll = () => updateActiveByScroll();

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

  if (count === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="mt-3 flex gap-3 overflow-x-auto pb-2 scroll-smooth select-none overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:cursor-grab md:active:cursor-grabbing"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        onMouseDown={(e) => {
          const el = scrollerRef.current;
          if (!el) return;

          isDraggingRef.current = true;
          dragMovedRef.current = false;
          startXRef.current = e.clientX;
          startScrollLeftRef.current = el.scrollLeft;

          stopAutoPlay();
        }}
        onMouseMove={(e) => {
          const el = scrollerRef.current;
          if (!el || !isDraggingRef.current) return;

          const delta = e.clientX - startXRef.current;

          if (Math.abs(delta) > 6) {
            dragMovedRef.current = true;
          }

          el.scrollLeft = startScrollLeftRef.current - delta;
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
          dragMovedRef.current = false;
          stopAutoPlay();
        }}
        onTouchMove={() => {
          dragMovedRef.current = true;
        }}
        onTouchEnd={() => {
          updateActiveByScroll();
          resumeAutoPlayLater();

          window.setTimeout(() => {
            dragMovedRef.current = false;
          }, 80);
        }}
      >
        {enabled.map((b) => (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
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
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();

              if (!b.href) return;

              if (isExternal(b.href)) {
                window.open(b.href, "_blank", "noopener,noreferrer");
              } else {
                navigate(b.href);
              }
            }}
            className="relative w-[88%] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-sm"
            style={{
              scrollSnapAlign: "center",
              scrollSnapStop: "always",
            }}
          >
            <img
              src={b.imageUrl}
              alt={b.alt}
              className="pointer-events-none h-[150px] w-full object-cover"
              loading="lazy"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/20" />
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2">
          {enabled.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                stopAutoPlay();
                goTo(i, "smooth");
                resumeAutoPlayLater();
              }}
              aria-label={`Ir para banner ${i + 1}`}
              className={[
                "h-2 rounded-full transition-all",
                i === active ? "w-5 bg-primary" : "w-2 bg-zinc-300/60",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </section>
  );
}