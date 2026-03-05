import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { GlobalBanner } from "@/config/globalBanners"

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function isExternal(url?: string) {
  return !!url && /^https?:\/\//i.test(url)
}

export default function BannersCarousel({
  title,
  banners,
}: {
  title: string
  banners: GlobalBanner[]
}) {
  const navigate = useNavigate()
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)

  const enabled = useMemo(() => banners.filter((b) => b.enabled !== false), [banners])
  const count = enabled.length

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || count === 0) return

    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[]
      if (!children.length) return

      const elRect = el.getBoundingClientRect()
      const centerX = elRect.left + elRect.width / 2

      let bestIdx = 0
      let bestDist = Infinity
      children.forEach((child, idx) => {
        const r = child.getBoundingClientRect()
        const childCenter = r.left + r.width / 2
        const dist = Math.abs(childCenter - centerX)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = idx
        }
      })

      setActive(clamp(bestIdx, 0, count - 1))
    }

    onScroll()
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [count])

  const dots = useMemo(() => Array.from({ length: count }), [count])

  if (count === 0) return null

  return (
    <section className="mt-6">
      <div className="px-0">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          {title}
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="mt-3 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" as any }}
      >
        {enabled.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              if (!b.href) return
              if (isExternal(b.href)) window.open(b.href, "_blank", "noopener,noreferrer")
              else navigate(b.href)
            }}
            className="relative w-[88%] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-sm"
            style={{ scrollSnapAlign: "center" as any }}
          >
            <img
              src={b.imageUrl}
              alt={b.alt}
              className="h-[150px] w-full object-cover"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/20" />
          </button>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-center gap-2">
        {dots.map((_, i) => (
          <span
            key={i}
            className={[
              "h-2 w-2 rounded-full transition-all",
              i === active ? "bg-blue-500" : "bg-zinc-300/60",
            ].join(" ")}
          />
        ))}
      </div>
    </section>
  )
}