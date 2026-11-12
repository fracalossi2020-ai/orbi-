import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { ApiError, audit, body, route } from "@/server/api";
import { publish, STAFF_CHANNEL } from "@/server/bus";
import { checkRateLimit, decryptTotp, encryptTotp, readSession, revokeSessions, verifyPassword } from "@/server/auth";
import { newRecoveryCodes, newTotpSecret, otpauthUrl, verifyTotp } from "@/server/security";
import { STAFF } from "@/domain/permissions";

const ticketSchema = z.object({
  kind: z.enum(["ajuda", "reclamacao", "sugestao", "ocorrencia"]),
  subject: z.string().trim().min(3, "Informe o assunto.").max(120),
  body: z.string().trim().min(5, "Conte o que aconteceu.").max(4000),
  rideId: z.string().uuid().nullish(),
});

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Digite os 6 números do aplicativo.") });
const disableSchema = codeSchema.extend({ password: z.string().min(1, "Informe sua senha.") });
const revokeSchema = z.object({ id: z.string().uuid().optional(), others: z.boolean().optional() });

/** Nome curto do aparelho a partir do navegador, para a lista de sessões. */
function deviceName(ua: string | null) {
  if (!ua) return "Aparelho desconhecido";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Aparelho";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navegador";
  return `${br} no ${os}`;
}

export const GET = route<{ what: string }>(async ({ user, params }) => {
  const db = await getDb();
  if (params.what === "sessions") {
    const cur = await readSession();
    const rows = await db.select().from(s.sessions)
      .where(and(eq(s.sessions.userId, user.id), isNull(s.sessions.revokedAt), gt(s.sessions.expiresAt, new Date()))).orderBy(desc(s.sessions.lastSeenAt)).limit(30);
    return { sessions: rows.map((r) => ({ id: r.id, device: deviceName(r.userAgent), createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, current: r.id === cur?.session.id })) };
  }
  if (params.what === "mfa") {
    return { enabled: !!user.totpEnabledAt, required: STAFF.includes(user.role), recoveryLeft: user.recoveryCodes?.length ?? 0 };
  }
  if (params.what === "tickets") {
    return { tickets: await db.select().from(s.tickets).where(eq(s.tickets.userId, user.id)).orderBy(desc(s.tickets.createdAt)).limit(50) };
  }
  if (params.what === "notifications") {
    return { notifications: await db.select().from(s.notifications).where(eq(s.notifications.userId, user.id)).orderBy(desc(s.notifications.createdAt)).limit(40) };
  }
  throw new ApiError(404, "Recurso não encontrado.");
});

