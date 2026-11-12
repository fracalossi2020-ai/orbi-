export type LatLng = { lat: number; lng: number };

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Estimativa sem serviço de rotas: fator urbano sobre a linha reta e 28 km/h de média. */
export function estimateRoute(a: LatLng, b: LatLng) {
  const distanceM = Math.round(haversineM(a, b) * 1.35);
  return { distanceM, durationS: Math.round(distanceM / (28000 / 3600)) };
}

/** A região atendida mais próxima cujo raio contém o ponto. */
export function findRegion<R extends LatLng & { radiusKm: number; active: boolean }>(point: LatLng, regions: R[]): R | null {
  let best: R | null = null;
  let bestD = Infinity;
  for (const r of regions) {
    if (!r.active) continue;
    const d = haversineM(point, r);
    if (d <= r.radiusKm * 1000 && d < bestD) { best = r; bestD = d; }
  }
  return best;
}
