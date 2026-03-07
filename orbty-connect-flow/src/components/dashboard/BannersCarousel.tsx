import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { GlobalBanner } from "@/config/globalBanners"

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

  const enabled = useMemo(
    () => banners.filter((b) => b.enabled !== false),
    [banners]
  )

  const count = enabled.length
  const [active, setActive] = useState(0)

  const updateActive = () => {
    const el = scrollerRef.current
    if (!el) return

    const children = Array.from(el.children) as HTMLElement[]

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

    setActive(bestIdx)
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    el.addEventListener("scroll", updateActive, { passive: true })

    return () => {
      el.removeEventListener("scroll", updateActive)
    }
  }, [])

  if (!enabled.length) return null

  return (
    <section className="mt-6">
      <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
        {title}
      </p>

      <div
        ref={scrollerRef}
        className="mt-3 flex gap-3 overflow-x-auto pb-2 select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" as any }}
      >
        {enabled.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              if (!b.href) return

              if (isExternal(b.href)) {
                window.open(b.href, "_blank")
              } else {
                navigate(b.href)
              }
            }}
            className="relative w-[88%] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5"
            style={{ scrollSnapAlign: "center" as any }}
          >
            <img
              src={b.imageUrl}
              alt={b.alt}
              className="h-[150px] w-full object-cover"
              draggable={false}
            />
          </button>
        ))}
      </div>

      <div className="mt-2 flex justify-center gap-2">
        {enabled.map((_, i) => (
          <div
            key={i}
            className={[
              "h-2.5 rounded-full transition-all",
              active === i ? "w-6 bg-primary" : "w-2.5 bg-zinc-300/60",
            ].join(" ")}
          />
        ))}
      </div>
    </section>
  )
}