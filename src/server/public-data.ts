import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { getSetting } from "@/db/seed";
import { activeCategoriesWithTariff } from "./rides";

/**
 * Dados públicos do site: tarifas como estão no painel, motoristas online por cidade (só a contagem)
 * e o contato do atendimento. Nada que identifique pessoas.
 */

export type PublicCity = {
  id: string; slug: string; name: string; state: string; lat: number; lng: number; radiusKm: number;
  categories: { slug: string; name: string; description: string; seats: number; tariff: { baseCents: number; perKmCents: number; perMinCents: number; minCents: number; serviceFeeCents: number; commissionBps: number } }[];
};

export async function publicTariffs(): Promise<PublicCity[]> {
  const db = await getDb();
  const regions = await db.select().from(s.regions).where(eq(s.regions.active, true));
  return Promise.all(regions.map(async (r) => ({
    id: r.id, slug: r.slug, name: r.name, state: r.state, lat: r.lat, lng: r.lng, radiusKm: r.radiusKm,
    categories: (await activeCategoriesWithTariff(db, r.id)).map(({ category: c, tariff: t }) => ({
      slug: c.slug, name: c.name, description: c.description, seats: c.seats,
      tariff: { baseCents: t.baseCents, perKmCents: t.perKmCents, perMinCents: t.perMinCents, minCents: t.minCents, serviceFeeCents: t.serviceFeeCents, commissionBps: t.commissionBps },
    })),
  })));
}

/** Corridas concluídas nos últimos 30 dias suficientes para apontar um horário de pico sem chutar. */
const MIN_RIDES_FOR_PEAK = 20;

export type CityPulse = { regionId: string; online: number; peak: { from: number; to: number } | null };

export async function publicPulse(): Promise<CityPulse[]> {
  const db = await getDb();
  const fresh = new Date(Date.now() - 3 * 60_000);
  const regions = await db.select({ id: s.regions.id }).from(s.regions).where(eq(s.regions.active, true));
  const online = await db.select({ regionId: s.drivers.regionId, n: sql<number>`count(*)::int` }).from(s.drivers)
    .innerJoin(s.users, eq(s.drivers.userId, s.users.id))
    .where(and(eq(s.drivers.online, true), eq(s.drivers.status, "approved"), eq(s.users.status, "active"), gte(s.drivers.locationAt, fresh)))
    .groupBy(s.drivers.regionId);
  // Pico: a janela de duas horas com mais corridas concluídas, no horário de Brasília.
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const hours = await db.select({
    regionId: s.rides.regionId,
    h: sql<number>`extract(hour from ${s.rides.createdAt} at time zone 'America/Sao_Paulo')::int`,
    n: sql<number>`count(*)::int`,
  }).from(s.rides).where(and(eq(s.rides.status, "completed"), gte(s.rides.createdAt, since))).groupBy(s.rides.regionId, sql`2`);
  return regions.map((r) => {
    const byHour = Array.from({ length: 24 }, (_, h) => hours.find((x) => x.regionId === r.id && x.h === h)?.n ?? 0);
    const total = byHour.reduce((a, b) => a + b, 0);
    let peak: CityPulse["peak"] = null;
    if (total >= MIN_RIDES_FOR_PEAK) {
      let best = 0;
      for (let h = 1; h < 24; h++) if (byHour[h] + byHour[(h + 1) % 24] > byHour[best] + byHour[(best + 1) % 24]) best = h;
      peak = { from: best, to: (best + 2) % 24 };
    }
    return { regionId: r.id, online: online.find((o) => o.regionId === r.id)?.n ?? 0, peak };
  });
}

export async function publicSupport() {
  return getSetting(await getDb(), "support", { whatsapp: "" });
}
