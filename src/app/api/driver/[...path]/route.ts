import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { dataDir, getDb, schema as s } from "@/db";
import { getSetting } from "@/db/seed";
import { ApiError, audit, body, route } from "@/server/api";
import { publish, STAFF_CHANNEL, userChannel } from "@/server/bus";
import { activeRideFor, paymentRules, respondToOffer, rideView } from "@/server/rides";
import { normalizePixKey, PIX_KEY_TYPES, pixKeyMatches, type PixKeyType } from "@/domain/pix";
import { checkRateLimit } from "@/server/auth";
import { sniffFile } from "@/server/security";
import { withDefaultRules, DEFAULT_DRIVER_RULES, DOC_KINDS, DRIVER_TERMS_VERSION, driverProblems, vehicleProblems, type DriverRules } from "@/domain/driver-rules";
import { findRegion } from "@/domain/geo";
import { isValidCep, isValidCnh, isValidCpf, isValidPixKey, isValidPlate } from "@/domain/validation";
import { lookupCep } from "@/server/verify";

type P = { path: string[] };
const roles = { roles: ["driver" as const] };
const MAX_UPLOAD = 8 * 1024 * 1024;
const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const DOC_KIND_LIST: readonly string[] = DOC_KINDS;

/** Requisitos do motorista configurados no painel. */
const driverRules = (db: Awaited<ReturnType<typeof getDb>>) => getSetting<Partial<DriverRules>>(db, "driverRules", DEFAULT_DRIVER_RULES).then(withDefaultRules);

const manualLocationAllowed = () => process.env.ALLOW_MANUAL_LOCATION === "true" || process.env.NODE_ENV !== "production";

