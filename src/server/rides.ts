import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema as s, type Db } from "@/db";
import { getSetting } from "@/db/seed";
import { ACTIVE_STATUSES, STATUS_LABEL, type RideStatus } from "@/domain/transitions";
import { DEFAULT_WEIGHTS, rankCandidates, type Candidate, type DispatchWeights } from "@/domain/dispatch";
import { findRegion, haversineM, type LatLng } from "@/domain/geo";
import { couponDiscount, ledgerEffect, quoteFare, brl } from "@/domain/pricing";
import { DEFAULT_SCHEDULE, scheduleProblem, type ScheduleRules } from "@/domain/schedule";
import { getRoute } from "./geo";
import { DEFAULT_PAYMENT_RULES, driverAccepts, isDirect, type PaymentMethod, type PaymentRules } from "@/domain/payment-methods";
import { pixPayload } from "@/domain/pix";
import { publish, rideChannel, STAFF_CHANNEL, userChannel } from "./bus";
import { createPixCharge, getPixStatus, paymentAvailability } from "./payments";

class RideError extends Error { status = 409; }
const fail = (msg: string): never => { throw new RideError(msg); };
export { RideError };

export async function notify(db: Db, userId: string, title: string, body: string, link?: string) {
  await db.insert(s.notifications).values({ userId, title, body, link });
  publish(userChannel(userId), "notification");
}

function touchRide(ride: { id: string; passengerId: string; driverId: string | null; shareToken: string }) {
  publish(userChannel(ride.passengerId), "ride");
  if (ride.driverId) publish(userChannel(ride.driverId), "ride");
  publish(rideChannel(ride.shareToken), "ride");
  publish(STAFF_CHANNEL, "ride");
}

// ---------------------------------------------------------------- cotação

export async function activeCategoriesWithTariff(db: Db, regionId: string) {
  return db.select({ category: s.categories, tariff: s.tariffs })
    .from(s.tariffs)
    .innerJoin(s.categories, eq(s.tariffs.categoryId, s.categories.id))
    .innerJoin(s.modalities, eq(s.categories.modalityId, s.modalities.id))
    .where(and(eq(s.tariffs.regionId, regionId), eq(s.categories.active, true), eq(s.modalities.active, true)));
}

async function loadCoupon(db: Db, code?: string | null) {
  if (!code) return null;
  const [c] = await db.select().from(s.coupons).where(eq(s.coupons.code, code.trim().toUpperCase()));
  return c ?? null;
}

/** method: só entram motoristas que recebem por essa forma (Pix exige chave; maquininha, ter uma). */
async function buildCandidates(db: Db, regionId: string, rideId?: string, method?: PaymentMethod): Promise<Candidate[]> {
  const all = await db.select({ d: s.drivers, u: s.users }).from(s.drivers).innerJoin(s.users, eq(s.drivers.userId, s.users.id))
    .where(and(eq(s.drivers.regionId, regionId), eq(s.drivers.online, true), eq(s.drivers.status, "approved"), eq(s.users.status, "active")));
  const rows = method ? all.filter((r) => driverAccepts(method, r.d)) : all;
  if (!rows.length) return [];
  const ids = rows.map((r) => r.d.userId);
  const [vehicles, busyRides, pendingOffers, declined, earned] = await Promise.all([
    db.select().from(s.vehicles).where(and(inArray(s.vehicles.driverId, ids), eq(s.vehicles.status, "approved"))),
    db.select({ id: s.rides.driverId }).from(s.rides).where(and(inArray(s.rides.driverId, ids), inArray(s.rides.status, ["accepted", "arrived", "in_progress"]))),
    db.select({ id: s.offers.driverId }).from(s.offers).where(and(inArray(s.offers.driverId, ids), eq(s.offers.status, "pending"))),
    rideId ? db.select({ id: s.offers.driverId }).from(s.offers).where(eq(s.offers.rideId, rideId)) : Promise.resolve([]),
    db.select({ id: s.rides.driverId, total: sql<number>`coalesce(sum(${s.rides.driverNetCents}),0)::int` }).from(s.rides)
      .where(and(inArray(s.rides.driverId, ids), eq(s.rides.status, "completed"), gte(s.rides.endedAt, sql`date_trunc('day', now())`))).groupBy(s.rides.driverId),
  ]);
  const busy = new Set([...busyRides, ...pendingOffers].map((r) => r.id));
  const seen = new Set(declined.map((r) => r.id));
  const now = Date.now();
  return rows.filter((r) => r.d.lat !== null && r.d.lng !== null).map(({ d, u }) => ({
    driverId: d.userId, lat: d.lat!, lng: d.lng!, online: d.online, approved: d.status === "approved",
    busy: busy.has(d.userId), regionId: d.regionId,
    categoryIds: vehicles.filter((v) => v.driverId === d.userId).map((v) => v.categoryId),
    locationAgeS: d.locationAt ? (now - d.locationAt.getTime()) / 1000 : Infinity,
    idleS: d.idleSince ? (now - d.idleSince.getTime()) / 1000 : 0,
    offersTotal: d.offersTotal, offersAccepted: d.offersAccepted, cancelsTotal: d.cancelsTotal, ridesTotal: d.ridesTotal,
    ratingSum: u.ratingSum, ratingCount: u.ratingCount,
    earnedTodayCents: earned.find((e) => e.id === d.userId)?.total ?? 0,
    declinedThisRide: seen.has(d.userId),
  }));
}