export const POST = route<{ what: string }>(async ({ req, user, params }) => {
  const db = await getDb();
  if (params.what === "tickets") {
    if (!checkRateLimit(`ticket:${user.id}`, 10, 60 * 60_000)) throw new ApiError(429, "Muitos chamados em pouco tempo. Aguarde um pouco.");
    const v = await body(req, ticketSchema);
    // Atendimento prioritário é um dos compromissos com motoristas.
    const priority = v.kind === "ocorrencia" || user.role === "driver" ? "high" : "normal";
    const [row] = await db.insert(s.tickets).values({ ...v, rideId: v.rideId ?? null, userId: user.id, priority }).returning();
    await audit(user.id, "ticket.create", "ticket", row.id, { kind: v.kind });
    publish(STAFF_CHANNEL, "ticket");
    return row;
  }
  if (params.what === "notifications") {
    await db.update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)));
    return { ok: true };
  }

  // Encerrar uma sessão (um aparelho) ou todas as outras.
  if (params.what === "sessions") {
    const v = await body(req, revokeSchema);
    const cur = await readSession();
    if (v.others) await revokeSessions(user.id, cur?.session.id);
    else if (v.id) await db.update(s.sessions).set({ revokedAt: new Date() }).where(and(eq(s.sessions.id, v.id), eq(s.sessions.userId, user.id)));
    else throw new ApiError(400, "Diga qual sessão encerrar.");
    await audit(user.id, "session.revoke", "user", user.id, { others: !!v.others });
    return { ok: true };
  }

  // Verificação em duas etapas: 1) gera o segredo e mostra o QR Code; 2) confirma com um código; só então vale.
  if (params.what === "mfa-start") {
    if (user.totpEnabledAt) throw new ApiError(409, "A verificação em duas etapas já está ativa.");
    if (!checkRateLimit(`mfa-start:${user.id}`, 10, 60 * 60_000)) throw new ApiError(429, "Muitas tentativas. Aguarde uma hora.");
    const secret = newTotpSecret();
    await db.update(s.users).set({ totpSecret: encryptTotp(secret), totpLastStep: null }).where(eq(s.users.id, user.id));
    return { secret, otpauth: otpauthUrl(secret, user.email ?? user.phone ?? user.name) };
  }
  if (params.what === "mfa-enable") {
    if (user.totpEnabledAt) throw new ApiError(409, "A verificação em duas etapas já está ativa.");
    if (!user.totpSecret) throw new ApiError(400, "Comece pela leitura do QR Code.");
    if (!checkRateLimit(`mfa-enable:${user.id}`, 10)) throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos.");
    const v = await body(req, codeSchema);
    const step = verifyTotp(decryptTotp(user.totpSecret), v.code, null);
    if (step === null) throw new ApiError(400, "Código incorreto. Confira se o relógio do celular está certo e tente de novo.");
    const { codes, hashes } = newRecoveryCodes();
    await db.update(s.users).set({ totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: hashes }).where(eq(s.users.id, user.id));
    const cur = await readSession();
    if (cur) await db.update(s.sessions).set({ mfaAt: new Date() }).where(eq(s.sessions.id, cur.session.id));
    // Quem tinha a senha em outro aparelho precisa passar pela segunda etapa a partir de agora.
    await revokeSessions(user.id, cur?.session.id);
    await audit(user.id, "mfa.enable", "user", user.id);
    return { recoveryCodes: codes };
  }
  if (params.what === "mfa-recovery") {
    if (!user.totpEnabledAt || !user.totpSecret) throw new ApiError(400, "Ative a verificação em duas etapas primeiro.");
    if (!checkRateLimit(`mfa-recovery:${user.id}`, 5)) throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos.");
    const v = await body(req, codeSchema);
    const step = verifyTotp(decryptTotp(user.totpSecret), v.code, user.totpLastStep);
    if (step === null) throw new ApiError(400, "Código incorreto.");
    const { codes, hashes } = newRecoveryCodes();
    await db.update(s.users).set({ recoveryCodes: hashes, totpLastStep: step }).where(eq(s.users.id, user.id));
    await audit(user.id, "mfa.recovery_new", "user", user.id);
    return { recoveryCodes: codes };
  }
  if (params.what === "mfa-disable") {
    // Equipe não desliga: o painel exige as duas etapas.
    if (STAFF.includes(user.role)) throw new ApiError(403, "Contas da equipe precisam da verificação em duas etapas.");
    if (!user.totpEnabledAt || !user.totpSecret) throw new ApiError(400, "A verificação em duas etapas não está ativa.");
    if (!checkRateLimit(`mfa-disable:${user.id}`, 5)) throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos.");
    const v = await body(req, disableSchema);
    if (!(await verifyPassword(v.password, user.passwordHash))) throw new ApiError(400, "Senha incorreta.");
    if (verifyTotp(decryptTotp(user.totpSecret), v.code, user.totpLastStep) === null) throw new ApiError(400, "Código incorreto.");
    await db.update(s.users).set({ totpEnabledAt: null, totpSecret: null, totpLastStep: null, recoveryCodes: null }).where(eq(s.users.id, user.id));
    await audit(user.id, "mfa.disable", "user", user.id);
    return { ok: true };
  }
  throw new ApiError(404, "Ação desconhecida.");
});
