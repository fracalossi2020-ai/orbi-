export type IdentityId = "a" | "b" | "c" | "d";

export type Identity = {
  id: IdentityId; name: string; concept: string;
  palette: { name: string; hex: string; role: string }[];
  type: { display: string; body: string; why: string };
  icons: string; buttons: string;
  car: { paint: string; trim: string; interior: string; glow: string };
};

export const IDENTITIES: Identity[] = [
  {
    id: "a", name: "Orbi", concept: "Mobilidade urbana mais simples, rápida e segura: agilidade, conexão, segurança e mobilidade.",
    palette: [
      { name: "Azul Elétrico", hex: "#0356C5", role: "Principal" }, { name: "Azul Noturno", hex: "#0A1E3D", role: "Secundária" },
      { name: "Preto Profundo", hex: "#02060E", role: "Apoio" }, { name: "Branco", hex: "#FFFFFF", role: "Contraste" }, { name: "Cinza Neutro", hex: "#E6E8EB", role: "Interface" },
    ],
    type: { display: "Inter", body: "Inter", why: "Família moderna, limpa e versátil, do manual da marca." },
    icons: "Phosphor regular, ativo preenchido", buttons: "Azul Elétrico, formato pílula",
    car: { paint: "#F3F5F8", trim: "#DCE2EA", interior: "#2A3340", glow: "#00E1FF" },
  },
  {
    id: "b", name: "Orbi Urban", concept: "Movimento, energia, agilidade e presença urbana.",
    palette: [
      { name: "Preto grafite", hex: "#202329", role: "Primária" }, { name: "Laranja", hex: "#F47738", role: "Botões" },
      { name: "Amarelo", hex: "#F6C66A", role: "Secundária" }, { name: "Branco", hex: "#FFFFFF", role: "Fundo" }, { name: "Cinza claro", hex: "#ECEFF1", role: "Superfícies" },
    ],
    type: { display: "Barlow Condensed", body: "Barlow", why: "Vem da sinalização de estrada e das placas de veículo." },
    icons: "Phosphor bold, traço forte", buttons: "Laranja com texto grafite, cantos curtos",
    car: { paint: "#F47738", trim: "#202329", interior: "#F6C66A", glow: "#F6C66A" },
  },
  {
    id: "c", name: "Orbi Premium", concept: "Sofisticação, segurança e tecnologia.",
    palette: [
      { name: "Azul marinho", hex: "#17243C", role: "Primária" }, { name: "Azul royal", hex: "#4269A8", role: "Botões" },
      { name: "Prata", hex: "#C4CCD5", role: "Secundária" }, { name: "Branco", hex: "#F8F9FB", role: "Fundo" }, { name: "Cinza escuro", hex: "#343B45", role: "Texto" },
    ],
    type: { display: "Newsreader", body: "Schibsted Grotesk", why: "Serifa editorial que afasta a marca do visual comum de aplicativo." },
    icons: "Phosphor light, traço fino", buttons: "Azul royal, formato pílula",
    car: { paint: "#17243C", trim: "#343B45", interior: "#C4CCD5", glow: "#C4CCD5" },
  },
  {
    id: "d", name: "Orbi Vision", concept: "Inovação, modernidade e transformação.",
    palette: [
      { name: "Roxo profundo", hex: "#332B52", role: "Primária" }, { name: "Azul violeta", hex: "#6559B8", role: "Botões" },
      { name: "Turquesa", hex: "#42B9AE", role: "Secundária" }, { name: "Branco", hex: "#F7F7FA", role: "Fundo" }, { name: "Grafite", hex: "#282733", role: "Texto" },
    ],
    type: { display: "Unbounded", body: "Onest", why: "Letras largas e geométricas, com aspecto de produto novo." },
    icons: "Phosphor duotone, dois tons", buttons: "Azul violeta, cantos bem redondos",
    car: { paint: "#6559B8", trim: "#332B52", interior: "#42B9AE", glow: "#42B9AE" },
  },
];

export const identityById = (id: string) => IDENTITIES.find((i) => i.id === id) ?? IDENTITIES[0];