export const MAX_STOPS = 2;

/**
 * Motoristas online de verdade perto de um ponto, para o mapa do passageiro.
 * Privacidade: sem nome nem identificação, e a posição vai arredondada para uma grade de ~200 m.
 */
export async function nearbyDrivers(center: LatLng, radiusKm = 6) {
  const db = await getDb();
  const freshSince = new Date(Date.now() - 3 * 60_000);
  const rows = await db.select({ lat: s.drivers.lat, lng: s.drivers.lng }).from(s.drivers).innerJoin(s.users, eq(s.drivers.userId, s.users.id))
    .where(and(eq(s.drivers.online, true), eq(s.drivers.status, "approved"), eq(s.users.status, "active"), gte(s.drivers.locationAt, freshSince)));
  const grid = 0.002;
  const snap = (v: number) => Math.round(v / grid) * grid;
  const cars = rows.filter((r): r is { lat: number; lng: number } => r.lat !== null && r.lng !== null)
    .filter((r) => haversineM(center, r) <= radiusKm * 1000)
    .map((r) => ({ lat: Number(snap(r.lat).toFixed(4)), lng: Number(snap(r.lng).toFixed(4)) }));
  return { count: cars.length, cars: cars.slice(0, 20) };
}

export async function quote(origin: LatLng, dest: LatLng, couponCode?: string | null, stops: LatLng[] = []) {
  const db = await getDb();
  const regions = await db.select().from(s.regions);
  const region = findRegion(origin, regions);
  if (!region) fail("Ainda não atendemos este ponto de partida. A Orbi opera em Ipatinga, Coronel Fabriciano e Timóteo.");
  if (!findRegion(dest, regions)) fail("O destino fica fora da nossa área de atendimento.");
  if (stops.length > MAX_STOPS) fail(`Dá para incluir até ${MAX_STOPS} paradas.`);
  if (stops.some((p) => !findRegion(p, regions))) fail("Uma das paradas fica fora da nossa área de atendimento.");
  // O preço segue a tarifa sobre a distância e o tempo do trajeto completo, com as paradas.
  const route = await getRoute(origin, dest, stops);
  const coupon = await loadCoupon(db, couponCode);
  if (couponCode && !coupon) fail("Cupom não encontrado.");
  const candidates = await buildCandidates(db, region!.id);
  const weights = await getSetting<DispatchWeights>(db, "dispatchWeights", DEFAULT_WEIGHTS);
  const rows = await activeCategoriesWithTariff(db, region!.id);
  const options = rows.map(({ category, tariff }) => {
    const base = quoteFare(tariff, route.distanceM, route.durationS);
    const discountCents = coupon ? couponDiscount(coupon, base.grossCents + base.serviceFeeCents) : 0;
    const fare = quoteFare(tariff, route.distanceM, route.durationS, { discountCents });
    const ranked = rankCandidates(candidates, { origin, categoryId: category.id, regionId: region!.id, driverNetCents: fare.driverNetCents }, weights);
    const fastest = ranked.length ? Math.min(...ranked.map((r) => r.pickupEtaS)) : null;
    return {
      categoryId: category.id, slug: category.slug, name: category.name, description: category.description, seats: category.seats,
      ...fare, pickupEtaS: fastest, driversAvailable: ranked.length,
    };
  });
  // Quantos motoristas online agora recebem por Pix na chave e por maquininha: o passageiro sabe antes de escolher.
  const [byPix, byCard] = await Promise.all([buildCandidates(db, region!.id, undefined, "pix_driver"), buildCandidates(db, region!.id, undefined, "card_machine")]);
  return {
    region: { id: region!.id, name: region!.name }, route, options, couponApplied: !!coupon && options.some((o) => o.discountCents > 0),
    payment: paymentAvailability(await paymentRules(db)),
    acceptingNow: { pix_driver: byPix.length, card_machine: byCard.length },
  };
}

