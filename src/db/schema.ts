import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["passenger", "driver", "admin", "gestor", "atendente"]);
export const rideStatusEnum = pgEnum("ride_status", ["scheduled", "searching", "accepted", "arrived", "in_progress", "completed", "cancelled", "no_driver"]);
// pix_driver: Pix na chave do motorista; card_machine: maquininha do motorista. Os dois são pagos direto a ele, como o dinheiro.
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "pix", "card", "pix_driver", "card_machine"]);
export const reviewEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("passenger"),
  status: text("status").notNull().default("active"), // active | suspended | deleted
  ratingSum: integer("rating_sum").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  // Conta Google vinculada (o "sub" do Google, que não muda). Nulo para quem entra só com senha.
  googleSub: text("google_sub").unique(),
  // Verificação em duas etapas (aplicativo autenticador). O segredo fica cifrado com a chave do servidor.
  totpSecret: text("totp_secret"),
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  // Último passo de 30 s aceito: o mesmo código não vale duas vezes.
  totpLastStep: integer("totp_last_step"),
  // Códigos de recuperação (resumos), para quem perder o celular.
  recoveryCodes: jsonb("recovery_codes").$type<string[]>(),
  createdAt: createdAt(),
});

/**
 * Sessões abertas. O cookie leva o id da sessão: sair, trocar a senha ou excluir a conta encerra a sessão de verdade,
 * em vez de só apagar o cookie do navegador.
 */
export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  // Quando a segunda etapa (código do autenticador) foi confirmada nesta sessão.
  mfaAt: timestamp("mfa_at", { withTimezone: true }),
}, (t) => [index("sessions_user").on(t.userId)]);

/** Códigos de 6 dígitos enviados por e-mail. Só o resumo (hash) fica guardado. */
export const verificationCodes = pgTable("verification_codes", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  purpose: text("purpose").notNull(), // email_verify | password_reset
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("verification_codes_user").on(t.userId, t.purpose)]);

export const regions = pgTable("regions", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  radiusKm: doublePrecision("radius_km").notNull(),
  active: boolean("active").notNull().default(true),
});

/** Cada modalidade tem regras e cadastro próprios; novas modalidades não exigem mudança estrutural. */
export const modalities = pgTable("modalities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(false),
  legalNote: text("legal_note").notNull().default(""),
  requiredDocuments: jsonb("required_documents").$type<string[]>().notNull().default([]),
});

export const categories = pgTable("categories", {
  id: id(),
  modalityId: text("modality_id").notNull().references(() => modalities.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  seats: integer("seats").notNull().default(4),
  active: boolean("active").notNull().default(true),
});

export const tariffs = pgTable("tariffs", {
  id: id(),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  baseCents: integer("base_cents").notNull(),
  perKmCents: integer("per_km_cents").notNull(),
  perMinCents: integer("per_min_cents").notNull(),
  minCents: integer("min_cents").notNull(),
  serviceFeeCents: integer("service_fee_cents").notNull().default(0),
  commissionBps: integer("commission_bps").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("tariff_region_category").on(t.regionId, t.categoryId)]);

export const plans = pgTable("plans", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  periodDays: integer("period_days").notNull().default(30),
  commissionBps: integer("commission_bps").notNull(),
  active: boolean("active").notNull().default(true),
});

