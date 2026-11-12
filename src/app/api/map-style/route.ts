/**
 * Estilo do mapa servido pela própria Orbi: o servidor busca o estilo e o índice dos blocos no OpenFreeMap
 * uma vez por hora e entrega os dois juntos. O navegador economiza duas idas e voltas a um servidor distante
 * e ainda guarda a resposta. Se o OpenFreeMap não responder, o app usa o endereço original.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const TTL_MS = 60 * 60_000;
const UA = { "User-Agent": "Orbi/0.1 (plataforma de mobilidade)" };

type Source = { type: string; url?: string; [k: string]: unknown };
let cached: { at: number; body: string } | null = null;
let pending: Promise<string> | null = null;

async function build(): Promise<string> {
  const style = (await (await fetch(STYLE_URL, { headers: UA, signal: AbortSignal.timeout(8000) })).json()) as { sources: Record<string, Source> };
  await Promise.all(Object.entries(style.sources).map(async ([id, src]) => {
    if (src.type !== "vector" || !src.url) return;
    const tj = (await (await fetch(src.url, { headers: UA, signal: AbortSignal.timeout(8000) })).json()) as { tiles?: string[]; minzoom?: number; maxzoom?: number; attribution?: string };
    if (!tj.tiles?.length) return;
    const { url: _url, ...rest } = src;
    style.sources[id] = { ...rest, tiles: tj.tiles, minzoom: tj.minzoom ?? 0, maxzoom: tj.maxzoom ?? 14, ...(tj.attribution ? { attribution: tj.attribution } : {}) };
  }));
  return JSON.stringify(style);
}

export async function GET() {
  const fresh = cached && Date.now() - cached.at < TTL_MS;
  if (!fresh) {
    pending ??= build().then((body) => { cached = { at: Date.now(), body }; return body; }).finally(() => { pending = null; });
    // Com uma cópia antiga em mãos, responde com ela e atualiza em segundo plano.
    if (!cached) {
      try { await pending; } catch { return Response.json({ error: "Estilo do mapa indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
    } else pending.catch(() => {});
  }
  return new Response(cached!.body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400" } });
}