export const paymentRules = (db: Db) => getSetting<PaymentRules>(db, "payments", DEFAULT_PAYMENT_RULES);

// ---------------------------------------------------------------- pedido e distribuição

export async function requestRide(passengerId: string, input: {
  origin: LatLng & { label: string }; dest: LatLng & { label: string }; categoryId: string; paymentMethod: PaymentMethod; couponCode?: string | null;
  rider?: { name: string; phone: string } | null;
  stops?: (LatLng & { label: string })[]; scheduledFor?: Date | null;
}) {
  const db = await getDb();
  const stops = input.stops ?? [];
  const scheduledFor = input.scheduledFor ?? null;
  if (scheduledFor) {
    // Agendada: não ocupa a conta agora; o limite evita reservas em excesso.
    const rules = await getSetting<ScheduleRules>(db, "schedule", DEFAULT_SCHEDULE);
    const problem = scheduleProblem(scheduledFor, new Date(), rules);
    if (problem) fail(problem);
    const booked = await db.select({ id: s.rides.id }).from(s.rides).where(and(eq(s.rides.passengerId, passengerId), eq(s.rides.status, "scheduled")));
    if (booked.length >= rules.maxPerPassenger) fail(`Você já tem ${rules.maxPerPassenger} corridas agendadas. Cancele uma para agendar outra.`);
  } else {
    const open = await db.select({ id: s.rides.id }).from(s.rides).where(and(eq(s.rides.passengerId, passengerId), inArray(s.rides.status, ACTIVE_STATUSES)));
    if (open.length) fail("Você já tem uma corrida em andamento.");
  }
  if (!paymentAvailability(await paymentRules(db))[input.paymentMethod].available) fail("Esta forma de pagamento não está disponível agora.");

  const q = await quote(input.origin, input.dest, input.couponCode, stops);
  const opt = q.options.find((o) => o.categoryId === input.categoryId);
  if (!opt) fail("Categoria indisponível nesta região.");
  const coupon = await loadCoupon(db, input.couponCode);

  const [ride] = await db.insert(s.rides).values({
    passengerId, regionId: q.region.id, categoryId: input.categoryId,
    originLabel: input.origin.label, originLat: input.origin.lat, originLng: input.origin.lng,
    destLabel: input.dest.label, destLat: input.dest.lat, destLng: input.dest.lng,
    distanceM: q.route.distanceM, durationS: q.route.durationS, geometry: q.route.geometry, routeSource: q.route.source,
    stops: stops.map((p) => ({ label: p.label, lat: p.lat, lng: p.lng })),
    status: scheduledFor ? "scheduled" : "searching", scheduledFor, searchStartedAt: scheduledFor ? null : new Date(),
    grossCents: opt!.grossCents, serviceFeeCents: opt!.serviceFeeCents, discountCents: opt!.discountCents, totalCents: opt!.totalCents,
    commissionBps: opt!.commissionBps, commissionCents: opt!.commissionCents, driverNetCents: opt!.driverNetCents,
    couponId: opt!.discountCents > 0 ? coupon?.id : null, paymentMethod: input.paymentMethod,
    riderName: input.rider?.name ?? null, riderPhone: input.rider?.phone ?? null, shareToken: randomBytes(18).toString("base64url"),
  }).returning();
  publish(STAFF_CHANNEL, "ride");
  if (!scheduledFor) await dispatchNext(db, ride.id);
  return ride;
}

/**
 * Corridas agendadas cujo horário de busca chegou entram na fila. Se a pessoa já estiver em outra corrida,
 * a agendada é cancelada com aviso, porque a conta só acompanha uma corrida por vez.
 */
