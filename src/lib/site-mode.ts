/**
 * Versão vitrine do site (GitHub Pages): só páginas prontas, sem servidor.
 * Liga com NEXT_PUBLIC_STATIC=1 no build (scripts/build-pages.mjs). Fora dela, tudo funciona como sempre.
 * Na vitrine não há login, banco nem API: endereços e rotas vêm direto dos serviços abertos do mapa
 * (src/lib/static-api.ts) e as tarifas, de um arquivo gerado no build.
 */
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

/** Pasta do site no endereço (ex.: "/orbi" em usuario.github.io/orbi). Vazio no servidor normal. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Endereço de um arquivo da pasta public/. Links do Next já recebem a pasta sozinhos; fetch, <img> e location não. */
export const asset = (path: string) => `${BASE}${path}`;
