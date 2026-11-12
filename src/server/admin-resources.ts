import { z, type ZodType } from "zod";
import { desc } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { schema as s } from "@/db";
import type { Resource } from "@/domain/permissions";

const money = z.number().int().min(0, "Valor não pode ser negativo.");
const bps = z.number().int().min(0).max(10000, "Percentual máximo: 100%.");
const date = z.string().nullish().transform((v) => (v ? new Date(v) : null));
const text = (msg: string) => z.string().trim().min(1, msg);

type Def = {
  table: PgTable & { id?: unknown };
  permission: Resource;
  /** Validação de criação. Sem ela, o recurso não aceita POST. */
  create?: ZodType<Record<string, unknown>>;
  /** Campos editáveis. */
  update?: ZodType<Record<string, unknown>>;
  remove?: boolean;
  order?: unknown;
};

const coupon = z.object({
  code: text("Informe o código.").transform((v) => v.toUpperCase()), kind: z.enum(["percent", "fixed"]), value: z.number().int().positive("Informe o valor."),
  maxDiscountCents: money.nullish(), maxUses: z.number().int().positive().nullish(), validUntil: date, active: z.boolean().default(true),
});
const campaign = z.object({
  name: text("Informe o nome."), audience: z.enum(["driver", "passenger"]), kind: z.enum(["promo", "bonus"]), description: z.string().default(""),
  bonusPerRideCents: money.default(0), regionId: z.string().uuid().nullish(), startsAt: date, endsAt: date, active: z.boolean().default(false),
});
const partner = z.object({
  name: text("Informe o nome."), category: text("Informe a categoria."), city: text("Informe a cidade."), address: z.string().default(""),
  phone: z.string().default(""), benefit: text("Descreva o benefício."), active: z.boolean().default(true),
});
const plan = z.object({
  name: text("Informe o nome."), description: z.string().default(""), priceCents: money, periodDays: z.number().int().positive(), commissionBps: bps, active: z.boolean().default(true),
});
const region = z.object({
  slug: text("Informe o identificador."), name: text("Informe o nome."), state: text("Informe a UF."), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  radiusKm: z.number().positive(), active: z.boolean().default(true),
});
const tariffEdit = z.object({
  baseCents: money, perKmCents: money, perMinCents: money, minCents: money, serviceFeeCents: money, commissionBps: bps,
}).partial().transform((v) => ({ ...v, reviewedAt: new Date() }));
const category = z.object({
  modalityId: text("Escolha a modalidade."), slug: text("Informe o identificador."), name: text("Informe o nome."), description: z.string().default(""),
  seats: z.number().int().positive(), active: z.boolean().default(true),
});

export const RESOURCES: Record<string, Def> = {
  coupons: { table: s.coupons, permission: "coupons", create: coupon, update: coupon.partial(), remove: true },
  campaigns: { table: s.campaigns, permission: "campaigns", create: campaign, update: campaign.partial(), remove: true },
  partners: { table: s.partners, permission: "partners", create: partner, update: partner.partial(), remove: true },
  plans: { table: s.plans, permission: "plans", create: plan, update: plan.partial() },
  regions: { table: s.regions, permission: "regions", create: region, update: region.partial() },
  categories: { table: s.categories, permission: "categories", create: category, update: category.partial() },
  tariffs: { table: s.tariffs, permission: "tariffs", update: tariffEdit },
  modalities: { table: s.modalities, permission: "modalities", update: z.object({ active: z.boolean(), legalNote: z.string() }).partial() },
  leads: { table: s.leads, permission: "leads", order: desc(s.leads.createdAt) },
  audit: { table: s.auditLog, permission: "audit", order: desc(s.auditLog.createdAt) },
};
