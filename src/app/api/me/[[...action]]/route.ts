import { desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getDb, schema as s } from "@/db";
import { ApiError, audit, body, publicRoute, route } from "@/server/api";
import { endSession, publicUser, revokeSessions } from "@/server/auth";
import { ACTIVE_STATUSES } from "@/domain/transitions";

export const GET = publicRoute<{ action?: string[] }>(async ({ user, params }) => {
  if (!params.action) return { user: user ? publicUser(user) : null };
  if (!user) throw new ApiError(401, "Entre na sua conta para continuar.");
  if (params.action[0] !== "export") throw new ApiError(404, "Recurso não encontrado.");

  // LGPD, art. 18: portabilidade dos dados do titular.
  const db = await getDb();
  const [rides, tickets, notifications, driver, vehicles, ledger, savedPlaces] = await Promise.all([
    db.select().from(s.rides).where(or(eq(s.rides.passengerId, user.id), eq(s.rides.driverId, user.id))).orderBy(desc(s.rides.createdAt)),
    db.select().from(s.tickets).where(eq(s.tickets.userId, user.id)),
    db.select().from(s.notifications).where(eq(s.notifications.userId, user.id)),
    db.select().from(s.drivers).where(eq(s.drivers.userId, user.id)),
    db.select().from(s.vehicles).where(eq(s.vehicles.driverId, user.id)),
    db.select().from(s.ledger).where(eq(s.ledger.driverId, user.id)),
    db.select().from(s.savedPlaces).where(eq(s.savedPlaces.userId, user.id)),
  ]);
  await audit(user.id, "privacy.export", "user", user.id);
  // Fora da cópia: resumo da senha e segredos da verificação em duas etapas.
  const { passwordHash: _p, totpSecret: _t, recoveryCodes: _r, totpLastStep: _l, ...profile } = user;
  return new NextResponse(JSON.stringify({ exportedAt: new Date(), profile, driver, vehicles, rides, ledger, tickets, notifications, savedPlaces }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="meus-dados-orbi.json"' },
  });
});

const profileSchema = z.object({ name: z.string().trim().min(3, "Informe seu nome completo.") });

export const PATCH = route(async ({ req, user }) => {
  const v = await body(req, profileSchema);
  const db = await getDb();
  const [u] = await db.update(s.users).set({ name: v.name }).where(eq(s.users.id, user.id)).returning();
  return publicUser(u);
});

/**
 * LGPD: anonimiza a conta. Corridas e lançamentos financeiros ficam, sem dados pessoais,
 * porque a retenção fiscal e contábil é obrigação legal.
 */
export const DELETE = route(async ({ user }) => {
  const db = await getDb();
  const open = await db.select({ status: s.rides.status }).from(s.rides).where(or(eq(s.rides.passengerId, user.id), eq(s.rides.driverId, user.id)));
  if (open.some((r) => ACTIVE_STATUSES.includes(r.status))) throw new ApiError(409, "Encerre a corrida em andamento antes de excluir a conta.");
  await db.insert(s.privacyRequests).values({ userId: user.id, kind: "delete", status: "done" });
  await db.update(s.users).set({
    name: "Conta excluída", email: null, emailVerifiedAt: null, phone: null, status: "deleted", passwordHash: randomBytes(32).toString("hex"),
  }).where(eq(s.users.id, user.id));
  // Endereços salvos e dados de quem viajou no lugar da conta também são pessoais.
  await db.delete(s.savedPlaces).where(eq(s.savedPlaces.userId, user.id));
  await db.update(s.rides).set({ riderName: null, riderPhone: null }).where(eq(s.rides.passengerId, user.id));
  await db.update(s.drivers).set({ online: false, lat: null, lng: null, cpf: "", cnh: "", addressCep: null, addressStreet: null, addressNumber: null, addressComplement: null, addressDistrict: null, addressCity: null, addressState: null, addressVerified: false }).where(eq(s.drivers.userId, user.id));
  await db.update(s.users).set({ totpSecret: null, totpEnabledAt: null, recoveryCodes: null, googleSub: null }).where(eq(s.users.id, user.id));
  await audit(user.id, "privacy.delete", "user", user.id);
  await revokeSessions(user.id);
  await endSession();
  return { ok: true };
});
