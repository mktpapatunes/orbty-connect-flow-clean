export type GlobalBanner = {
  id: string
  imageUrl: string
  alt: string
  href?: string
  enabled?: boolean
}

/* HERO SLIDER */

export const dashboardHeroBanners: GlobalBanner[] = [
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
  },
]

/* CARROSSEL DE NOVIDADES */

export const dashboardNewsBanners: GlobalBanner[] = [
  {
    id: "news1",
    imageUrl: "/banners/news1.png",
    alt: "Campanhas abertas",
    href: "/minhas-campanhas",
    enabled: true,
  },
  {
    id: "news2",
    imageUrl: "/banners/news2.png",
    alt: "Atualize seu perfil",
    href: "/perfil",
    enabled: true,
  },
  {
    id: "news3",
    imageUrl: "/banners/news3.png",
    alt: "Ajuda Orbty",
    href: "/ajuda",
    enabled: true,
  },
]