async function activateScheduled(db: Db) {
  const rules = await getSetting<ScheduleRules>(db, "schedule", DEFAULT_SCHEDULE);
  const due = await db.select().from(s.rides).where(and(eq(s.rides.status, "scheduled"), lte(s.rides.scheduledFor, new Date(Date.now() + rules.searchLeadMin * 60_000))));
  for (const ride of due) {
    const open = await db.select({ id: s.rides.id }).from(s.rides).where(and(eq(s.rides.passengerId, ride.passengerId), inArray(s.rides.status, ACTIVE_STATUSES)));
    if (open.length) {
      const [done] = await db.update(s.rides).set({ status: "cancelled", cancelledBy: "system", cancelReason: "Passageiro em outra corrida no horário agendado", endedAt: new Date() })
        .where(and(eq(s.rides.id, ride.id), eq(s.rides.status, "scheduled"))).returning();
      if (done) {
        await notify(db, ride.passengerId, "Corrida agendada cancelada", "No horário agendado você já estava em outra corrida. Nada foi cobrado.", "/passageiro/viagens");
        touchRide(done);
      }
      continue;
    }
    const [started] = await db.update(s.rides).set({ status: "searching", searchStartedAt: new Date() })
      .where(and(eq(s.rides.id, ride.id), eq(s.rides.status, "scheduled"))).returning();
    if (!started) continue;
    await notify(db, ride.passengerId, "Procurando motorista", "Chegou a hora da sua corrida agendada: já estamos buscando um motorista.", "/passageiro");
    touchRide(started);
    await dispatchNext(db, ride.id);
  }
}

/** Comissão efetiva para este motorista: um plano ativo substitui a porcentagem da tarifa. */
async function fareForDriver(db: Db, ride: typeof s.rides.$inferSelect, driverId: string) {
  const [row] = await db.select({ d: s.drivers, p: s.plans }).from(s.drivers).leftJoin(s.plans, eq(s.drivers.planId, s.plans.id)).where(eq(s.drivers.userId, driverId));
  const planActive = row?.p && row.d.planUntil && row.d.planUntil > new Date();
  const commissionBps = planActive ? row.p!.commissionBps : ride.commissionBps;
  const commissionCents = Math.round((ride.grossCents * commissionBps) / 10000);
  return { commissionBps, commissionCents, driverNetCents: ride.grossCents - commissionCents };
}

export async function dispatchNext(db: Db, rideId: string) {
  const [ride] = await db.select().from(s.rides).where(eq(s.rides.id, rideId));
  if (!ride || ride.status !== "searching") return;
  const pending = await db.select({ id: s.offers.id }).from(s.offers).where(and(eq(s.offers.rideId, rideId), eq(s.offers.status, "pending")));
  if (pending.length) return;

  const cfg = await getSetting(db, "dispatch", { offerTimeoutS: 20, searchTimeoutS: 180 });
  const weights = await getSetting<DispatchWeights>(db, "dispatchWeights", DEFAULT_WEIGHTS);
  const candidates = await buildCandidates(db, ride.regionId, ride.id, ride.paymentMethod);
  const ranked = rankCandidates(candidates, {
    origin: { lat: ride.originLat, lng: ride.originLng }, categoryId: ride.categoryId, regionId: ride.regionId, driverNetCents: ride.driverNetCents,
  }, weights);

  if (!ranked.length) {
    if (Date.now() - (ride.searchStartedAt ?? ride.createdAt).getTime() > cfg.searchTimeoutS * 1000) {
      const [done] = await db.update(s.rides).set({ status: "no_driver", endedAt: new Date() })
        .where(and(eq(s.rides.id, rideId), eq(s.rides.status, "searching"))).returning();
      if (done) {
        await notify(db, ride.passengerId, "Nenhum motorista disponível", "Não encontramos motorista agora. Nada foi cobrado.", "/passageiro");
        touchRide(done);
      }
    }
    return;
  }
  const top = ranked[0];
  await db.insert(s.offers).values({
    rideId, driverId: top.candidate.driverId, score: top.score, breakdown: top.breakdown,
    pickupDistanceM: top.pickupDistanceM, pickupEtaS: top.pickupEtaS, expiresAt: new Date(Date.now() + cfg.offerTimeoutS * 1000),
  });
  await db.update(s.drivers).set({ offersTotal: sql`${s.drivers.offersTotal} + 1` }).where(eq(s.drivers.userId, top.candidate.driverId));
  publish(userChannel(top.candidate.driverId), "offer");
  publish(STAFF_CHANNEL, "ride");
}

let sweepCount = 0;

