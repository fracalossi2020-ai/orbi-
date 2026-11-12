/**
 * Carregamento antecipado do mapa. Sem isto, o navegador baixa tudo em fila: a biblioteca, depois o estilo,
 * depois o índice dos blocos, e só então ruas, ícones e letras. Aqui tudo começa junto, uma vez por visita,
 * assim que a tela que tem mapa abre (antes mesmo do componente do mapa existir).
 * O estilo vem do próprio servidor da Orbi (/api/map-style), já com o índice dos blocos dentro.
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const LOCAL_STYLE_URL = "/api/map-style";

type StyleJson = { sources: Record<string, unknown>; sprite?: string | { id: string; url: string }[]; glyphs?: string; layers: { layout?: Record<string, unknown> }[] };

let lib: Promise<typeof import("maplibre-gl")> | null = null;
let style: Promise<StyleJson | string> | null = null;

/** Baixa o arquivo para o cache do navegador; a biblioteca pede o mesmo endereço depois e recebe na hora. */
const warm = (url: string) => { fetch(url, { mode: "cors", credentials: "omit" }).catch(() => {}); };

async function loadStyle(): Promise<StyleJson | string> {
  try {
    const res = await fetch(LOCAL_STYLE_URL);
    if (!res.ok) throw new Error(`estilo ${res.status}`);
    const s = (await res.json()) as StyleJson;
    // Letras dos nomes de ruas e bairros começam a baixar já: a biblioteca só as pede depois dos primeiros blocos.
    // (Os ícones não: a biblioteca já os pede logo no início, e baixá-los aqui duplicaria o download.)
    const fonts = new Set<string>();
    for (const l of s.layers) {
      const f = l.layout?.["text-font"];
      if (Array.isArray(f) && f.every((x) => typeof x === "string")) fonts.add(f.join(","));
    }
    if (s.glyphs) for (const f of fonts) warm(s.glyphs.replace("{fontstack}", encodeURIComponent(f)).replace("{range}", "0-255"));
    return s;
  } catch {
    // Se algo falhar aqui, a biblioteca busca sozinha no endereço original.
    style = null;
    return MAP_STYLE_URL;
  }
}

/** Começa a carregar o mapa. Pode ser chamado várias vezes: só a primeira faz algo. */
export function preloadMap() {
  if (typeof window === "undefined") return;
  if (!lib) {
    // O "trabalhador" do mapa (que desenha os blocos em paralelo) também começa a baixar já.
    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = MAP_WORKER_URL;
    document.head.appendChild(link);
  }
  lib ??= import("maplibre-gl");
  style ??= loadStyle();
}

/** Biblioteca e estilo prontos para criar o mapa. */
export async function mapAssets() {
  preloadMap();
  const [ml, s] = await Promise.all([lib!, style!]);
  // Cópia: cada mapa altera o próprio estilo (rota, marcadores), e o original fica para as próximas telas.
  return { ml, style: typeof s === "string" ? s : (structuredClone(s) as unknown as import("maplibre-gl").StyleSpecification) };
}
