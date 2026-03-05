import { useNavigate } from "react-router-dom"
import type { GlobalBanner } from "@/config/globalBanners"

function isExternal(url?: string) {
  return !!url && /^https?:\/\//i.test(url)
}

export default function HeroBanner({ banner }: { banner: GlobalBanner }) {
  const navigate = useNavigate()

  if (!banner?.enabled) return null

  const handleClick = () => {
    if (!banner.href) return
    if (isExternal(banner.href)) window.open(banner.href, "_blank", "noopener,noreferrer")
    else navigate(banner.href)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-sm"
    >
      <img
        src={banner.imageUrl}
        alt={banner.alt}
        className="h-[220px] w-full object-cover"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/25" />
    </button>
  )
}