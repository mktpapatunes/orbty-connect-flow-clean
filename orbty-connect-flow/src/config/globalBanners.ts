export type GlobalBanner = {
  id: string
  imageUrl: string // /banners/...
  alt: string
  href?: string // rota interna ("/campanhas") ou externa ("https://...")
  enabled?: boolean
  // mais tarde: placement, roles, startAt/endAt etc
}

export const dashboardHeroBanner: GlobalBanner = {
  id: "hero",
  imageUrl: "/banners/hero.png",
  alt: "Banner principal",
  href: "/minhas-campanhas",
  enabled: true,
}

export const dashboardNewsBanners: GlobalBanner[] = [
  {
    id: "n1",
    imageUrl: "/banners/n1.png",
    alt: "Novidade 1",
    href: "/minhas-campanhas",
    enabled: true,
  },
  {
    id: "n2",
    imageUrl: "/banners/n2.png",
    alt: "Novidade 2",
    href: "/minhas-candidaturas",
    enabled: true,
  },
  {
    id: "n3",
    imageUrl: "/banners/n3.png",
    alt: "Novidade 3",
    href: "/ajuda",
    enabled: true,
  },
]