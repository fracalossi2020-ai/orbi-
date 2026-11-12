import { ApiError, publicRoute } from "@/server/api";
import { checkRateLimit } from "@/server/auth";
import { clientIp } from "@/server/security";
import { getOutline, getRoute, reverseGeocode, searchPlaces, type Bbox } from "@/server/geo";
import { getDb, schema as s } from "@/db";
import { findRegion } from "@/domain/geo";
import type { Place } from "@/domain/place";
import { lookupCep } from "@/server/verify";

const VALE_DO_ACO = { lat: -19.5, lng: -42.58 };
const MARGIN_KM = 12;

type Region = { lat: number; lng: number; radiusKm: number; active: boolean };

/** Caixa que cobre todas as cidades atendidas, com folga: a busca fica no Vale do Aço em vez de listar ruas homônimas de outros estados. */
function serviceBox(regions: Region[]): Bbox | undefined {
  const active = regions.filter((r) => r.active);
  if (!active.length) return undefined;
  const south = Math.min(...active.map((r) => r.lat - (r.radiusKm + MARGIN_KM) / 110.57));
  const north = Math.max(...active.map((r) => r.lat + (r.radiusKm + MARGIN_KM) / 110.57));
  const west = Math.min(...active.map((r) => r.lng - (r.radiusKm + MARGIN_KM) / (111.32 * Math.cos((r.lat * Math.PI) / 180))));
  const east = Math.max(...active.map((r) => r.lng + (r.radiusKm + MARGIN_KM) / (111.32 * Math.cos((r.lat * Math.PI) / 180))));
  return [west, south, east, north].map((n) => Math.round(n * 1e4) / 1e4) as Bbox;
}

/** Diz se cada ponto está dentro das cidades atendidas e põe esses primeiro. */
const markArea = (places: Place[], regions: Region[]) =>
  places.map((p) => ({ ...p, inArea: Boolean(findRegion(p, regions)) })).sort((a, b) => Number(b.inArea) - Number(a.inArea));

export const GET = publicRoute<{ action: string }>(async ({ req, user, params }) => {
  const url = new URL(req.url);
  // A busca é aberta porque o site pede o trajeto antes do login; sem conta, tem limite por endereço.
  // Busca aberta (o site pede o trajeto antes do login), com limite por IP; com conta, limite por conta.
  if (!user) {
    if (params.action === "cep") throw new ApiError(401, "Entre na sua conta para continuar.");
    if (!checkRateLimit(`geo:${clientIp(req)}`, 120)) throw new ApiError(429, "Muitas buscas. Aguarde alguns minutos.");
  } else if (!checkRateLimit(`geo:u:${user.id}`, 400)) throw new ApiError(429, "Muitas buscas. Aguarde alguns minutos.");
  if (params.action === "search") {
    const q = url.searchParams.get("q")?.trim().slice(0, 120) ?? "";
    if (q.length < 3) return { places: [] };
    const regions = await (await getDb()).select().from(s.regions);
    try {
      const lat = Number(url.searchParams.get("lat"));
      const lng = Number(url.searchParams.get("lng"));
      const near = url.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : VALE_DO_ACO;
      return { places: markArea(await searchPlaces(q, near, serviceBox(regions)), regions) };
    } catch {
      throw new ApiError(503, "A busca de endereços está indisponível. Tente de novo em instantes.");
    }
  }
  if (params.action === "reverse") {
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ApiError(400, "Coordenadas inválidas.");
    const regions = await (await getDb()).select().from(s.regions);
    const place = await reverseGeocode({ lat, lng });
    return { place: place ? markArea([place], regions)[0] : null, inArea: Boolean(findRegion({ lat, lng }, regions)) };
  }
  // Rota pública para o site: distância, tempo e se partida e chegada ficam na área atendida (as mesmas regras do pedido).
  if (params.action === "route") {
    const parse = (v: string | null) => {
      const [lat, lng] = (v ?? "").split(",").map(Number);
      return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
    };
    const a = parse(url.searchParams.get("from"));
    const b = parse(url.searchParams.get("to"));
    if (!a || !b) throw new ApiError(400, "Informe partida e chegada.");
    const regions = await (await getDb()).select().from(s.regions);
    const route = await getRoute(a, b);
    return { ...route, originInArea: Boolean(findRegion(a, regions)), destInArea: Boolean(findRegion(b, regions)) };
  }
  // Contorno do bairro para a prévia no mapa. Sem contorno, a prévia mostra só o ponto.
  if (params.action === "outline") {
    try { return { shape: await getOutline(url.searchParams.get("osm") ?? "") }; }
    catch { return { shape: null }; }
  }
  if (params.action === "cep") {
    const found = await lookupCep(url.searchParams.get("cep") ?? "");
    if (found === null) throw new ApiError(404, "CEP não encontrado. Confira os números.");
    return found === "unavailable" ? { unavailable: true } : { address: found };
  }
  throw new ApiError(404, "Ação desconhecida.");
});
