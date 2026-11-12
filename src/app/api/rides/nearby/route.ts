import { ApiError, route } from "@/server/api";
import { nearbyDrivers } from "@/server/rides";

/** Carros online por perto, em posição aproximada, para o mapa do passageiro. */
export const GET = route(async ({ req }) => {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!url.searchParams.has("lat") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new ApiError(400, "Coordenadas inválidas.");
  return nearbyDrivers({ lat, lng });
}, { roles: ["passenger"] });
