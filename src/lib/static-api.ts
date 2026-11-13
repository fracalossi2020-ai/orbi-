/**
 * Respostas da API para a versão vitrine (sem servidor). Mesmo formato das rotas reais, montado no navegador:
 * busca de endereço, rota e contorno vão direto aos serviços abertos do mapa; tarifas vêm do arquivo do build.
 */
import { getOutline, getRoute, reverseGeocode, searchPlaces, type Bbox } from "@/server/geo";
import { findRegion } from "@/domain/geo";
import type { Place } from "@/domain/place";
import type { PublicCity } from "@/server/public-data";
import { asset } from "./site-mode";

export const DEMO_MESSAGE = "Esta é a versão de demonstração do site. Para viajar ou se cadastrar, fale com a gente pelos contatos da página.";

let tariffs: Promise<PublicCity[]> | null = null;
export function staticTariffs(): Promise<PublicCity[]> {
  tariffs ??= fetch(asset("/data/tariffs.json")).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return tariffs;
}

const regions = async () => (await staticTariffs()).map((c) => ({ ...c, active: true }));
const markArea = (places: Place[], rs: Awaited<ReturnType<typeof regions>>) =>
  places.map((p) => ({ ...p, inArea: Boolean(findRegion(p, rs)) })).sort((a, b) => Number(b.inArea) - Number(a.inArea));

const MARGIN_KM = 12;
function serviceBox(rs: { lat: number; lng: number; radiusKm: number }[]): Bbox | undefined {
  if (!rs.length) return undefined;
  const south = Math.min(...rs.map((r) => r.lat - (r.radiusKm + MARGIN_KM) / 110.57));
  const north = Math.max(...rs.map((r) => r.lat + (r.radiusKm + MARGIN_KM) / 110.57));
  const west = Math.min(...rs.map((r) => r.lng - (r.radiusKm + MARGIN_KM) / (111.32 * Math.cos((r.lat * Math.PI) / 180))));
  const east = Math.max(...rs.map((r) => r.lng + (r.radiusKm + MARGIN_KM) / (111.32 * Math.cos((r.lat * Math.PI) / 180))));
  return [west, south, east, north].map((n) => Math.round(n * 1e4) / 1e4) as Bbox;
}

const point = (v: string | null) => {
  const [lat, lng] = (v ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

/** Responde a um endereço /api/... como o servidor responderia. */
export async function staticApi(path: string): Promise<unknown> {
  const url = new URL(path, "http://x");
  const q = url.searchParams;
  switch (url.pathname) {
    case "/api/public/tariffs": return { cities: await staticTariffs() };
    case "/api/public/pulse": return { cities: [] };
    case "/api/public/support": return { whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "" };
    case "/api/geo/search": {
      const text = q.get("q")?.trim().slice(0, 120) ?? "";
      if (text.length < 3) return { places: [] };
      const rs = await regions();
      const near = point(q.has("lat") ? `${q.get("lat")},${q.get("lng")}` : null) ?? { lat: -19.5, lng: -42.58 };
      return { places: markArea(await searchPlaces(text, near, serviceBox(rs)), rs) };
    }
    case "/api/geo/reverse": {
      const p = point(`${q.get("lat")},${q.get("lng")}`);
      if (!p) throw new Error("Coordenadas inválidas.");
      const rs = await regions();
      const place = await reverseGeocode(p);
      return { place: place ? markArea([place], rs)[0] : null, inArea: Boolean(findRegion(p, rs)) };
    }
    case "/api/geo/route": {
      const a = point(q.get("from")), b = point(q.get("to"));
      if (!a || !b) throw new Error("Informe partida e chegada.");
      const rs = await regions();
      return { ...(await getRoute(a, b)), originInArea: Boolean(findRegion(a, rs)), destInArea: Boolean(findRegion(b, rs)) };
    }
    case "/api/geo/outline":
      try { return { shape: await getOutline(q.get("osm") ?? "") }; } catch { return { shape: null }; }
  }
  throw new Error(DEMO_MESSAGE);
}
