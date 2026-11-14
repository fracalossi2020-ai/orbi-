import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SCHEDULE } from "@/domain/schedule";
import { DEFAULT_PAYMENT_RULES } from "@/domain/payment-methods";
import { withDefaultRules, DEFAULT_DRIVER_RULES, DOC_INFO, DOC_KINDS, type DriverRules } from "@/domain/driver-rules";
import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dataDir, getDb, schema as s } from "@/db";
import { getSetting } from "@/db/seed";
import { ApiError, assertCan, audit, body, route } from "@/server/api";
import { hashPassword, revokeSessions } from "@/server/auth";
import { fileHeaders, passwordProblem } from "@/server/security";
import { emailDomainExists } from "@/server/verify";
import { notify, rideView } from "@/server/rides";
import { publish, userChannel } from "@/server/bus";
import { STAFF } from "@/domain/permissions";
import { DEFAULT_WEIGHTS } from "@/domain/dispatch";
import { brl } from "@/domain/pricing";

type P = { path: string[] };
const roles = { roles: STAFF };
const count = sql<number>`count(*)::int`;

export const GET = route<P>(async ({ req, user, params }) => {
  const db = await getDb();
  const [what, arg, sub] = params.path;
  const url = new URL(req.url);

  switch (what) {
    case "dashboard": {
      assertCan(user, "dashboard", "read");
      const [drivers, online, passengers, rides, cancelled, pendingDrivers, openTickets, money, unreviewed, pendingWithdrawals] = await Promise.all([
        db.select({ n: count }).from(s.drivers),
        db.select({ n: count }).from(s.drivers).where(eq(s.drivers.online, true)),
        db.select({ n: count }).from(s.users).where(and(eq(s.users.role, "passenger"), eq(s.users.status, "active"))),
        db.select({ n: count }).from(s.rides).where(eq(s.rides.status, "completed")),
        db.select({ n: count }).from(s.rides).where(eq(s.rides.status, "cancelled")),
        db.select({ n: count }).from(s.drivers).where(eq(s.drivers.status, "pending")),
        db.select({ n: count }).from(s.tickets).where(ne(s.tickets.status, "closed")),
        db.select({
          gross: sql<number>`coalesce(sum(${s.rides.grossCents}),0)::int`, commission: sql<number>`coalesce(sum(${s.rides.commissionCents}),0)::int`,
          fees: sql<number>`coalesce(sum(${s.rides.serviceFeeCents}),0)::int`, discounts: sql<number>`coalesce(sum(${s.rides.discountCents}),0)::int`,
        }).from(s.rides).where(eq(s.rides.status, "completed")),
        db.select({ n: count }).from(s.tariffs).where(isNull(s.tariffs.reviewedAt)),
        db.select({ n: count }).from(s.withdrawals).where(eq(s.withdrawals.status, "requested")),
      ]);
      const daily = await db.select({
        day: sql<string>`to_char(${s.rides.endedAt}, 'YYYY-MM-DD')`, rides: count, gross: sql<number>`coalesce(sum(${s.rides.grossCents}),0)::int`,
      }).from(s.rides).where(and(eq(s.rides.status, "completed"), gte(s.rides.endedAt, sql`now() - interval '14 days'`))).groupBy(sql`1`).orderBy(sql`1`);
      return {
        drivers: drivers[0].n, driversOnline: online[0].n, passengers: passengers[0].n, ridesCompleted: rides[0].n, ridesCancelled: cancelled[0].n,
        pendingDrivers: pendingDrivers[0].n, openTickets: openTickets[0].n, pendingWithdrawals: pendingWithdrawals[0].n,
        grossCents: money[0].gross, commissionCents: money[0].commission, feesCents: money[0].fees, discountsCents: money[0].discounts,
        tariffsUnreviewed: unreviewed[0].n, daily,
      };
    }
    case "users": {
      assertCan(user, "users", "read");
      const rows = await db.select().from(s.users).orderBy(desc(s.users.createdAt)).limit(300);
      return { rows: rows.map(({ passwordHash: _omit, ...u }) => u) };
    }
    case "drivers": {
      assertCan(user, "drivers", "read");
      const rows = await db.select({ d: s.drivers, u: s.users }).from(s.drivers).innerJoin(s.users, eq(s.drivers.userId, s.users.id)).orderBy(desc(s.users.createdAt)).limit(300);
      const ids = rows.map((r) => r.d.userId);
      const [docs, vehicles] = ids.length ? await Promise.all([
        db.select().from(s.documents).where(inArray(s.documents.driverId, ids)).orderBy(desc(s.documents.createdAt)),
        db.select().from(s.vehicles).where(inArray(s.vehicles.driverId, ids)),
      ]) : [[], []];
      return { rows: rows.map(({ d, u }) => ({
        id: d.userId, name: u.name, email: u.email, phone: u.phone, status: d.status, online: d.online, cpf: d.cpf, cnh: d.cnh, ridesTotal: d.ridesTotal,
        address: d.addressCep ? `${d.addressStreet}, ${d.addressNumber}${d.addressComplement ? ` (${d.addressComplement})` : ""} · ${d.addressDistrict} · ${d.addressCity}/${d.addressState} · CEP ${d.addressCep}` : null, addressVerified: d.addressVerified,
        rating: u.ratingCount ? u.ratingSum / u.ratingCount : null, reviewNote: d.reviewNote,
        birthDate: d.birthDate, cnhCategory: d.cnhCategory, cnhFirstLicenseAt: d.cnhFirstLicenseAt, cnhExpiresAt: d.cnhExpiresAt, cnhEar: d.cnhEar,
        inss: !!d.inssDeclaredAt, termsVersion: d.termsVersion, termsAcceptedAt: d.termsAcceptedAt,
        docs: docs.filter((x) => x.driverId === d.userId).map((x) => ({ id: x.id, kind: x.kind, status: x.status })),
        vehicles: vehicles.filter((x) => x.driverId === d.userId),
      })) };
    }
    case "vehicles": {
      assertCan(user, "vehicles", "read");
      const rows = await db.select({ v: s.vehicles, driver: s.users.name, category: s.categories.name }).from(s.vehicles)
        .innerJoin(s.users, eq(s.vehicles.driverId, s.users.id)).innerJoin(s.categories, eq(s.vehicles.categoryId, s.categories.id)).orderBy(desc(s.vehicles.createdAt)).limit(300);
      return { rows: rows.map((r) => ({ ...r.v, driverName: r.driver, categoryName: r.category })) };
    }
    case "documents": {
      assertCan(user, "documents", "read");
      if (arg && sub === "file") {
        const [doc] = await db.select().from(s.documents).where(eq(s.documents.id, arg));
        if (!doc) throw new ApiError(404, "Documento não encontrado.");
        await audit(user.id, "document.view", "document", doc.id);
        const file = await fs.readFile(path.join(dataDir(), "uploads", doc.storedName));
        // Documento de usuário: entregue isolado (sem rodar nada no site), nunca guardado em cache.
        return new NextResponse(file, { headers: fileHeaders(doc.mime, { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="documento-${doc.kind}"` }) });
      }
      throw new ApiError(404, "Recurso não encontrado.");
    }
    case "rides": {
      assertCan(user, "rides", "read");
      const rows = await db.select().from(s.rides).orderBy(desc(s.rides.createdAt)).limit(200);
      return { rows: await Promise.all(rows.map(async (r) => ({ ...(await rideView(r, "staff")), commissionCents: r.commissionCents, cancelReason: r.cancelReason }))) };
    }
    case "payments": {
      assertCan(user, "payments", "read");
      const [payments, withdrawals] = await Promise.all([
        db.select().from(s.payments).orderBy(desc(s.payments.createdAt)).limit(200),
        db.select({ w: s.withdrawals, name: s.users.name }).from(s.withdrawals).innerJoin(s.users, eq(s.withdrawals.driverId, s.users.id)).orderBy(desc(s.withdrawals.createdAt)).limit(200),
      ]);
      return { payments, withdrawals: withdrawals.map((r) => ({ ...r.w, driverName: r.name })) };
    }
    case "tickets": {
      assertCan(user, "tickets", "read");
      const rows = await db.select({ t: s.tickets, name: s.users.name }).from(s.tickets).innerJoin(s.users, eq(s.tickets.userId, s.users.id)).orderBy(desc(s.tickets.createdAt)).limit(200);
      return { rows: rows.map((r) => ({ ...r.t, userName: r.name })) };
    }
    case "reports": {
      assertCan(user, "reports", "read");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const fromD = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
      const toD = to ? new Date(`${to}T23:59:59`) : new Date();
      const rows = await db.select({
        day: sql<string>`to_char(${s.rides.endedAt}, 'YYYY-MM-DD')`, rides: count,
        gross: sql<number>`sum(${s.rides.grossCents})::int`, commission: sql<number>`sum(${s.rides.commissionCents})::int`,
        fees: sql<number>`sum(${s.rides.serviceFeeCents})::int`, discounts: sql<number>`sum(${s.rides.discountCents})::int`, net: sql<number>`sum(${s.rides.driverNetCents})::int`,
      }).from(s.rides).where(and(eq(s.rides.status, "completed"), gte(s.rides.endedAt, fromD), sql`${s.rides.endedAt} <= ${toD}`)).groupBy(sql`1`).orderBy(sql`1`);
      if (url.searchParams.get("format") === "csv") {
        const csv = ["dia;corridas;bruto;comissao;taxas;descontos;liquido_motoristas", ...rows.map((r) => [r.day, r.rides, r.gross, r.commission, r.fees, r.discounts, r.net].map((v, i) => (i < 2 ? v : (Number(v) / 100).toFixed(2).replace(".", ","))).join(";"))].join("\n");
        await audit(user.id, "report.export", "report");
        return new NextResponse(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="relatorio-orbi.csv"' } });
      }
      return { rows };
    }
    case "settings": {
      assertCan(user, "settings", "read");
      return {
        dispatchWeights: await getSetting(db, "dispatchWeights", DEFAULT_WEIGHTS),
        dispatch: await getSetting(db, "dispatch", { offerTimeoutS: 20, searchTimeoutS: 180 }),
        withdrawal: await getSetting(db, "withdrawal", { minCents: 2000 }),
        schedule: await getSetting(db, "schedule", DEFAULT_SCHEDULE),
        support: await getSetting(db, "support", { whatsapp: "" }),
        payments: await getSetting(db, "payments", DEFAULT_PAYMENT_RULES),
        driverRules: await getSetting<Partial<DriverRules>>(db, "driverRules", DEFAULT_DRIVER_RULES).then(withDefaultRules),
      };
    }
    case "me": return { role: user.role };
    default: throw new ApiError(404, "Recurso não encontrado.");
  }
}, roles);

const reviewSchema = z.object({ status: z.enum(["approved", "rejected", "pending", "suspended"]), note: z.string().trim().max(500).optional() });
const docReviewSchema = z.object({ status: z.enum(["approved", "rejected"]), note: z.string().trim().max(500).optional() });
const vehicleReviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });
const userStatusSchema = z.object({ status: z.enum(["active", "suspended"]) });
const ticketSchema = z.object({ status: z.enum(["open", "in_progress", "closed"]).optional(), response: z.string().trim().max(4000).optional() });
const withdrawalSchema = z.object({ status: z.enum(["paid", "rejected"]) });
const staffSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome."), email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(10, "A senha precisa de pelo menos 10 caracteres."), role: z.enum(["admin", "gestor", "atendente"]),
});
const positive = z.number().min(0).max(1000);
const settingsSchema = z.object({
  dispatchWeights: z.object({ eta: positive, idle: positive, netPerKm: positive, earningsBalance: positive, acceptance: positive, cancellation: positive, rating: positive }).optional(),
  dispatch: z.object({ offerTimeoutS: z.number().int().min(5).max(120), searchTimeoutS: z.number().int().min(30).max(900) }).optional(),
  withdrawal: z.object({ minCents: z.number().int().min(0) }).optional(),
  schedule: z.object({ minLeadMin: z.number().int().min(0).max(1440), maxDays: z.number().int().min(1).max(60), searchLeadMin: z.number().int().min(0).max(120), maxPerPassenger: z.number().int().min(1).max(20) }).optional(),
  // Formas de pagamento direto ao motorista que o passageiro pode escolher.
  payments: z.object({ cash: z.boolean(), pix_driver: z.boolean(), card_machine: z.boolean() }).refine((v) => v.cash || v.pix_driver || v.card_machine, "Deixe pelo menos uma forma de pagamento ligada.").optional(),
  // Requisitos do motorista (idade, habilitação, carro e documentos obrigatórios).
  driverRules: z.object({
    minAge: z.number().int().min(18, "A idade mínima legal para dirigir é 18 anos.").max(70),
    minLicenseYears: z.number().int().min(0).max(20),
    maxVehicleAge: z.number().int().min(1).max(40),
    minDoors: z.number().int().min(2).max(5),
    minSeats: z.number().int().min(2).max(9),
    requireAirConditioning: z.boolean(),
    requiredDocs: z.array(z.enum(DOC_KINDS)).refine((d) => d.includes("cnh") && d.includes("crlv"), "CNH e CRLV são sempre obrigatórios (Lei 13.640/2018)."),
    motoMinLicenseYears: z.number().int().min(2, "A lei do mototaxista pede pelo menos 2 anos na categoria A.").max(20).default(2),
    maxMotoAge: z.number().int().min(1).max(30).default(10),
  }).optional(),
  // WhatsApp do atendimento, mostrado na central de ajuda do site. Vazio: o botão não aparece.
  support: z.object({ whatsapp: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^(|55[1-9]{2}9?\d{8})$/, "WhatsApp com 55, DDD e número, por exemplo 5531999999999.")) }).optional(),
});

export const POST = route<P>(async ({ req, user, params }) => {
  const db = await getDb();
  const [what, id] = params.path;
  switch (what) {
    case "drivers": {
      assertCan(user, "drivers", "write");
      const v = await body(req, reviewSchema);
      if (v.status === "approved") {
        const docs = await db.select().from(s.documents).where(eq(s.documents.driverId, id)).orderBy(desc(s.documents.createdAt));
        const rules = await getSetting<Partial<DriverRules>>(db, "driverRules", DEFAULT_DRIVER_RULES).then(withDefaultRules);
        // Quem cadastrou moto precisa também do certificado do curso de mototaxista (Resolução Contran 410/2012).
        const motoVehicles = await db.select({ id: s.vehicles.id }).from(s.vehicles).innerJoin(s.categories, eq(s.vehicles.categoryId, s.categories.id))
          .where(and(eq(s.vehicles.driverId, id), eq(s.categories.modalityId, "corrida-moto")));
        const needed = motoVehicles.length && !rules.requiredDocs.includes("curso_mototaxi") ? [...rules.requiredDocs, "curso_mototaxi" as const] : rules.requiredDocs;
        const missing = needed.filter((kind) => docs.find((d) => d.kind === kind)?.status !== "approved");
        if (missing.length) throw new ApiError(409, `Aprove primeiro: ${missing.map((k) => DOC_INFO[k].label).join(", ")}.`);
        const [drv] = await db.select().from(s.drivers).where(eq(s.drivers.userId, id));
        if (drv && !drv.termsAcceptedAt) throw new ApiError(409, "O motorista ainda não aceitou o termo de adesão.");
      }
      const [row] = await db.update(s.drivers).set({ status: v.status, reviewNote: v.note ?? null, ...(v.status !== "approved" ? { online: false } : {}) }).where(eq(s.drivers.userId, id)).returning();
      if (!row) throw new ApiError(404, "Motorista não encontrado.");
      if (v.status === "approved") await db.update(s.modalityEnrollments).set({ status: "approved" }).where(eq(s.modalityEnrollments.driverId, id));
      await audit(user.id, `driver.${v.status}`, "driver", id, { note: v.note });
      const message = { approved: ["Cadastro aprovado", "Você já pode ficar online."], rejected: ["Cadastro não aprovado", v.note || "Veja os detalhes no aplicativo."], suspended: ["Cadastro suspenso", v.note || "Fale com o atendimento."], pending: ["Cadastro em análise", "Vamos revisar seus dados."] }[v.status];
      await notify(db, id, message[0], message[1], "/motorista");
      publish(userChannel(id), "driver");
      return { ok: true };
    }
    case "documents": {
      assertCan(user, "documents", "write");
      const v = await body(req, docReviewSchema);
      const [row] = await db.update(s.documents).set({ status: v.status, reviewNote: v.note ?? null, reviewedBy: user.id }).where(eq(s.documents.id, id)).returning();
      if (!row) throw new ApiError(404, "Documento não encontrado.");
      await audit(user.id, `document.${v.status}`, "document", id);
      if (v.status === "rejected") await notify(db, row.driverId, "Documento recusado", v.note || "Envie o documento de novo.", "/motorista");
      publish(userChannel(row.driverId), "driver");
      return { ok: true };
    }
    case "vehicles": {
      assertCan(user, "vehicles", "write");
      const v = await body(req, vehicleReviewSchema);
      const [row] = await db.update(s.vehicles).set({ status: v.status }).where(eq(s.vehicles.id, id)).returning();
      if (!row) throw new ApiError(404, "Veículo não encontrado.");
      await audit(user.id, `vehicle.${v.status}`, "vehicle", id);
      publish(userChannel(row.driverId), "driver");
      return { ok: true };
    }
    case "users": {
      assertCan(user, "users", "write");
      const v = await body(req, userStatusSchema);
      if (id === user.id) throw new ApiError(409, "Você não pode suspender a própria conta.");
      const [target] = await db.select({ role: s.users.role }).from(s.users).where(eq(s.users.id, id));
      if (!target) throw new ApiError(404, "Conta não encontrada.");
      // Só administrador mexe em conta da equipe: um gestor não suspende quem está acima dele.
      if (STAFF.includes(target.role) && user.role !== "admin") throw new ApiError(403, "Só um administrador altera contas da equipe.");
      await db.update(s.users).set({ status: v.status }).where(eq(s.users.id, id));
      if (v.status === "suspended") {
        await db.update(s.drivers).set({ online: false }).where(eq(s.drivers.userId, id));
        await revokeSessions(id);
      }
      await audit(user.id, `user.${v.status}`, "user", id);
      return { ok: true };
    }
    case "staff": {
      assertCan(user, "staff", "write");
      const v = await body(req, staffSchema);
      if (!(await emailDomainExists(v.email))) throw new ApiError(400, "Este e-mail não pode receber mensagens. Confira o que digitou.");
      const weak = passwordProblem(v.password, [v.name.split(" ")[0], v.email]);
      if (weak) throw new ApiError(400, weak);
      const [dup] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, v.email));
      if (dup) throw new ApiError(409, "Já existe uma conta com este e-mail.");
      const [row] = await db.insert(s.users).values({ name: v.name, email: v.email, role: v.role, passwordHash: await hashPassword(v.password), privacyAcceptedAt: new Date() }).returning();
      await audit(user.id, "staff.create", "user", row.id, { role: v.role });
      return { id: row.id };
    }
    case "tickets": {
      assertCan(user, "tickets", "write");
      const v = await body(req, ticketSchema);
      const [row] = await db.update(s.tickets).set({ ...v, assignedTo: user.id }).where(eq(s.tickets.id, id)).returning();
      if (!row) throw new ApiError(404, "Chamado não encontrado.");
      await audit(user.id, "ticket.update", "ticket", id, { status: v.status });
      if (v.response) await notify(db, row.userId, "Resposta do atendimento", row.subject);
      return row;
    }
    case "withdrawals": {
      assertCan(user, "payments", "write");
      const v = await body(req, withdrawalSchema);
      const [row] = await db.update(s.withdrawals).set({ status: v.status, reviewedBy: user.id }).where(and(eq(s.withdrawals.id, id), eq(s.withdrawals.status, "requested"))).returning();
      if (!row) throw new ApiError(409, "Este saque já foi tratado.");
      if (v.status === "rejected") {
        await db.insert(s.ledger).values({ driverId: row.driverId, type: "withdrawal_reversal", amountCents: row.amountCents, description: "Saque recusado: valor devolvido ao saldo" });
      }
      await audit(user.id, `withdrawal.${v.status}`, "withdrawal", id, { amountCents: row.amountCents });
      await notify(db, row.driverId, v.status === "paid" ? "Saque pago" : "Saque recusado", `Valor: ${brl(row.amountCents)}`, "/motorista/ganhos");
      return { ok: true };
    }
    case "settings": {
      assertCan(user, "settings", "write");
      const v = await body(req, settingsSchema);
      for (const [key, value] of Object.entries(v)) {
        if (value) await db.insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
      }
      await audit(user.id, "settings.update", "settings", null, { keys: Object.keys(v) });
      return { ok: true };
    }
    default: throw new ApiError(404, "Ação desconhecida.");
  }
}, roles);