export async function sweep() {
  const db = await getDb();
  const expired = await db.update(s.offers).set({ status: "expired" })
    .where(and(eq(s.offers.status, "pending"), lte(s.offers.expiresAt, new Date()))).returning();
  for (const o of expired) publish(userChannel(o.driverId), "offer");
  await activateScheduled(db);
  const searching = await db.select({ id: s.rides.id }).from(s.rides).where(eq(s.rides.status, "searching"));
  for (const r of searching) await dispatchNext(db, r.id);
  // Pix: a cada 5 ciclos (cerca de 20 s), pergunta ao provedor pelos pagamentos pendentes.
  sweepCount += 1;
  if (process.env.MERCADOPAGO_ACCESS_TOKEN && sweepCount % 5 === 0) {
    const pending = await db.select({ rideId: s.payments.rideId }).from(s.payments).where(and(eq(s.payments.status, "pending"), eq(s.payments.provider, "mercadopago"))).limit(50);
    for (const p of pending) await refreshPayment(p.rideId).catch((e) => console.error("[pagamento]", e));
  }
}

const g = globalThis as unknown as { __prumoSweeper?: NodeJS.Timeout };
export function ensureSweeper() {
  if (g.__prumoSweeper) return;
  g.__prumoSweeper = setInterval(() => { sweep().catch((e) => console.error("[sweep]", e)); }, 4000);
  g.__prumoSweeper.unref?.();
}

// ---------------------------------------------------------------- resposta do motorista

export async function respondToOffer(driverId: string, offerId: string, accept: boolean) {
  const db = await getDb();
  const [offer] = await db.select().from(s.offers).where(and(eq(s.offers.id, offerId), eq(s.offers.driverId, driverId)));
  if (!offer) fail("Oferta não encontrada.");
  if (!accept) {
    const [o] = await db.update(s.offers).set({ status: "declined" }).where(and(eq(s.offers.id, offerId), eq(s.offers.status, "pending"))).returning();
    if (o) await dispatchNext(db, o.rideId);
    publish(userChannel(driverId), "offer");
    return { ok: true };
  }
  const [claimed] = await db.update(s.offers).set({ status: "accepted" })
    .where(and(eq(s.offers.id, offerId), eq(s.offers.status, "pending"), gte(s.offers.expiresAt, new Date()))).returning();
  if (!claimed) fail("Esta oferta expirou.");
  const [ride] = await db.select().from(s.rides).where(eq(s.rides.id, offer!.rideId));
  const [vehicle] = await db.select().from(s.vehicles).where(and(eq(s.vehicles.driverId, driverId), eq(s.vehicles.categoryId, ride.categoryId), eq(s.vehicles.status, "approved")));
  if (!vehicle) fail("Você não tem veículo aprovado para esta categoria.");
  const fare = await fareForDriver(db, ride, driverId);
  const [updated] = await db.update(s.rides).set({ status: "accepted", driverId, vehicleId: vehicle!.id, acceptedAt: new Date(), ...fare })
    .where(and(eq(s.rides.id, ride.id), eq(s.rides.status, "searching"))).returning();
  if (!updated) fail("O passageiro cancelou este pedido.");
  await db.update(s.drivers).set({ offersAccepted: sql`${s.drivers.offersAccepted} + 1`, idleSince: null }).where(eq(s.drivers.userId, driverId));
  await notify(db, ride.passengerId, "Motorista a caminho", `Placa ${vehicle!.plate} · ${vehicle!.make} ${vehicle!.model} ${vehicle!.color}`, "/passageiro");
  touchRide(updated);
  return updated;
}

// ---------------------------------------------------------------- andamento

async function move(rideId: string, driverId: string, from: RideStatus, to: RideStatus, set: Partial<typeof s.rides.$inferInsert>) {
  const db = await getDb();
  const [ride] = await db.update(s.rides).set({ status: to, ...set })
    .where(and(eq(s.rides.id, rideId), eq(s.rides.driverId, driverId), eq(s.rides.status, from))).returning();
  if (!ride) fail("A corrida não está mais nesta etapa.");
  touchRide(ride!);
  return ride!;
}

export async function markArrived(rideId: string, driverId: string) {
  const ride = await move(rideId, driverId, "accepted", "arrived", { arrivedAt: new Date() });
  await notify(await getDb(), ride.passengerId, "Seu motorista chegou", "Confira a placa antes de embarcar.", "/passageiro");
  return ride;
}
export const startTrip = (rideId: string, driverId: string) => move(rideId, driverId, "arrived", "in_progress", { startedAt: new Date() });