async function balance(userId: string) {
  const db = await getDb();
  const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(${s.ledger.amountCents}),0)::int` }).from(s.ledger).where(eq(s.ledger.driverId, userId));
  return total;
}

async function pendingOffer(userId: string) {
  const db = await getDb();
  const [row] = await db.select({ o: s.offers, r: s.rides }).from(s.offers).innerJoin(s.rides, eq(s.offers.rideId, s.rides.id))
    .where(and(eq(s.offers.driverId, userId), eq(s.offers.status, "pending"), gte(s.offers.expiresAt, new Date()))).limit(1);
  if (!row) return null;
  const { o, r } = row;
  const [plan] = await db.select({ p: s.plans, until: s.drivers.planUntil }).from(s.drivers).innerJoin(s.plans, eq(s.drivers.planId, s.plans.id)).where(eq(s.drivers.userId, userId));
  const bps = plan && plan.until && plan.until > new Date() ? plan.p.commissionBps : r.commissionBps;
  const commissionCents = Math.round((r.grossCents * bps) / 10000);
  return {
    id: o.id, expiresAt: o.expiresAt, pickupDistanceM: o.pickupDistanceM, pickupEtaS: o.pickupEtaS, breakdown: o.breakdown,
    origin: { label: r.originLabel, lat: r.originLat, lng: r.originLng }, dest: { label: r.destLabel, lat: r.destLat, lng: r.destLng }, stops: r.stops,
    geometry: r.geometry, distanceM: r.distanceM, durationS: r.durationS, paymentMethod: r.paymentMethod,
    grossCents: r.grossCents, commissionBps: bps, commissionCents, driverNetCents: r.grossCents - commissionCents, totalCents: r.totalCents,
  };
}

export const GET = route<P>(async ({ req, user, params }) => {
  const db = await getDb();
  const [what] = params.path;
  if (what === "state") {
    const [driver] = await db.select().from(s.drivers).where(eq(s.drivers.userId, user.id));
    const [docs, vehicles, categories, regions] = await Promise.all([
      db.select({ id: s.documents.id, kind: s.documents.kind, status: s.documents.status, reviewNote: s.documents.reviewNote }).from(s.documents).where(eq(s.documents.driverId, user.id)).orderBy(desc(s.documents.createdAt)),
      db.select().from(s.vehicles).where(eq(s.vehicles.driverId, user.id)),
      // Só categorias de modalidades ligadas no painel (a moto aparece quando o administrador libera).
      db.select({ id: s.categories.id, name: s.categories.name, description: s.categories.description, modalityId: s.categories.modalityId }).from(s.categories)
        .innerJoin(s.modalities, eq(s.categories.modalityId, s.modalities.id)).where(and(eq(s.categories.active, true), eq(s.modalities.active, true))),
      db.select().from(s.regions).where(eq(s.regions.active, true)),
    ]);
    const active = await activeRideFor(user.id, "driver");
    return {
      driver: driver ? { ...driver, cpf: undefined, cnh: undefined } : null, docs, vehicles, categories, regions,
      offer: await pendingOffer(user.id), ride: active ? await rideView(active, "driver") : null,
      balanceCents: await balance(user.id), manualLocationAllowed: manualLocationAllowed(), paymentRules: await paymentRules(db),
      driverRules: await driverRules(db), termsVersion: DRIVER_TERMS_VERSION,
      rating: user.ratingCount ? user.ratingSum / user.ratingCount : null, ratingCount: user.ratingCount,
    };
  }
  if (what === "finance") {
    const period = new URL(req.url).searchParams.get("period") ?? "day";
    const trunc = period === "month" ? "month" : period === "week" ? "week" : "day";
    const since = sql`date_trunc(${sql.raw(`'${trunc}'`)}, now())`;
    const [rides, entries, withdrawals, min] = await Promise.all([
      db.select().from(s.rides).where(and(eq(s.rides.driverId, user.id), eq(s.rides.status, "completed"), gte(s.rides.endedAt, since))).orderBy(desc(s.rides.endedAt)),
      db.select().from(s.ledger).where(eq(s.ledger.driverId, user.id)).orderBy(desc(s.ledger.createdAt)).limit(100),
      db.select().from(s.withdrawals).where(eq(s.withdrawals.driverId, user.id)).orderBy(desc(s.withdrawals.createdAt)).limit(30),
      getSetting(db, "withdrawal", { minCents: 2000 }),
    ]);
    return {
      period, balanceCents: await balance(user.id), minWithdrawalCents: min.minCents, entries, withdrawals,
      summary: {
        rides: rides.length,
        grossCents: rides.reduce((a, r) => a + r.grossCents, 0),
        commissionCents: rides.reduce((a, r) => a + r.commissionCents, 0),
        netCents: rides.reduce((a, r) => a + r.driverNetCents, 0),
        distanceM: rides.reduce((a, r) => a + r.distanceM, 0),
      },
      rides: rides.map((r) => ({ id: r.id, endedAt: r.endedAt, originLabel: r.originLabel, destLabel: r.destLabel, grossCents: r.grossCents, commissionCents: r.commissionCents, driverNetCents: r.driverNetCents, paymentMethod: r.paymentMethod, passengerRating: r.passengerRating })),
    };
  }
  if (what === "history") {
    const rides = await db.select().from(s.rides).where(eq(s.rides.driverId, user.id)).orderBy(desc(s.rides.createdAt)).limit(50);
    return { rides: await Promise.all(rides.map((r) => rideView(r, "driver"))) };
  }
  if (what === "club") {
    const [partners, saved, plans, campaigns] = await Promise.all([
      db.select().from(s.partners).where(eq(s.partners.active, true)),
      db.select({ s: s.partnerSavings, name: s.partners.name }).from(s.partnerSavings).innerJoin(s.partners, eq(s.partnerSavings.partnerId, s.partners.id)).where(eq(s.partnerSavings.driverId, user.id)).orderBy(desc(s.partnerSavings.createdAt)),
      db.select().from(s.plans).where(eq(s.plans.active, true)),
      db.select().from(s.campaigns).where(and(eq(s.campaigns.active, true), eq(s.campaigns.audience, "driver"))),
    ]);
    return {
      partners, plans, campaigns,
      savings: saved.map((r) => ({ ...r.s, partnerName: r.name })),
      totalSavedCents: saved.reduce((a, r) => a + (r.s.originalCents - r.s.paidCents), 0),
    };
  }
  throw new ApiError(404, "Recurso não encontrado.");
}, roles);

const onboardingSchema = z.object({
  cpf: z.string().transform((v) => v.replace(/\D/g, "")).refine(isValidCpf, "CPF inválido. Confira os números."),
  cnh: z.string().transform((v) => v.replace(/\D/g, "")).refine(isValidCnh, "Número da CNH inválido. Confira os números."),
  regionId: z.string().uuid("Escolha sua cidade."),
  cep: z.string().transform((v) => v.replace(/\D/g, "")).refine(isValidCep, "CEP inválido."),
  street: z.string().trim().max(160).default(""),
  number: z.string().trim().min(1, "Informe o número. Se não houver, escreva S/N.").max(20),
  complement: z.string().trim().max(80).default(""),
  district: z.string().trim().max(100).default(""),
  city: z.string().trim().max(100).default(""),
  state: z.string().trim().toUpperCase().max(2).default(""),
  // Regularização
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento."),
  cnhCategory: z.string().trim().toUpperCase().min(1, "Informe a categoria da CNH."),
  cnhFirstLicenseAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da primeira habilitação."),
  cnhExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a validade da CNH."),
  cnhEar: z.literal(true, { error: "A CNH precisa da observação EAR (Exerce Atividade Remunerada)." }),
  inss: z.literal(true, { error: "Confirme a inscrição no INSS como contribuinte individual ou MEI." }),
  acceptTerms: z.literal(true, { error: "Leia e aceite o Termo de adesão do motorista parceiro." }),
});
const vehicleSchema = z.object({
  categoryId: z.string().uuid("Escolha a categoria."), make: z.string().trim().min(2, "Informe a marca."), model: z.string().trim().min(1, "Informe o modelo."),
  color: z.string().trim().min(3, "Informe a cor."),
  plate: z.string().trim().toUpperCase().transform((v) => v.replace(/[^A-Z0-9]/g, "")).refine(isValidPlate, "Placa inválida: use o formato ABC1D23."),
  year: z.number({ error: "Informe o ano." }).int().min(1980, "Ano inválido.").max(new Date().getFullYear() + 1, "Ano inválido."),
  // Carro: portas, lugares e ar. Moto: não se aplica (o servidor grava 0 portas, 1 lugar na garupa, sem ar).
  doors: z.number({ error: "Informe o número de portas." }).int().min(0).max(6).default(0),
  seats: z.number({ error: "Informe o número de lugares." }).int().min(1).max(9).default(1),
  airConditioning: z.boolean().default(false),
  ownership: z.enum(["proprio", "alugado", "familiar", "financiado"], { error: "Diga de quem é o veículo." }),
  // Carro: placa vermelha (aluguel comercial) e carro adesivado não são aceitos, como nas demais plataformas.
  noRedPlate: z.boolean().default(false),
  // Moto: colete e capacete com faixas refletivas, protetor de motor e aparador de linha (Res. Contran 356/2010).
  motoGear: z.boolean().default(false),
});
const statusSchema = z.object({ online: z.boolean(), lat: z.number().optional(), lng: z.number().optional() });
// Posição do GPS do celular: direção (graus) e precisão (metros) quando o aparelho informa.
const locationSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), heading: z.number().min(0).max(360).nullish(), accuracy: z.number().min(0).max(100000).nullish() });
const paymentPrefsSchema = z.object({
  pixKeyType: z.enum(Object.keys(PIX_KEY_TYPES) as [PixKeyType, ...PixKeyType[]]).nullable(),
  pixKey: z.string().trim().max(120).nullable(),
  cardMachine: z.boolean(),
}).refine((v) => !v.pixKey || (v.pixKeyType && pixKeyMatches(v.pixKey, v.pixKeyType)), { message: "A chave Pix não confere com o tipo escolhido.", path: ["pixKey"] });
const withdrawalSchema = z.object({ amountCents: z.number().int().positive(), pixKey: z.string().trim().max(120).refine(isValidPixKey, "Chave Pix inválida: use CPF, CNPJ, celular, e-mail ou chave aleatória.") });
const savingSchema = z.object({ partnerId: z.string().uuid(), originalCents: z.number().int().positive("Informe o preço normal."), paidCents: z.number().int().min(0) }).refine((v) => v.paidCents <= v.originalCents, "O valor pago deve ser menor que o preço normal.");
const planSchema = z.object({ planId: z.string().uuid().nullable() });

export const POST = route<P>(async ({ req, user, params }) => {
  const db = await getDb();
  const [what, arg] = params.path;

  if (what === "onboarding") {
    const v = await body(req, onboardingSchema);
    const others = await db.select({ cpf: s.drivers.cpf, cnh: s.drivers.cnh }).from(s.drivers).where(and(or(eq(s.drivers.cpf, v.cpf), eq(s.drivers.cnh, v.cnh)), ne(s.drivers.userId, user.id)));
    if (others.some((o) => o.cpf === v.cpf)) throw new ApiError(409, "Este CPF já está em outro cadastro. Se for o seu, fale com o suporte.");
    if (others.length) throw new ApiError(409, "Esta CNH já está em outro cadastro. Se for a sua, fale com o suporte.");

    // O endereço oficial do CEP prevalece sobre o digitado. Com o serviço fora do ar, o cadastro segue marcado como não confirmado.
    const found = await lookupCep(v.cep);
    if (found === null) throw new ApiError(400, "CEP não encontrado. Confira os números.");
    const official = found === "unavailable" ? null : found;
    const address = {
      addressCep: v.cep, addressNumber: v.number, addressComplement: v.complement || null,
      addressStreet: official?.street || v.street, addressDistrict: official?.district || v.district,
      addressCity: official?.city || v.city, addressState: official?.state || v.state, addressVerified: Boolean(official),
    };
    if (!address.addressStreet || !address.addressCity || address.addressState.length !== 2) throw new ApiError(400, "Preencha rua, cidade e estado.");
    const rules = await driverRules(db);
    const problems = driverProblems({ birthDate: new Date(`${v.birthDate}T12:00:00`), cnhCategory: v.cnhCategory, cnhFirstLicenseAt: new Date(`${v.cnhFirstLicenseAt}T12:00:00`), cnhExpiresAt: new Date(`${v.cnhExpiresAt}T23:59:59`), ear: v.cnhEar }, rules);
    if (problems.length) throw new ApiError(400, problems.join(" "));
    const values = {
      cpf: v.cpf, cnh: v.cnh, regionId: v.regionId, ...address,
      birthDate: v.birthDate, cnhCategory: v.cnhCategory, cnhFirstLicenseAt: v.cnhFirstLicenseAt, cnhExpiresAt: v.cnhExpiresAt, cnhEar: true,
      inssDeclaredAt: new Date(), termsVersion: DRIVER_TERMS_VERSION, termsAcceptedAt: new Date(),
    };
    await db.insert(s.drivers).values({ userId: user.id, ...values }).onConflictDoUpdate({ target: s.drivers.userId, set: { ...values, status: "pending" } });
    await db.insert(s.modalityEnrollments).values({ driverId: user.id, modalityId: "corrida-carro" }).onConflictDoNothing();
    await audit(user.id, "driver.onboarding", "driver", user.id, { termsVersion: DRIVER_TERMS_VERSION });
    publish(STAFF_CHANNEL, "driver");
    return { ok: true };
  }
  if (what === "documents") {
    // Tamanho conferido antes de ler: um envio enorme não chega a ocupar a memória do servidor.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (!declared || declared > MAX_UPLOAD + 64 * 1024) throw new ApiError(413, "O arquivo pode ter até 8 MB.");
    if (!checkRateLimit(`upload:${user.id}`, 20, 60 * 60_000)) throw new ApiError(429, "Muitos envios. Aguarde uma hora.");
    const form = await req.formData();
    const kind = String(form.get("kind"));
    const file = form.get("file");
    if (!DOC_KIND_LIST.includes(kind)) throw new ApiError(400, "Tipo de documento inválido.");
    if (!(file instanceof File)) throw new ApiError(400, "Selecione um arquivo.");
    if (file.size > MAX_UPLOAD) throw new ApiError(400, "O arquivo pode ter até 8 MB.");
    const buf = Buffer.from(await file.arrayBuffer());
    // O tipo vem do conteúdo, não do que o navegador declarou: um arquivo disfarçado de foto é recusado.
    const mime = sniffFile(buf);
    const ext = mime ? MIME[mime] : null;
    if (!mime || !ext) throw new ApiError(400, "Envie JPG, PNG, WEBP ou PDF.");
    const dir = path.join(dataDir(), "uploads");
    await fs.mkdir(dir, { recursive: true });
    const storedName = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(dir, storedName), buf, { mode: 0o600 });
    const [doc] = await db.insert(s.documents).values({ driverId: user.id, kind, storedName, mime }).returning();
    await audit(user.id, "document.upload", "document", doc.id, { kind });
    publish(STAFF_CHANNEL, "driver");
    return { id: doc.id, kind, status: doc.status };
  }
  if (what === "vehicle") {
    const { noRedPlate, motoGear, ...v } = await body(req, vehicleSchema);
    const [cat] = await db.select({ modalityId: s.categories.modalityId, modalityActive: s.modalities.active }).from(s.categories)
      .innerJoin(s.modalities, eq(s.categories.modalityId, s.modalities.id)).where(and(eq(s.categories.id, v.categoryId), eq(s.categories.active, true)));
    if (!cat) throw new ApiError(400, "Escolha uma categoria disponível.");
    const moto = cat.modalityId === "corrida-moto";
    // Moto só onde o município autoriza: o administrador liga a modalidade no painel.
    if (!cat.modalityActive) throw new ApiError(409, moto ? "Corridas de moto ainda não estão liberadas. Assim que a cidade autorizar, o cadastro abre aqui." : "Esta modalidade não está ativa.");
    if (!moto && !noRedPlate) throw new ApiError(400, "Confirme que o carro não tem placa vermelha nem adesivos comerciais.");
    const [drv] = await db.select({ cnhCategory: s.drivers.cnhCategory, cnhFirstLicenseAt: s.drivers.cnhFirstLicenseAt }).from(s.drivers).where(eq(s.drivers.userId, user.id));
    const problems = vehicleProblems({ ...v, kind: moto ? "moto" : "car", motoGear }, await driverRules(db), new Date(),
      drv ? { cnhCategory: drv.cnhCategory, cnhFirstLicenseAt: drv.cnhFirstLicenseAt ? new Date(`${drv.cnhFirstLicenseAt}T12:00:00`) : null } : undefined);
    if (problems.length) throw new ApiError(400, problems.join(" "));
    const dup = await db.select({ id: s.vehicles.id }).from(s.vehicles).where(eq(s.vehicles.plate, v.plate));
    if (dup.length) throw new ApiError(409, "Esta placa já está cadastrada.");
    const [row] = await db.insert(s.vehicles).values({ driverId: user.id, ...v, ...(moto ? { doors: 0, seats: 1, airConditioning: false } : {}) }).returning();
    if (moto) await db.insert(s.modalityEnrollments).values({ driverId: user.id, modalityId: "corrida-moto" }).onConflictDoNothing();
    await audit(user.id, "vehicle.create", "vehicle", row.id);
    publish(STAFF_CHANNEL, "driver");
    return row;
  }
  if (what === "status") {
    const v = await body(req, statusSchema);
    const [driver] = await db.select().from(s.drivers).where(eq(s.drivers.userId, user.id));
    if (!driver) throw new ApiError(409, "Conclua seu cadastro primeiro.");
    if (!v.online) {
      await db.update(s.drivers).set({ online: false, idleSince: null }).where(eq(s.drivers.userId, user.id));
      publish(STAFF_CHANNEL, "driver");
      return { online: false };
    }
    if (driver.status !== "approved") throw new ApiError(409, "Seu cadastro ainda não foi aprovado.");
    // CNH vencida não roda: a regularidade vale todos os dias, não só no cadastro.
    if (driver.cnhExpiresAt && new Date(`${driver.cnhExpiresAt}T23:59:59`) < new Date()) throw new ApiError(409, "Sua CNH venceu. Envie a CNH renovada para voltar a rodar.");
    if (v.lat === undefined || v.lng === undefined) throw new ApiError(400, "Precisamos da sua localização para ficar online.");
    const approved = await db.select({ id: s.vehicles.id }).from(s.vehicles).where(and(eq(s.vehicles.driverId, user.id), eq(s.vehicles.status, "approved")));
    if (!approved.length) throw new ApiError(409, "Você precisa de um veículo aprovado para ficar online.");
    const regions = await db.select().from(s.regions);
    const region = findRegion({ lat: v.lat, lng: v.lng }, regions);
    if (!region) throw new ApiError(409, "Você está fora da área de atendimento da Orbi.");
    await db.update(s.drivers).set({ online: true, lat: v.lat, lng: v.lng, locationAt: new Date(), regionId: region.id, idleSince: sql`coalesce(${s.drivers.idleSince}, now())` }).where(eq(s.drivers.userId, user.id));
    publish(STAFF_CHANNEL, "driver");
    return { online: true, region: region.name };
  }
  if (what === "payment-prefs") {
    const v = await body(req, paymentPrefsSchema);
    const key = v.pixKey && v.pixKeyType ? normalizePixKey(v.pixKey, v.pixKeyType) : null;
    await db.update(s.drivers).set({ pixKey: key, pixKeyType: key ? v.pixKeyType : null, cardMachine: v.cardMachine }).where(eq(s.drivers.userId, user.id));
    await audit(user.id, "driver.payment_prefs", "driver", user.id, { pix: !!key, cardMachine: v.cardMachine });
    return { ok: true, pixKey: key };
  }
  if (what === "location") {
    const v = await body(req, locationSchema);
    await db.update(s.drivers).set({ lat: v.lat, lng: v.lng, heading: v.heading ?? null, accuracyM: v.accuracy ?? null, locationAt: new Date() }).where(eq(s.drivers.userId, user.id));
    const active = await activeRideFor(user.id, "driver");
    if (active) publish(userChannel(active.passengerId), "ride");
    return { ok: true };
  }
  if (what === "offers" && arg) {
    const v = await body(req, z.object({ accept: z.boolean() }));
    return respondToOffer(user.id, arg, v.accept);
  }
  if (what === "withdrawals") {
    const v = await body(req, withdrawalSchema);
    const min = await getSetting(db, "withdrawal", { minCents: 2000 });
    if (v.amountCents < min.minCents) throw new ApiError(400, "Valor abaixo do mínimo para saque.");
    if (v.amountCents > (await balance(user.id))) throw new ApiError(409, "Saldo insuficiente.");
    const [row] = await db.insert(s.withdrawals).values({ driverId: user.id, ...v }).returning();
    await db.insert(s.ledger).values({ driverId: user.id, type: "withdrawal", amountCents: -v.amountCents, description: "Saque solicitado" });
    await audit(user.id, "withdrawal.request", "withdrawal", row.id, { amountCents: v.amountCents });
    publish(STAFF_CHANNEL, "finance");
    return row;
  }
  if (what === "savings") {
    const v = await body(req, savingSchema);
    const [partner] = await db.select().from(s.partners).where(and(eq(s.partners.id, v.partnerId), eq(s.partners.active, true)));
    if (!partner) throw new ApiError(404, "Parceiro não encontrado.");
    return (await db.insert(s.partnerSavings).values({ driverId: user.id, ...v }).returning())[0];
  }
  if (what === "plan") {
    const v = await body(req, planSchema);
    if (!v.planId) {
      await db.update(s.drivers).set({ planId: null, planUntil: null }).where(eq(s.drivers.userId, user.id));
      return { ok: true };
    }
    const [plan] = await db.select().from(s.plans).where(and(eq(s.plans.id, v.planId), eq(s.plans.active, true)));
    if (!plan) throw new ApiError(404, "Plano não encontrado.");
    if ((await balance(user.id)) < plan.priceCents) throw new ApiError(409, "Saldo insuficiente para assinar este plano.");
    await db.insert(s.ledger).values({ driverId: user.id, type: "plan", amountCents: -plan.priceCents, description: `Assinatura: ${plan.name}` });
    await db.update(s.drivers).set({ planId: plan.id, planUntil: new Date(Date.now() + plan.periodDays * 86400_000) }).where(eq(s.drivers.userId, user.id));
    await audit(user.id, "plan.subscribe", "plan", plan.id);
    return { ok: true };
  }
  throw new ApiError(404, "Ação desconhecida.");
}, roles);

