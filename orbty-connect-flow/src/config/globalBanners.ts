export type GlobalBanner = {
  id: string
  imageUrl: string // /banners/...
  alt: string
  href?: string // rota interna ("/campanhas") ou externa ("https://...")
  enabled?: boolean
  // mais tarde: placement, roles, startAt/endAt etc
}

export const dashboardHeroBanners = [
  {
    id: "hero1",
    imageUrl: "/banners/hero1.png",
    alt: "Campanha destaque",
    href: "/minhas-campanhas",
    enabled: true,
  },
  {
    id: "hero2",
    imageUrl: "/banners/hero2.png",
    alt: "Novidades Orbty",
    href: "/perfil",
    enabled: true,
  },
  {
    id: "hero3",
    imageUrl: "/banners/hero3.png",
    alt: "Promoção creators",
    href: "/ajuda",
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