export const drivers = pgTable("drivers", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | suspended
  reviewNote: text("review_note"),
  cpf: text("cpf").notNull(),
  cnh: text("cnh").notNull(),
  addressCep: text("address_cep"),
  addressStreet: text("address_street"),
  addressNumber: text("address_number"),
  addressComplement: text("address_complement"),
  addressDistrict: text("address_district"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressVerified: boolean("address_verified").notNull().default(false),
  regionId: uuid("region_id").references(() => regions.id),
  planId: uuid("plan_id").references(() => plans.id),
  planUntil: timestamp("plan_until", { withTimezone: true }),
  online: boolean("online").notNull().default(false),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationAt: timestamp("location_at", { withTimezone: true }),
  // Vindos do GPS do celular: direção do movimento (graus) e precisão (metros).
  heading: doublePrecision("heading"),
  accuracyM: doublePrecision("accuracy_m"),
  // Recebimento direto: chave Pix (já normalizada) e se tem maquininha de cartão.
  pixKey: text("pix_key"),
  pixKeyType: text("pix_key_type"),
  cardMachine: boolean("card_machine").notNull().default(false),
  // Regularização (Lei 13.640/2018 e prática das plataformas): datas em AAAA-MM-DD.
  birthDate: text("birth_date"),
  cnhCategory: text("cnh_category"),
  cnhFirstLicenseAt: text("cnh_first_license_at"),
  cnhExpiresAt: text("cnh_expires_at"),
  cnhEar: boolean("cnh_ear").notNull().default(false),
  // Declarou inscrição no INSS como contribuinte individual (ou MEI).
  inssDeclaredAt: timestamp("inss_declared_at", { withTimezone: true }),
  termsVersion: text("terms_version"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  idleSince: timestamp("idle_since", { withTimezone: true }),
  offersTotal: integer("offers_total").notNull().default(0),
  offersAccepted: integer("offers_accepted").notNull().default(0),
  cancelsTotal: integer("cancels_total").notNull().default(0),
  ridesTotal: integer("rides_total").notNull().default(0),
}, (t) => [
  // Conta excluída fica com CPF e CNH vazios: o índice só vale para documentos preenchidos.
  uniqueIndex("drivers_cpf_unique").on(t.cpf).where(sql`${t.cpf} <> ''`),
  uniqueIndex("drivers_cnh_unique").on(t.cnh).where(sql`${t.cnh} <> ''`),
]);

export const modalityEnrollments = pgTable("modality_enrollments", {
  driverId: uuid("driver_id").notNull().references(() => users.id),
  modalityId: text("modality_id").notNull().references(() => modalities.id),
  status: reviewEnum("status").notNull().default("pending"),
}, (t) => [primaryKey({ columns: [t.driverId, t.modalityId] })]);

export const documents = pgTable("documents", {
  id: id(),
  driverId: uuid("driver_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // cnh | crlv | selfie | residencia
  storedName: text("stored_name").notNull(),
  mime: text("mime").notNull(),
  status: reviewEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdAt: createdAt(),
});

export const vehicles = pgTable("vehicles", {
  id: id(),
  driverId: uuid("driver_id").notNull().references(() => users.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  make: text("make").notNull(),
  model: text("model").notNull(),
  color: text("color").notNull(),
  plate: text("plate").notNull().unique(),
  year: integer("year").notNull(),
  doors: integer("doors"),
  seats: integer("seats"),
  airConditioning: boolean("air_conditioning"),
  // próprio | alugado | familiar | financiado
  ownership: text("ownership"),
  status: reviewEnum("status").notNull().default("pending"),
  createdAt: createdAt(),
});

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  kind: text("kind").notNull().default("percent"), // percent | fixed
  value: integer("value").notNull(), // pontos-base (percent) ou centavos (fixed)
  maxDiscountCents: integer("max_discount_cents"),
  maxUses: integer("max_uses"),
  used: integer("used").notNull().default(0),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
});

export const rides = pgTable("rides", {
  id: id(),
  passengerId: uuid("passenger_id").notNull().references(() => users.id),
  driverId: uuid("driver_id").references(() => users.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  status: rideStatusEnum("status").notNull().default("searching"),
  originLabel: text("origin_label").notNull(),
  originLat: doublePrecision("origin_lat").notNull(),
  originLng: doublePrecision("origin_lng").notNull(),
  destLabel: text("dest_label").notNull(),
  destLat: doublePrecision("dest_lat").notNull(),
  destLng: doublePrecision("dest_lng").notNull(),
  distanceM: integer("distance_m").notNull(),
  durationS: integer("duration_s").notNull(),
  geometry: jsonb("geometry").$type<[number, number][]>().notNull(),
  // Paradas entre a partida e o destino final, na ordem do trajeto.
  stops: jsonb("stops").$type<{ label: string; lat: number; lng: number }[]>().notNull().default([]),
  // Corrida agendada: a busca por motorista começa um pouco antes deste horário.
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  searchStartedAt: timestamp("search_started_at", { withTimezone: true }),
  routeSource: text("route_source").notNull(), // osrm | estimate
  grossCents: integer("gross_cents").notNull(),
  serviceFeeCents: integer("service_fee_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  commissionBps: integer("commission_bps").notNull(),
  commissionCents: integer("commission_cents").notNull(),
  driverNetCents: integer("driver_net_cents").notNull(),
  couponId: uuid("coupon_id").references(() => coupons.id),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending | paid | failed | refunded
  // Corrida pedida para outra pessoa: quem embarca e o celular que o motorista pode chamar. Nulos quando é para a própria conta.
  riderName: text("rider_name"),
  riderPhone: text("rider_phone"),
  shareToken: text("share_token").notNull().unique(),
  cancelledBy: text("cancelled_by"),
  cancelReason: text("cancel_reason"),
  driverRating: integer("driver_rating"),
  driverRatingNote: text("driver_rating_note"),
  passengerRating: integer("passenger_rating"),
  createdAt: createdAt(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (t) => [index("rides_passenger").on(t.passengerId), index("rides_driver").on(t.driverId), index("rides_status").on(t.status)]);

/** Locais que o passageiro salvou: casa e trabalho (no máximo um de cada) e outros com nome livre. */
export const savedPlaces = pgTable("saved_places", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // home | work | other
  name: text("name").notNull(),
  label: text("label").notNull(),
  detail: text("detail"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  createdAt: createdAt(),
}, (t) => [index("saved_places_user").on(t.userId), uniqueIndex("saved_places_home_work").on(t.userId, t.kind).where(sql`${t.kind} in ('home', 'work')`)]);

export const offers = pgTable("offers", {
  id: id(),
  rideId: uuid("ride_id").notNull().references(() => rides.id),
  driverId: uuid("driver_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | expired
  score: doublePrecision("score").notNull(),
  breakdown: jsonb("breakdown").$type<Record<string, number>>().notNull(),
  pickupDistanceM: integer("pickup_distance_m").notNull(),
  pickupEtaS: integer("pickup_eta_s").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index("offers_driver").on(t.driverId, t.status), index("offers_ride").on(t.rideId)]);

export const payments = pgTable("payments", {
  id: id(),
  rideId: uuid("ride_id").notNull().references(() => rides.id),
  method: paymentMethodEnum("method").notNull(),
  provider: text("provider").notNull(), // manual | mercadopago
  status: text("status").notNull().default("pending"),
  amountCents: integer("amount_cents").notNull(),
  externalId: text("external_id"),
  pixCopyPaste: text("pix_copy_paste"),
  createdAt: createdAt(),
});

/** Razão financeira do motorista: o saldo é sempre a soma destes lançamentos. */
export const ledger = pgTable("ledger", {
  id: id(),
  driverId: uuid("driver_id").notNull().references(() => users.id),
  rideId: uuid("ride_id").references(() => rides.id),
  type: text("type").notNull(), // ride_net | cash_due | withdrawal | withdrawal_reversal | bonus | adjustment | plan
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  createdAt: createdAt(),
}, (t) => [index("ledger_driver").on(t.driverId)]);

export const withdrawals = pgTable("withdrawals", {
  id: id(),
  driverId: uuid("driver_id").notNull().references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  pixKey: text("pix_key").notNull(),
  status: text("status").notNull().default("requested"), // requested | paid | rejected
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdAt: createdAt(),
});

export const campaigns = pgTable("campaigns", {
  id: id(),
  name: text("name").notNull(),
  audience: text("audience").notNull().default("driver"), // driver | passenger
  kind: text("kind").notNull().default("promo"), // promo | bonus
  description: text("description").notNull().default(""),
  bonusPerRideCents: integer("bonus_per_ride_cents").notNull().default(0),
  regionId: uuid("region_id").references(() => regions.id),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(false),
});

export const partners = pgTable("partners", {
  id: id(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  benefit: text("benefit").notNull(),
  active: boolean("active").notNull().default(true),
});

export const partnerSavings = pgTable("partner_savings", {
  id: id(),
  driverId: uuid("driver_id").notNull().references(() => users.id),
  partnerId: uuid("partner_id").notNull().references(() => partners.id),
  originalCents: integer("original_cents").notNull(),
  paidCents: integer("paid_cents").notNull(),
  createdAt: createdAt(),
});

export const tickets = pgTable("tickets", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  rideId: uuid("ride_id").references(() => rides.id),
  kind: text("kind").notNull(), // ajuda | reclamacao | sugestao | ocorrencia | emergencia
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  priority: text("priority").notNull().default("normal"), // normal | high | critical
  status: text("status").notNull().default("open"), // open | in_progress | closed
  response: text("response"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  createdAt: createdAt(),
});

export const rideMessages = pgTable("ride_messages", {
  id: id(),
  rideId: uuid("ride_id").notNull().references(() => rides.id),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("notifications_user").on(t.userId)]);

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

export const leads = pgTable("leads", {
  id: id(),
  kind: text("kind").notNull(), // passageiro | motorista | parceiro | contato
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  city: text("city"),
  message: text("message"),
  consent: boolean("consent").notNull(),
  createdAt: createdAt(),
});

export const privacyRequests = pgTable("privacy_requests", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // export | delete
  status: text("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
