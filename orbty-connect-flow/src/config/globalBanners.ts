export type GlobalBanner = {
  id: string
  imageUrl: string
  alt: string
  href?: string
  enabled?: boolean
}

/*
  HERO BANNERS (topo do dashboard)

  tamanho recomendado:
  1200x700
*/

export const dashboardHeroBanners: GlobalBanner[] = [
  {
    id: "hero1",
    imageUrl: "/banners/hero1.png",
    alt: "Campanhas abertas na sua região",
    href: "/minhas-campanhas",
    enabled: true,
  },

  {
    id: "hero2",
    imageUrl: "/banners/hero2.png",
    alt: "Complete seu perfil",
    href: "/perfil",
    enabled: true,
  },

  {
    id: "hero3",
    imageUrl: "/banners/hero3.png",
    alt: "Conheça novas oportunidades",
    href: "/minhas-campanhas",
    enabled: true,
  },
]

/*
  BANNERS DE NOVIDADES

  tamanho recomendado:
  1200x650
*/

export const dashboardNewsBanners: GlobalBanner[] = [
  {
    id: "news1",
    imageUrl: "/banners/news1.png",
    alt: "Novas campanhas disponíveis",
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
    alt: "Dúvidas sobre campanhas",
    href: "/ajuda",
    enabled: true,
  },
]