async function settle(db: Db, ride: typeof s.rides.$inferSelect) {
  const effect = ledgerEffect(ride.paymentMethod, ride);
  const how: Partial<Record<PaymentMethod, string>> = { cash: "Corrida em dinheiro", pix_driver: "Corrida com Pix na sua chave", card_machine: "Corrida na sua maquininha" };
  const description = isDirect(ride.paymentMethod)
    ? `${how[ride.paymentMethod]}: você recebeu ${brl(ride.totalCents)}, seu líquido é ${brl(ride.driverNetCents)}`
    : `Corrida: bruto ${brl(ride.grossCents)}, comissão ${brl(ride.commissionCents)}`;
  await db.insert(s.ledger).values({ driverId: ride.driverId!, rideId: ride.id, description, ...effect });
  const bonuses = await db.select().from(s.campaigns).where(and(
    eq(s.campaigns.active, true), eq(s.campaigns.kind, "bonus"), or(isNull(s.campaigns.regionId), eq(s.campaigns.regionId, ride.regionId)),
    or(isNull(s.campaigns.startsAt), lte(s.campaigns.startsAt, new Date())), or(isNull(s.campaigns.endsAt), gte(s.campaigns.endsAt, new Date())),
  ));
  for (const b of bonuses) {
    if (b.bonusPerRideCents > 0) await db.insert(s.ledger).values({ driverId: ride.driverId!, rideId: ride.id, type: "bonus", amountCents: b.bonusPerRideCents, description: `Bônus: ${b.name}` });
  }
}

export async function completeTrip(rideId: string, driverId: string) {
  const db = await getDb();
  const ride = await move(rideId, driverId, "in_progress", "completed", { endedAt: new Date() });
  await db.update(s.drivers).set({ ridesTotal: sql`${s.drivers.ridesTotal} + 1`, idleSince: new Date() }).where(eq(s.drivers.userId, driverId));
  if (ride.couponId) await db.update(s.coupons).set({ used: sql`${s.coupons.used} + 1` }).where(eq(s.coupons.id, ride.couponId));

  if (isDirect(ride.paymentMethod)) {
    // Pago na mão do motorista (dinheiro, Pix na chave dele ou maquininha dele): o extrato registra a comissão a acertar.
    await db.insert(s.payments).values({ rideId, method: ride.paymentMethod, provider: "manual", status: "paid", amountCents: ride.totalCents });
    await db.update(s.rides).set({ paymentStatus: "paid" }).where(eq(s.rides.id, rideId));
    await settle(db, ride);
  } else {
    const [passenger] = await db.select().from(s.users).where(eq(s.users.id, ride.passengerId));
    try {
      const charge = await createPixCharge({ rideId, amountCents: ride.totalCents, payerEmail: passenger.email ?? "" });
      await db.insert(s.payments).values({ rideId, method: ride.paymentMethod, provider: "mercadopago", amountCents: ride.totalCents, externalId: charge.externalId, pixCopyPaste: charge.copyPaste });
    } catch (e) {
      console.error("[pagamento]", e);
      await db.update(s.rides).set({ paymentStatus: "failed" }).where(eq(s.rides.id, rideId));
    }
  }
  await notify(db, ride.passengerId, "Viagem concluída", "Conte como foi avaliando seu motorista.", "/passageiro");
  await notify(db, driverId, "Corrida concluída", `Líquido desta corrida: ${brl(ride.driverNetCents)}`, "/motorista/ganhos");
  touchRide(ride);
  return ride;
}

/** Consulta o provedor e credita o motorista uma única vez quando o Pix é confirmado. */
export async function refreshPayment(rideId: string) {
  const db = await getDb();
  const [pay] = await db.select().from(s.payments).where(eq(s.payments.rideId, rideId));
  if (!pay || pay.status !== "pending" || !pay.externalId) return pay ?? null;
  const status = await getPixStatus(pay.externalId);
  if (status === "pending") return pay;
  const [claimed] = await db.update(s.payments).set({ status }).where(and(eq(s.payments.id, pay.id), eq(s.payments.status, "pending"))).returning();
  if (claimed) {
    const [ride] = await db.update(s.rides).set({ paymentStatus: status }).where(eq(s.rides.id, rideId)).returning();
    if (status === "paid") await settle(db, ride);
    touchRide(ride);
  }
  return claimed ?? pay;
}

