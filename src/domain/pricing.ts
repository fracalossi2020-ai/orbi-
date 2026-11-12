import { isDirect, type PaymentMethod } from "./payment-methods";

export type Tariff = {
  baseCents: number; perKmCents: number; perMinCents: number; minCents: number;
  serviceFeeCents: number; commissionBps: number;
};
export type Coupon = {
  kind: string; value: number; maxDiscountCents: number | null; maxUses: number | null; used: number;
  validUntil: Date | null; active: boolean;
};

export function couponDiscount(c: Coupon, subtotalCents: number, now = new Date()): number {
  if (!c.active) return 0;
  if (c.validUntil && c.validUntil < now) return 0;
  if (c.maxUses !== null && c.used >= c.maxUses) return 0;
  let d = c.kind === "percent" ? Math.round((subtotalCents * c.value) / 10000) : c.value;
  if (c.maxDiscountCents !== null) d = Math.min(d, c.maxDiscountCents);
  return Math.min(d, subtotalCents);
}

/**
 * Regra de transparência: comissão incide só sobre o valor bruto da corrida.
 * Cupom é custeado pela Orbi e nunca reduz o líquido do motorista;
 * taxa de serviço é cobrada do passageiro e não sai do motorista.
 */
export function quoteFare(t: Tariff, distanceM: number, durationS: number, opts: { commissionBps?: number; discountCents?: number } = {}) {
  const raw = t.baseCents + (t.perKmCents * distanceM) / 1000 + (t.perMinCents * durationS) / 60;
  const grossCents = Math.max(t.minCents, Math.round(raw));
  const commissionBps = opts.commissionBps ?? t.commissionBps;
  const commissionCents = Math.round((grossCents * commissionBps) / 10000);
  const driverNetCents = grossCents - commissionCents;
  const discountCents = Math.min(opts.discountCents ?? 0, grossCents + t.serviceFeeCents);
  const totalCents = grossCents + t.serviceFeeCents - discountCents;
  return { grossCents, serviceFeeCents: t.serviceFeeCents, discountCents, totalCents, commissionBps, commissionCents, driverNetCents };
}

/**
 * Efeito de uma corrida concluída no saldo do motorista.
 * Pelo app: a Orbi recebeu, e credita o líquido.
 * Direto ao motorista (dinheiro, Pix na chave dele, maquininha dele): ele recebeu tudo, e o saldo registra
 * a diferença entre o que recebeu e o líquido. Com cupom grande, essa diferença pode ser positiva: a Orbi paga o motorista.
 */
export function ledgerEffect(method: PaymentMethod, fare: { totalCents: number; driverNetCents: number }) {
  return isDirect(method)
    ? { type: "cash_due" as const, amountCents: fare.driverNetCents - fare.totalCents }
    : { type: "ride_net" as const, amountCents: fare.driverNetCents };
}

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
