import { eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import * as s from "./schema";
import { DEFAULT_WEIGHTS } from "@/domain/dispatch";

/**
 * Só configuração de base: cidades da primeira operação, modalidades, categorias e tarifas iniciais.
 * Nenhum motorista, passageiro, corrida, pagamento ou parceiro é criado aqui.
 * As tarifas nascem com reviewedAt nulo: o painel avisa até um gestor revisar os valores.
 */
const CITIES = [
  { slug: "ipatinga", name: "Ipatinga", state: "MG", lat: -19.4683, lng: -42.5367, radiusKm: 12 },
  { slug: "coronel-fabriciano", name: "Coronel Fabriciano", state: "MG", lat: -19.5186, lng: -42.6289, radiusKm: 9 },
  { slug: "timoteo", name: "Timóteo", state: "MG", lat: -19.5811, lng: -42.6471, radiusKm: 10 },
];

const MODALITIES = [
  { id: "corrida-carro", name: "Corridas de carro", active: true, description: "Transporte individual de passageiros em carro.",
    legalNote: "", requiredDocuments: ["cnh", "crlv", "selfie"] },
  { id: "corrida-moto", name: "Corridas de motocicleta", active: false, description: "Transporte de passageiros em motocicleta.",
    legalNote: "Ativar só depois de confirmar a permissão legal em cada município.", requiredDocuments: ["cnh", "crlv", "selfie", "curso-mototaxi"] },
  { id: "motofrete", name: "Motofrete", active: false, description: "Coleta e entrega de volumes em motocicleta.",
    legalNote: "Exige conformidade com as regras de motofrete do Contran.", requiredDocuments: ["cnh", "crlv", "selfie", "curso-motofrete"] },
  { id: "entregas", name: "Entregas", active: false, description: "Entregas urbanas de pequeno porte.", legalNote: "", requiredDocuments: ["cnh", "crlv", "selfie"] },
  { id: "corporativo", name: "Transporte corporativo", active: false, description: "Corridas faturadas para empresas.", legalNote: "Depende de contrato com cada empresa.", requiredDocuments: ["cnh", "crlv", "selfie"] },
];

const CATEGORIES = [
  { slug: "essencial", name: "Essencial", description: "Carro com até 4 passageiros", seats: 4, tariff: { baseCents: 400, perKmCents: 190, perMinCents: 30, minCents: 800, serviceFeeCents: 100, commissionBps: 1500 } },
  { slug: "conforto", name: "Conforto", description: "Carro maior, mais espaço", seats: 4, tariff: { baseCents: 550, perKmCents: 240, perMinCents: 38, minCents: 1100, serviceFeeCents: 100, commissionBps: 1500 } },
  { slug: "familia", name: "Família", description: "Até 6 passageiros", seats: 6, tariff: { baseCents: 700, perKmCents: 300, perMinCents: 45, minCents: 1500, serviceFeeCents: 100, commissionBps: 1500 } },
];

/**
 * Categoria Moto (mototáxi): uma pessoa na garupa. Tarifa inicial mais baixa que a do carro, a revisar no painel.
 * A modalidade "corrida-moto" nasce desligada: só vale onde o município autoriza, e quem liga é o administrador.
 */
const MOTO = { slug: "moto", name: "Moto", description: "Uma pessoa na garupa, capacete incluso", seats: 1,
  tariff: { baseCents: 300, perKmCents: 130, perMinCents: 18, minCents: 600, serviceFeeCents: 100, commissionBps: 1500 } };

/** Cria a categoria Moto e as tarifas dela em cada cidade, também em bancos que já existiam antes dela. */
async function ensureMotoCategory(db: Db) {
  const [exists] = await db.select({ id: s.categories.id }).from(s.categories).where(eq(s.categories.slug, MOTO.slug));
  if (exists) return;
  await db.insert(s.modalities).values(MODALITIES.filter((m) => m.id === "corrida-moto")).onConflictDoNothing();
  const [cat] = await db.insert(s.categories).values({ modalityId: "corrida-moto", slug: MOTO.slug, name: MOTO.name, description: MOTO.description, seats: MOTO.seats }).returning();
  const regions = await db.select({ id: s.regions.id }).from(s.regions);
  if (regions.length) await db.insert(s.tariffs).values(regions.map((r) => ({ regionId: r.id, categoryId: cat.id, ...MOTO.tariff })));
}

export async function seedBaseConfig(db: Db) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.regions);
  if (n > 0) { await ensureMotoCategory(db); return; }

  await db.insert(s.modalities).values(MODALITIES).onConflictDoNothing();
  const regions = await db.insert(s.regions).values(CITIES).returning();
  for (const c of CATEGORIES) {
    const [cat] = await db.insert(s.categories).values({ modalityId: "corrida-carro", slug: c.slug, name: c.name, description: c.description, seats: c.seats }).returning();
    await db.insert(s.tariffs).values(regions.map((r) => ({ regionId: r.id, categoryId: cat.id, ...c.tariff })));
  }
  await ensureMotoCategory(db);
  await db.insert(s.settings).values([
    { key: "identity", value: "a" },
    { key: "dispatchWeights", value: DEFAULT_WEIGHTS },
    { key: "dispatch", value: { offerTimeoutS: 20, searchTimeoutS: 180 } },
    { key: "withdrawal", value: { minCents: 2000 } },
  ]).onConflictDoNothing();
}

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(s.settings).where(eq(s.settings.key, key));
  return row ? (row.value as T) : fallback;
}
