import { haversineM, type LatLng } from "./geo";

/**
 * Distribuição equilibrada. Cada critério vira uma nota de 0 a 1 e o peso é configurável no painel.
 * Critérios de passageiro: chegada rápida, avaliação. De motorista: tempo parado sem corrida,
 * valor líquido em relação ao deslocamento sem passageiro, ganhos do dia (quem ganhou menos sobe).
 * Da operação: aceitação e cancelamentos.
 */
export type DispatchWeights = {
  eta: number; idle: number; netPerKm: number; earningsBalance: number; acceptance: number; cancellation: number; rating: number;
};
export const DEFAULT_WEIGHTS: DispatchWeights = {
  eta: 40, idle: 15, netPerKm: 15, earningsBalance: 10, acceptance: 8, cancellation: 7, rating: 5,
};
export const WEIGHT_LABELS: Record<keyof DispatchWeights, string> = {
  eta: "Tempo de chegada", idle: "Tempo sem corrida", netPerKm: "Ganho por km até o passageiro",
  earningsBalance: "Equilíbrio de ganhos do dia", acceptance: "Taxa de aceitação", cancellation: "Poucos cancelamentos", rating: "Avaliação",
};
export const MAX_PICKUP_KM = 10;
const PICKUP_SPEED_MS = 25000 / 3600;

export type Candidate = LatLng & {
  driverId: string;
  online: boolean; approved: boolean; busy: boolean;
  categoryIds: string[]; regionId: string | null;
  locationAgeS: number; idleS: number;
  offersTotal: number; offersAccepted: number; cancelsTotal: number; ridesTotal: number;
  ratingSum: number; ratingCount: number; earnedTodayCents: number;
  declinedThisRide: boolean;
};
export type RideContext = { origin: LatLng; categoryId: string; regionId: string; driverNetCents: number };

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const MAX_LOCATION_AGE_S = 120;

export function isEligible(c: Candidate, ride: RideContext): boolean {
  return c.online && c.approved && !c.busy && !c.declinedThisRide
    && c.regionId === ride.regionId && c.categoryIds.includes(ride.categoryId)
    && c.locationAgeS <= MAX_LOCATION_AGE_S && haversineM(c, ride.origin) <= MAX_PICKUP_KM * 1000;
}

export function scoreCandidate(c: Candidate, ride: RideContext, w: DispatchWeights, maxEarnedToday: number) {
  const pickupDistanceM = Math.round(haversineM(c, ride.origin) * 1.3);
  const pickupEtaS = Math.round(pickupDistanceM / PICKUP_SPEED_MS);
  // Motoristas novos começam com taxas neutras: sem histórico não é punição.
  const acceptance = c.offersTotal < 5 ? 0.8 : c.offersAccepted / c.offersTotal;
  const cancelRate = c.ridesTotal + c.cancelsTotal < 5 ? 0.05 : c.cancelsTotal / (c.ridesTotal + c.cancelsTotal);
  const rating = c.ratingCount < 3 ? 4.5 : c.ratingSum / c.ratingCount;
  const netPerPickupKm = ride.driverNetCents / Math.max(1, pickupDistanceM / 1000);

  const breakdown = {
    eta: clamp(1 - pickupEtaS / 900),
    idle: clamp(c.idleS / 1800),
    netPerKm: clamp(netPerPickupKm / 2000),
    earningsBalance: maxEarnedToday > 0 ? clamp(1 - c.earnedTodayCents / maxEarnedToday) : 0.5,
    acceptance: clamp(acceptance),
    cancellation: clamp(1 - cancelRate * 4),
    rating: clamp((rating - 3) / 2),
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const score = (Object.keys(w) as (keyof DispatchWeights)[]).reduce((s, k) => s + breakdown[k] * w[k], 0) / total;
  return { score, breakdown, pickupDistanceM, pickupEtaS };
}

export function rankCandidates(cands: Candidate[], ride: RideContext, w: DispatchWeights = DEFAULT_WEIGHTS) {
  const eligible = cands.filter((c) => isEligible(c, ride));
  const maxEarned = Math.max(0, ...eligible.map((c) => c.earnedTodayCents));
  return eligible
    .map((c) => ({ candidate: c, ...scoreCandidate(c, ride, w, maxEarned) }))
    .sort((a, b) => b.score - a.score);
}
