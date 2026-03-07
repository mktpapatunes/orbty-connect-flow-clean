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

/*
  HERO BANNERS — CONTRACTOR (MARCA / NEGÓCIO)

  tamanho recomendado:
  1200x700
*/

export const dashboardContractorHeroBanners: GlobalBanner[] = [
  {
    id: "hero4",
    imageUrl: "/banners/hero4.png",
    alt: "Encontre creators da sua região",
    href: "/campanha",
    enabled: true,
  },

  {
    id: "hero5",
    imageUrl: "/banners/hero5.png",
    alt: "Crie campanhas com creators locais",
    href: "/criar-campanha",
    enabled: true,
  },

  {
    id: "hero6",
    imageUrl: "/banners/hero6.png",
    alt: "Divulgue sua marca com creators",
    href: "/campanha",
    enabled: true,
  },
]

/*
  NEWS BANNERS — CONTRACTOR

  tamanho recomendado:
  1200x650
*/

export const dashboardContractorNewsBanners: GlobalBanner[] = [
  {
    id: "news4",
    imageUrl: "/banners/news4.png",
    alt: "Organize campanhas em um só lugar",
    href: "/campanha",
    enabled: true,
  },

  {
    id: "news5",
    imageUrl: "/banners/news5.png",
    alt: "Acompanhe candidaturas e entregas",
    href: "/campanha",
    enabled: true,
  },

  {
    id: "news6",
    imageUrl: "/banners/news6.png",
    alt: "Fortaleça sua presença com creators locais",
    href: "/criar-campanha",
    enabled: true,
  },
]