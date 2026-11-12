import { estimateRoute, type LatLng } from "@/domain/geo";
import type { Place } from "@/domain/place";

const OSRM = () => process.env.OSRM_URL || "https://router.project-osrm.org";
const PHOTON = () => process.env.PHOTON_URL || "https://photon.komoot.io";
const UA = { "User-Agent": "Orbi/0.1 (plataforma de mobilidade)" };

export type Route = { distanceM: number; durationS: number; geometry: [number, number][]; source: "osrm" | "estimate" };

/**
 * Rota de a até b passando pelas paradas, na ordem. Se o serviço de rotas falhar,
 * devolve estimativa em linha reta (trecho a trecho) marcada como tal.
 */
export async function getRoute(a: LatLng, b: LatLng, via: LatLng[] = []): Promise<Route> {
  const pts = [a, ...via, b];
  try {
    const coords = pts.map((p) => `${p.lng},${p.lat}`).join(";");
    const res = await fetch(`${OSRM()}/route/v1/driving/${coords}?overview=simplified&geometries=geojson`, {
      headers: UA, signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) throw new Error("sem rota");
    return { distanceM: Math.round(r.distance), durationS: Math.round(r.duration), geometry: r.geometry.coordinates, source: "osrm" };
  } catch {
    let distanceM = 0, durationS = 0;
    for (let i = 1; i < pts.length; i++) {
      const leg = estimateRoute(pts[i - 1], pts[i]);
      distanceM += leg.distanceM;
      durationS += leg.durationS;
    }
    return { distanceM, durationS, geometry: pts.map((p) => [p.lng, p.lat]), source: "estimate" };
  }
}

export type { Place };
/** Caixa de busca: oeste, sul, leste, norte. */
export type Bbox = [number, number, number, number];

type Feature = { geometry: { coordinates: [number, number] }; properties: Record<string, string> & { extent?: number[] } };

// Chaves do mapa que indicam um lugar com nome próprio (shopping, hospital, banco...), e não só um endereço.
const PLACE_KEYS = new Set(["amenity", "shop", "tourism", "leisure", "office", "healthcare", "railway", "aeroway", "public_transport", "craft", "historic", "man_made", "emergency", "sport", "club", "building"]);
const AREA_TYPES = new Set(["city", "district", "locality", "county", "state", "country", "other"]);

const unique = (parts: (string | undefined)[]) => [...new Set(parts.filter((p): p is string => Boolean(p)))];

/** Transforma o que o serviço devolveu em algo que a pessoa reconhece: nome do lugar, rua e número, bairro e cidade. */
export function toPlace(f: Feature): Place {
  const base = toPlaceText(f);
  const p = f.properties;
  const osm = p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : undefined;
  // O Photon devolve a extensão como [oeste, norte, leste, sul].
  const e = p.extent;
  const extent = Array.isArray(e) && e.length === 4 ? [e[0], e[3], e[2], e[1]] as [number, number, number, number] : undefined;
  return { ...base, ...(osm ? { osm } : {}), ...(extent ? { extent } : {}) };
}

function toPlaceText(f: Feature): Place {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const where = unique([p.district, p.locality, p.city ?? p.county]).join(" · ");
  const address = p.street ? (p.housenumber ? `${p.street}, ${p.housenumber}` : p.street) : "";

  if (p.type === "street") return { label: p.name || p.street || "Rua", detail: where, kind: "street", lat, lng };
  if (p.osm_key === "place" || p.osm_key === "boundary" || AREA_TYPES.has(p.type)) {
    return { label: p.name || where || "Local", detail: unique([p.city && p.city !== p.name ? p.city : undefined, p.state]).join(" · "), kind: "area", lat, lng };
  }
  // Tem nome próprio e esse nome não é só o da rua: é um lugar
  if (p.name && p.name !== p.street && (PLACE_KEYS.has(p.osm_key) || !address)) {
    return { label: p.name, detail: unique([address, where]).join(" · "), kind: "place", lat, lng };
  }
  if (address) return { label: address, detail: where, kind: "address", lat, lng };
  return { label: p.name || where || "Local", detail: where, kind: "place", lat, lng };
}

// Minúsculas e sem acentos (a faixa do padrão é a dos acentos combinados, U+0300 a U+036F): "Timóteo" e "timoteo" são iguais.
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const dedupe = (places: Place[]) => {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = `${p.kind}|${p.label}|${p.detail}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Quando o serviço principal cai, as próximas buscas vão direto para a segunda fonte por um tempo,
// em vez de cada pessoa esperar o tempo-limite de novo.
let photonDownUntil = 0;
const PHOTON_PAUSE_MS = 2 * 60_000;

async function fetchFeatures(q: string, near: LatLng, bbox: Bbox | undefined, limit: number): Promise<Feature[]> {
  const box = bbox ? `&bbox=${bbox.join(",")}` : "";
  const url = `${PHOTON()}/api/?q=${encodeURIComponent(q)}&lat=${near.lat}&lon=${near.lng}&limit=${limit}&lang=default${box}`;
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    return (await res.json()).features as Feature[];
  } catch (e) {
    photonDownUntil = Date.now() + PHOTON_PAUSE_MS;
    throw e;
  }
}

const NOMINATIM = () => process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
type NominatimHit = {
  lat: string; lon: string; name?: string; osm_type?: string; osm_id?: number; addresstype?: string; category?: string; type?: string;
  boundingbox?: string[]; address?: Record<string, string>;
};
const NOMINATIM_AREA = new Set(["suburb", "neighbourhood", "quarter", "city_district", "city", "town", "village", "hamlet", "municipality", "residential"]);

/** Converte um resultado do Nominatim no mesmo formato do Photon, para o resto do código não mudar. */
function nominatimToFeature(h: NominatimHit): Feature {
  const a = h.address ?? {};
  const road = h.addresstype === "road" || h.category === "highway";
  const area = !road && NOMINATIM_AREA.has(h.addresstype ?? "");
  const bb = h.boundingbox?.map(Number);
  return {
    geometry: { coordinates: [Number(h.lon), Number(h.lat)] },
    properties: {
      name: h.name || "", street: road ? "" : a.road, housenumber: a.house_number, district: a.suburb ?? a.neighbourhood ?? a.quarter,
      city: a.city ?? a.town ?? a.village ?? a.municipality, state: a.state,
      // "house" para o resto: o tipo "other" do Photon conta como área, e uma loja não é bairro.
      type: area ? "district" : road ? "street" : "house",
      osm_key: area ? "place" : (h.category ?? ""), osm_type: (h.osm_type ?? "").charAt(0).toUpperCase(), osm_id: String(h.osm_id ?? ""),
      ...(bb && bb.length === 4 ? { extent: [bb[2], bb[1], bb[3], bb[0]] } : {}),
    } as unknown as Feature["properties"],
  };
}

// O Nominatim público aceita no máximo uma busca por segundo: as chamadas entram numa fila
// e respostas recentes ficam guardadas (a mesma busca não sai de novo).
let nominatimNext = 0;
const nominatimCache = new Map<string, { at: number; features: Feature[] }>();
const waitTurn = async () => {
  const now = Date.now();
  const at = Math.max(now, nominatimNext);
  nominatimNext = at + 1100;
  if (at > now) await new Promise((ok) => setTimeout(ok, at - now));
};

/** Segunda fonte de endereços, usada quando a primeira está fora do ar. */
async function fetchNominatim(q: string, bbox: Bbox | undefined, limit: number): Promise<Feature[]> {
  const box = bbox ? `&viewbox=${bbox.join(",")}&bounded=1` : "";
  const url = `${NOMINATIM()}/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&countrycodes=br&accept-language=pt-BR&limit=${limit}${box}`;
  const hit = nominatimCache.get(url);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.features;
  await waitTurn();
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const features = ((await res.json()) as NominatimHit[]).map(nominatimToFeature);
  if (nominatimCache.size > 500) nominatimCache.clear();
  nominatimCache.set(url, { at: Date.now(), features });
  return features;
}

async function findFeatures(q: string, near: LatLng, bbox: Bbox | undefined, limit: number): Promise<Feature[]> {
  if (Date.now() < photonDownUntil) return fetchNominatim(q, bbox, limit);
  // Se o principal demorar mais de 1,5 s, a segunda fonte entra em paralelo e vale a primeira resposta boa.
  const main = fetchFeatures(q, near, bbox, limit);
  const slow = new Promise<"slow">((ok) => setTimeout(() => ok("slow"), 1500));
  const first = await Promise.race([main.catch(() => "failed" as const), slow]);
  if (Array.isArray(first)) return first;
  const backup = fetchNominatim(q, bbox, limit);
  try { return await Promise.any([main, backup]); }
  catch { return backup; }
}

// Contornos já buscados ficam guardados: o mesmo bairro aparece em muitas buscas.
const outlines = new Map<string, unknown>();

/** Contorno de um bairro ou cidade (GeoJSON), para a prévia no mapa. Ponto sem área devolve null. */
export async function getOutline(osm: string): Promise<unknown> {
  if (!/^[RW]\d{1,12}$/.test(osm)) return null;
  if (outlines.has(osm)) return outlines.get(osm);
  const res = await fetch(`${NOMINATIM()}/lookup?osm_ids=${osm}&format=geojson&polygon_geojson=1&polygon_threshold=0.0002`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const geom = (await res.json()).features?.[0]?.geometry ?? null;
  const shape = geom && (geom.type === "Polygon" || geom.type === "MultiPolygon") ? geom : null;
  if (outlines.size > 500) outlines.clear();
  outlines.set(osm, shape);
  return shape;
}

/**
 * Busca endereços e lugares. Quando a pessoa digita rua e número e o mapa não tem esse número,
 * devolve a rua com o número digitado, marcada como posição aproximada.
 */
export async function searchPlaces(q: string, near: LatLng, bbox?: Bbox): Promise<Place[]> {
  const typed = q.trim().match(/^(.{3,}?)[,\s]+(\d{1,5})$/);
  const found = await findFeatures(q, near, bbox, 8);
  let places = found.map(toPlace);
  if (typed) {
    const number = typed[2];
    // O número só conta se for da rua digitada: o mapa tem muitos "100" em outras ruas.
    const wantedStreet = plain(typed[1]);
    const exact = found.some((f) => {
      const street = f.properties.street ? plain(f.properties.street) : "";
      return street && f.properties.housenumber === number && (street.includes(wantedStreet) || wantedStreet.includes(street));
    });
    if (!exact) {
      const streets = (await findFeatures(typed[1], near, bbox, 8)).filter((f) => f.properties.type === "street").map(toPlace);
      const approx: Place[] = streets.map((s) => ({ ...s, label: `${s.label}, ${number}`, kind: "address", approx: true }));
      places = [...approx, ...places.filter((p) => p.kind !== "street")];
    }
  }
  return dedupe(places).slice(0, 8);
}

async function reverseNominatim(p: LatLng): Promise<Place | null> {
  try {
    await waitTurn();
    const res = await fetch(`${NOMINATIM()}/reverse?lat=${p.lat}&lon=${p.lng}&format=jsonv2&addressdetails=1&zoom=18&accept-language=pt-BR`, { headers: UA, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const hit = (await res.json()) as NominatimHit & { error?: string };
    return hit.error ? null : { ...toPlace(nominatimToFeature(hit)), lat: p.lat, lng: p.lng };
  } catch { return null; }
}

export async function reverseGeocode(p: LatLng): Promise<Place | null> {
  if (Date.now() < photonDownUntil) return reverseNominatim(p);
  try {
    const res = await fetch(`${PHOTON()}/reverse?lat=${p.lat}&lon=${p.lng}&limit=1`, { headers: UA, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = await res.json();
    return data.features?.[0] ? { ...toPlace(data.features[0]), lat: p.lat, lng: p.lng } : null;
  } catch {
    photonDownUntil = Date.now() + PHOTON_PAUSE_MS;
    return reverseNominatim(p);
  }
}