export async function cancelRide(rideId: string, userId: string, reason: string) {
  const db = await getDb();
  const [ride] = await db.select().from(s.rides).where(eq(s.rides.id, rideId));
  if (!ride) fail("Corrida não encontrada.");
  const byPassenger = ride!.passengerId === userId;
  const byDriver = ride!.driverId === userId;
  if (!byPassenger && !byDriver) fail("Esta corrida não é sua.");

  // Motorista que desiste antes de chegar devolve o pedido à fila, sem deixar o passageiro na mão.
  if (byDriver && ride!.status === "accepted") {
    const [back] = await db.update(s.rides).set({ status: "searching", driverId: null, vehicleId: null, acceptedAt: null })
      .where(and(eq(s.rides.id, rideId), eq(s.rides.status, "accepted"))).returning();
    if (!back) fail("A corrida não está mais nesta etapa.");
    await db.update(s.drivers).set({ cancelsTotal: sql`${s.drivers.cancelsTotal} + 1`, idleSince: new Date() }).where(eq(s.drivers.userId, userId));
    await notify(db, ride!.passengerId, "Procurando outro motorista", "O motorista não pôde seguir. Já estamos buscando outro.", "/passageiro");
    publish(userChannel(userId), "ride");
    touchRide(back);
    await dispatchNext(db, rideId);
    return back;
  }
  const allowed: RideStatus[] = byPassenger ? ["scheduled", "searching", "accepted", "arrived"] : ["arrived"];
  const [done] = await db.update(s.rides).set({ status: "cancelled", cancelledBy: byPassenger ? "passenger" : "driver", cancelReason: reason, endedAt: new Date() })
    .where(and(eq(s.rides.id, rideId), inArray(s.rides.status, allowed))).returning();
  if (!done) fail("Esta corrida não pode mais ser cancelada.");
  await db.update(s.offers).set({ status: "expired" }).where(and(eq(s.offers.rideId, rideId), eq(s.offers.status, "pending")));
  if (done!.driverId) {
    if (byDriver) await db.update(s.drivers).set({ cancelsTotal: sql`${s.drivers.cancelsTotal} + 1` }).where(eq(s.drivers.userId, userId));
    await db.update(s.drivers).set({ idleSince: new Date() }).where(eq(s.drivers.userId, done!.driverId));
    await notify(db, byPassenger ? done!.driverId : done!.passengerId, "Corrida cancelada", reason || "A corrida foi cancelada.", byPassenger ? "/motorista" : "/passageiro");
  }
  touchRide(done!);
  return done!;
}

export async function rateRide(rideId: string, userId: string, stars: number, note?: string) {
  const db = await getDb();
  const [ride] = await db.select().from(s.rides).where(eq(s.rides.id, rideId));
  if (!ride || ride.status !== "completed") fail("Só é possível avaliar corridas concluídas.");
  if (ride!.passengerId === userId) {
    if (ride!.driverRating) fail("Você já avaliou esta corrida.");
    await db.update(s.rides).set({ driverRating: stars, driverRatingNote: note }).where(eq(s.rides.id, rideId));
    await db.update(s.users).set({ ratingSum: sql`${s.users.ratingSum} + ${stars}`, ratingCount: sql`${s.users.ratingCount} + 1` }).where(eq(s.users.id, ride!.driverId!));
  } else if (ride!.driverId === userId) {
    if (ride!.passengerRating) fail("Você já avaliou esta corrida.");
    await db.update(s.rides).set({ passengerRating: stars }).where(eq(s.rides.id, rideId));
    await db.update(s.users).set({ ratingSum: sql`${s.users.ratingSum} + ${stars}`, ratingCount: sql`${s.users.ratingCount} + 1` }).where(eq(s.users.id, ride!.passengerId));
  } else fail("Esta corrida não é sua.");
  touchRide(ride!);
}

// ---------------------------------------------------------------- leitura

