import { describe, expect, it } from "vitest";
import { couponDiscount, ledgerEffect, quoteFare } from "@/domain/pricing";
import { DEFAULT_WEIGHTS, rankCandidates, type Candidate, type RideContext } from "@/domain/dispatch";
import { findRegion, haversineM } from "@/domain/geo";
import { can } from "@/domain/permissions";
import { canTransition } from "@/domain/transitions";

const tariff = { baseCents: 500, perKmCents: 200, perMinCents: 50, minCents: 800, serviceFeeCents: 100, commissionBps: 1500 };

describe("preço", () => {
  it("soma bruto, comissão e líquido sem perder centavos", () => {
    const q = quoteFare(tariff, 10000, 1200);
    expect(q.grossCents).toBe(500 + 2000 + 1000);
    expect(q.commissionCents + q.driverNetCents).toBe(q.grossCents);
    expect(q.totalCents).toBe(q.grossCents + 100);
  });
  it("aplica o mínimo", () => expect(quoteFare(tariff, 100, 30).grossCents).toBe(800));
  it("cupom não reduz o líquido do motorista", () => {
    const a = quoteFare(tariff, 10000, 1200);
    const b = quoteFare(tariff, 10000, 1200, { discountCents: 1000 });
    expect(b.driverNetCents).toBe(a.driverNetCents);
    expect(b.totalCents).toBe(a.totalCents - 1000);
  });
  it("plano substitui a comissão da tarifa", () => {
    expect(quoteFare(tariff, 10000, 1200, { commissionBps: 500 }).commissionCents).toBe(175);
  });
  it("desconto nunca deixa o total negativo", () => {
    expect(quoteFare(tariff, 10000, 1200, { discountCents: 999999 }).totalCents).toBe(0);
  });
});

describe("cupom", () => {
  const base = { kind: "percent", value: 2000, maxDiscountCents: 500, maxUses: 2, used: 0, validUntil: null, active: true };
  it("respeita o teto", () => expect(couponDiscount(base, 10000)).toBe(500));
  it("recusa esgotado", () => expect(couponDiscount({ ...base, used: 2 }, 10000)).toBe(0));
  it("recusa vencido", () => expect(couponDiscount({ ...base, validUntil: new Date(0) }, 10000)).toBe(0));
  it("recusa inativo", () => expect(couponDiscount({ ...base, active: false }, 10000)).toBe(0));
});

describe("saldo do motorista", () => {
  it("digital credita o líquido", () => {
    expect(ledgerEffect("pix", { totalCents: 1100, driverNetCents: 850 })).toEqual({ type: "ride_net", amountCents: 850 });
  });
  it("dinheiro registra a parte da Orbi como débito", () => {
    expect(ledgerEffect("cash", { totalCents: 1100, driverNetCents: 850 })).toEqual({ type: "cash_due", amountCents: -250 });
  });
  it("dinheiro com cupom grande credita o motorista", () => {
    expect(ledgerEffect("cash", { totalCents: 300, driverNetCents: 850 }).amountCents).toBe(550);
  });
});

describe("distribuição", () => {
  const ride: RideContext = { origin: { lat: -19.47, lng: -42.54 }, categoryId: "c", regionId: "r", driverNetCents: 1500 };
  const cand = (over: Partial<Candidate>): Candidate => ({
    driverId: "d", lat: -19.475, lng: -42.54, online: true, approved: true, busy: false, categoryIds: ["c"], regionId: "r",
    locationAgeS: 5, idleS: 0, offersTotal: 0, offersAccepted: 0, cancelsTotal: 0, ridesTotal: 0, ratingSum: 0, ratingCount: 0,
    earnedTodayCents: 0, declinedThisRide: false, ...over,
  });
  it("exclui quem não pode atender", () => {
    for (const over of [{ online: false }, { approved: false }, { busy: true }, { categoryIds: ["x"] }, { regionId: "y" },
      { locationAgeS: 600 }, { declinedThisRide: true }, { lat: -19.9 }]) {
      expect(rankCandidates([cand(over)], ride)).toHaveLength(0);
    }
  });
  it("prefere o mais próximo quando o resto é igual", () => {
    const r = rankCandidates([cand({ driverId: "longe", lat: -19.50 }), cand({ driverId: "perto" })], ride);
    expect(r[0].candidate.driverId).toBe("perto");
  });
  it("não é só distância: quem está parado há muito e ganhou menos passa à frente de um vizinho próximo", () => {
    const r = rankCandidates([
      cand({ driverId: "vizinho", lat: -19.4705, earnedTodayCents: 30000, idleS: 0 }),
      cand({ driverId: "esperando", lat: -19.48, earnedTodayCents: 0, idleS: 3000 }),
    ], ride);
    expect(r[0].candidate.driverId).toBe("esperando");
  });
  it("motorista novo não é punido por falta de histórico", () => {
    const [novo] = rankCandidates([cand({})], ride);
    const [ruim] = rankCandidates([cand({ offersTotal: 20, offersAccepted: 4, cancelsTotal: 10, ridesTotal: 10, ratingSum: 30, ratingCount: 10 })], ride);
    expect(novo.score).toBeGreaterThan(ruim.score);
  });
  it("pesos configuráveis mudam o resultado", () => {
    const only = { ...DEFAULT_WEIGHTS, eta: 100, idle: 0, earningsBalance: 0, netPerKm: 0, acceptance: 0, cancellation: 0, rating: 0 };
    const r = rankCandidates([
      cand({ driverId: "vizinho", lat: -19.4705, earnedTodayCents: 30000 }),
      cand({ driverId: "esperando", lat: -19.48, idleS: 3000 }),
    ], ride, only);
    expect(r[0].candidate.driverId).toBe("vizinho");
  });
});

describe("regiões", () => {
  const regions = [
    { lat: -19.4683, lng: -42.5367, radiusKm: 12, active: true, name: "Ipatinga" },
    { lat: -19.5811, lng: -42.6471, radiusKm: 12, active: false, name: "Timóteo" },
  ];
  it("encontra a região pelo raio", () => expect(findRegion({ lat: -19.47, lng: -42.54 }, regions)?.name).toBe("Ipatinga"));
  it("ignora região inativa", () => expect(findRegion({ lat: -19.5811, lng: -42.6471 }, regions)).toBeNull());
  it("distância conhecida", () => expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2));
});

describe("permissões", () => {
  it("atendente trata chamados mas não mexe em tarifas nem em equipe", () => {
    expect(can("atendente", "tickets", "write")).toBe(true);
    expect(can("atendente", "tariffs", "write")).toBe(false);
    expect(can("atendente", "tariffs", "read")).toBe(false);
    expect(can("atendente", "users", "write")).toBe(false);
  });
  it("gestor configura tarifas mas não gerencia equipe", () => {
    expect(can("gestor", "tariffs", "write")).toBe(true);
    expect(can("gestor", "staff", "write")).toBe(false);
  });
  it("passageiro e motorista não entram no painel", () => {
    expect(can("passenger", "dashboard", "read")).toBe(false);
    expect(can("driver", "rides", "read")).toBe(false);
  });
});

describe("estados da corrida", () => {
  it("não termina sem começar", () => expect(canTransition("accepted", "completed")).toBe(false));
  it("não cancela durante a viagem", () => expect(canTransition("in_progress", "cancelled")).toBe(false));
  it("corrida encerrada não muda", () => expect(canTransition("completed", "cancelled")).toBe(false));
});