export async function rideView(ride: typeof s.rides.$inferSelect, viewer: "passenger" | "driver" | "share" | "staff") {
  const db = await getDb();
  const [driverRow] = ride.driverId ? await db.select({ u: s.users, d: s.drivers }).from(s.users).innerJoin(s.drivers, eq(s.users.id, s.drivers.userId)).where(eq(s.users.id, ride.driverId)) : [];
  const [vehicle] = ride.vehicleId ? await db.select().from(s.vehicles).where(eq(s.vehicles.id, ride.vehicleId)) : [];
  const [passenger] = await db.select().from(s.users).where(eq(s.users.id, ride.passengerId));
  const [category] = await db.select().from(s.categories).where(eq(s.categories.id, ride.categoryId));
  const [selfie] = ride.driverId ? await db.select({ id: s.documents.id }).from(s.documents).where(and(eq(s.documents.driverId, ride.driverId), eq(s.documents.kind, "selfie"), eq(s.documents.status, "approved"))) : [];
  const first = (n: string) => n.split(" ")[0];
  const base = {
    id: ride.id, status: ride.status, statusLabel: STATUS_LABEL[ride.status], categoryName: category?.name,
    origin: { label: ride.originLabel, lat: ride.originLat, lng: ride.originLng },
    dest: { label: ride.destLabel, lat: ride.destLat, lng: ride.destLng },
    stops: ride.stops, scheduledFor: ride.scheduledFor,
    geometry: ride.geometry, routeSource: ride.routeSource, distanceM: ride.distanceM, durationS: ride.durationS,
    createdAt: ride.createdAt, startedAt: ride.startedAt, endedAt: ride.endedAt,
    driver: driverRow ? {
      name: first(driverRow.u.name), rating: driverRow.u.ratingCount ? driverRow.u.ratingSum / driverRow.u.ratingCount : null,
      ratingCount: driverRow.u.ratingCount, lat: driverRow.d.lat, lng: driverRow.d.lng, hasPhoto: !!selfie,
      // Posição vem do GPS do celular do motorista: direção, precisão e há quanto tempo chegou.
      heading: driverRow.d.heading, accuracyM: driverRow.d.accuracyM, locationAt: driverRow.d.locationAt,
    } : null,
    vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, color: vehicle.color, plate: vehicle.plate } : null,
  };
  if (viewer === "share") return base;
  const money = {
    grossCents: ride.grossCents, serviceFeeCents: ride.serviceFeeCents, discountCents: ride.discountCents, totalCents: ride.totalCents,
    paymentMethod: ride.paymentMethod, paymentStatus: ride.paymentStatus,
  };
  const messages = ACTIVE_STATUSES.includes(ride.status) && viewer !== "staff"
    ? await db.select().from(s.rideMessages).where(eq(s.rideMessages.rideId, ride.id)).orderBy(s.rideMessages.createdAt) : [];
  const [payment] = await db.select().from(s.payments).where(eq(s.payments.rideId, ride.id));
  const me = viewer === "passenger" ? ride.passengerId : ride.driverId;
  const shared = { ...base, ...money, messages: messages.map((m) => ({ id: m.id, body: m.body, mine: m.senderId === me })), pixCopyPaste: payment?.status === "pending" ? payment.pixCopyPaste : null };
  // Quem embarca, quando a corrida foi pedida para outra pessoa. O celular só aparece para o motorista enquanto a corrida está aberta.
  const riderOpen = ride.riderName && ACTIVE_STATUSES.includes(ride.status);
  if (viewer === "passenger") {
    // Pix para o motorista: a chave dele e o "copia e cola" com o valor, a partir do início da viagem e até 24 h depois do fim.
    const pixOpen = ride.paymentMethod === "pix_driver" && driverRow?.d.pixKey
      && (ride.status === "in_progress" || (ride.status === "completed" && ride.endedAt && Date.now() - ride.endedAt.getTime() < 24 * 3600_000));
    let driverPix: { key: string; keyType: string | null; payload: string; name: string } | null = null;
    if (pixOpen) {
      const [region] = await db.select({ name: s.regions.name }).from(s.regions).where(eq(s.regions.id, ride.regionId));
      driverPix = { key: driverRow!.d.pixKey!, keyType: driverRow!.d.pixKeyType, name: driverRow!.u.name, payload: pixPayload({ key: driverRow!.d.pixKey!, name: driverRow!.u.name, city: region?.name ?? "Ipatinga", amountCents: ride.totalCents, txid: `Orbi${ride.id.replace(/-/g, "").slice(0, 12)}` }) };
    }
    return { ...shared, shareToken: ride.shareToken, myRating: ride.driverRating, rider: ride.riderName ? { name: ride.riderName, phone: ride.riderPhone } : null, driverPix };
  }
  const driverExtra = {
    commissionBps: ride.commissionBps, commissionCents: ride.commissionCents, driverNetCents: ride.driverNetCents,
    rider: riderOpen && viewer === "driver" ? { name: ride.riderName!, phone: ride.riderPhone } : ride.riderName ? { name: first(ride.riderName), phone: null } : null,
    passenger: { name: first(passenger.name), rating: passenger.ratingCount ? passenger.ratingSum / passenger.ratingCount : null, ratingCount: passenger.ratingCount },
    myRating: ride.passengerRating,
  };
  return { ...shared, ...driverExtra };
}

export async function activeRideFor(userId: string, as: "passenger" | "driver") {
  const db = await getDb();
  const owner = as === "passenger" ? s.rides.passengerId : s.rides.driverId;
  const [ride] = await db.select().from(s.rides).where(and(eq(owner, userId), inArray(s.rides.status, ACTIVE_STATUSES))).orderBy(desc(s.rides.createdAt)).limit(1);
  return ride ?? null;
}
