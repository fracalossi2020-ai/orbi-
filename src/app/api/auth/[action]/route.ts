import { and, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { ApiError, audit, body, publicRoute } from "@/server/api";
import { checkRateLimit, decryptTotp, endSession, hashPassword, mfaPending, publicUser, readSession, revokeSessions, startSession, verifyPassword } from "@/server/auth";
import { clientIp, hashRecovery, passwordProblem, resetLimit, verifyTotp } from "@/server/security";
import { sendCode, useCode } from "@/server/codes";
import { maskEmail } from "@/server/mail";
import { emailDomainExists } from "@/server/verify";
import { isFullName, isValidEmailFormat, isValidMobile } from "@/domain/validation";

const digits = (v: string) => v.replace(/\D/g, "");
const MOBILE_ERROR = "Celular inválido: use DDD e número com 9 na frente.";
const EMAIL_DOMAIN_ERROR = "Este e-mail não pode receber mensagens. Confira o que vem depois do @.";
const password = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128, "A senha pode ter até 128 caracteres.");
const mfaSchema = z.object({ code: z.string().trim().min(6).max(20) });
const changeSchema = z.object({ current: z.string().min(1, "Informe a senha atual."), password });
const registerSchema = z.object({
  name: z.string().trim().refine(isFullName, "Informe nome e sobrenome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").optional().or(z.literal("")),
  phone: z.string().transform(digits).refine((v) => v.length === 0 || isValidMobile(v), MOBILE_ERROR).optional(),
  password,
  role: z.enum(["passenger", "driver"]),
  acceptPrivacy: z.literal(true, { error: "Aceite os termos e a política de privacidade para continuar." }),
}).refine((v) => v.email || v.phone, { message: "Informe e-mail ou telefone." });

const identifierSchema = z.string().trim().min(3, "Informe e-mail ou telefone.");
const lookupSchema = z.object({ identifier: identifierSchema });
const loginSchema = z.object({ identifier: identifierSchema, password: z.string().min(1, "Informe a senha.") });
const resetConfirmSchema = z.object({ identifier: identifierSchema, code: z.string().trim(), password });
const emailSendSchema = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido.").optional() });
const codeSchema = z.object({ code: z.string().trim() });

/** E-mail só compara com e-mail: um endereço como 31999998888@x.com não pode achar a conta desse telefone. */
const identifierMatch = (key: string) => (key.includes("@") ? eq(s.users.email, key) : eq(s.users.phone, digits(key) || "-"));

export const POST = publicRoute<{ action: string }>(async ({ req, user: session, params }) => {
  const db = await getDb();
  const ip = clientIp(req);
  const findActive = async (identifier: string) => {
    const [u] = await db.select().from(s.users).where(identifierMatch(identifier.toLowerCase()));
    return u && u.status === "active" ? u : null;
  };

  if (params.action === "register") {
    if (!checkRateLimit(`register:${ip}`, 20)) throw new ApiError(429, "Muitas tentativas. Aguarde alguns minutos.");
    const v = await body(req, registerSchema);
    const email = v.email || null;
    if (email && !(await emailDomainExists(email))) throw new ApiError(400, EMAIL_DOMAIN_ERROR);
    const phone = v.phone || null;
    const weak = passwordProblem(v.password, [v.name.split(" ")[0], email, phone]);
    if (weak) throw new ApiError(400, weak);
    const clash = await db.select({ id: s.users.id }).from(s.users).where(or(email ? eq(s.users.email, email) : undefined, phone ? eq(s.users.phone, phone) : undefined));
    if (clash.length) throw new ApiError(409, "Já existe uma conta com este e-mail ou telefone.");
    const [user] = await db.insert(s.users).values({
      name: v.name, email, phone, role: v.role, passwordHash: await hashPassword(v.password), privacyAcceptedAt: new Date(),
    }).returning();
    await audit(user.id, "register", "user", user.id, { role: v.role });
    await startSession(user.id);
    // A conta já funciona; o código de confirmação chega por e-mail. Falha no envio não impede o cadastro.
    if (email) await sendCode(user, email, "email_verify").catch(() => undefined);
    return publicUser(user);
  }

  // Informa se a conta existe, como o cadastro já faz ao recusar duplicados: o limite por endereço restringe varreduras.
  if (params.action === "lookup") {
    if (!checkRateLimit(`lookup:${ip}`, 30)) throw new ApiError(429, "Muitas tentativas. Aguarde alguns minutos.");
    const v = await body(req, lookupSchema);
    const [user] = await db.select({ id: s.users.id }).from(s.users).where(identifierMatch(v.identifier.toLowerCase()));
    if (user) return { exists: true };
    // Conta nova: avisa do erro de digitação logo aqui, antes das outras perguntas.
    const key = v.identifier.toLowerCase();
    if (key.includes("@")) {
      if (!isValidEmailFormat(key)) throw new ApiError(400, "E-mail inválido.");
      if (!(await emailDomainExists(key))) throw new ApiError(400, EMAIL_DOMAIN_ERROR);
    } else if (!isValidMobile(key)) throw new ApiError(400, MOBILE_ERROR);
    return { exists: false };
  }

  if (params.action === "login") {
    const v = await body(req, loginSchema);
    const key = v.identifier.toLowerCase();
    // Dois limites: por conta (quem troca de IP não ganha tentativas a mais) e por IP (quem testa muitas contas).
    if (!checkRateLimit(`login:acct:${key}`, 8) || !checkRateLimit(`login:ip:${ip}`, 40)) {
      throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos ou use \"Esqueci a senha\".");
    }
    const [user] = await db.select().from(s.users).where(identifierMatch(key));
    // A senha é conferida mesmo sem conta (contra uma senha falsa): o tempo de resposta não revela se a conta existe.
    const ok = await verifyPassword(v.password, user?.passwordHash);
    if (!user || user.status !== "active" || !ok) {
      await audit(user?.id ?? null, "login.failed", "user", user?.id ?? null, { reason: !user ? "sem conta" : user.status !== "active" ? "conta inativa" : "senha" });
      throw new ApiError(401, "E-mail, telefone ou senha incorretos.");
    }
    resetLimit(`login:acct:${key}`);
    await audit(user.id, "login", "user", user.id);
    await startSession(user.id);
    // Com a verificação em duas etapas, a sessão só vale depois do código do aplicativo autenticador.
    if (user.totpEnabledAt) return { mfaRequired: true };
    return publicUser(user);
  }

  // Segunda etapa: código do aplicativo autenticador (ou um código de recuperação).
  if (params.action === "mfa") {
    const r = await readSession();
    if (!r || !mfaPending(r)) throw new ApiError(400, "Não há verificação pendente. Entre de novo.");
    if (!checkRateLimit(`mfa:${r.user.id}`, 6)) throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos.");
    const v = await body(req, mfaSchema);
    const code = v.code.replace(/\s/g, "");
    let accepted = false;
    if (/^\d{6}$/.test(code) && r.user.totpSecret) {
      const step = verifyTotp(decryptTotp(r.user.totpSecret), code, r.user.totpLastStep);
      if (step !== null) { accepted = true; await db.update(s.users).set({ totpLastStep: step }).where(eq(s.users.id, r.user.id)); }
    } else {
      // Código de recuperação: vale uma única vez.
      const h = hashRecovery(code);
      const left = r.user.recoveryCodes ?? [];
      if (left.includes(h)) {
        accepted = true;
        await db.update(s.users).set({ recoveryCodes: left.filter((x) => x !== h) }).where(eq(s.users.id, r.user.id));
        await audit(r.user.id, "mfa.recovery_used", "user", r.user.id, { left: left.length - 1 });
      }
    }
    if (!accepted) {
      await audit(r.user.id, "mfa.failed", "user", r.user.id);
      throw new ApiError(400, "Código incorreto. Confira o aplicativo autenticador e tente de novo.");
    }
    resetLimit(`mfa:${r.user.id}`);
    await db.update(s.sessions).set({ mfaAt: new Date() }).where(eq(s.sessions.id, r.session.id));
    await audit(r.user.id, "mfa.ok", "user", r.user.id);
    return publicUser(r.user);
  }

  // Troca de senha com a sessão aberta: pede a senha atual e encerra os outros aparelhos.
  if (params.action === "password-change") {
    const r = await readSession();
    if (!r || mfaPending(r)) throw new ApiError(401, "Entre na sua conta para continuar.");
    if (!checkRateLimit(`pwchange:${r.user.id}`, 5)) throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos.");
    const v = await body(req, changeSchema);
    if (!(await verifyPassword(v.current, r.user.passwordHash))) throw new ApiError(400, "A senha atual não confere.");
    const weak = passwordProblem(v.password, [r.user.name.split(" ")[0], r.user.email, r.user.phone]);
    if (weak) throw new ApiError(400, weak);
    await db.update(s.users).set({ passwordHash: await hashPassword(v.password) }).where(eq(s.users.id, r.user.id));
    await revokeSessions(r.user.id, r.session.id);
    await audit(r.user.id, "password.change", "user", r.user.id);
    return { ok: true };
  }

  // Esqueci a senha: o código vai para o e-mail da conta, nunca para um endereço informado agora.
  if (params.action === "reset-request") {
    if (!checkRateLimit(`reset:${ip}`, 10, 60 * 60_000)) throw new ApiError(429, "Muitas tentativas. Aguarde uma hora.");
    const v = await body(req, lookupSchema);
    const user = await findActive(v.identifier);
    if (!user) throw new ApiError(404, "Não encontramos uma conta com esse dado.");
    if (!user.email) throw new ApiError(409, "Esta conta não tem e-mail cadastrado. Fale com o suporte para recuperar o acesso.");
    await sendCode(user, user.email, "password_reset");
    await audit(user.id, "password.reset_request", "user", user.id);
    return { sentTo: maskEmail(user.email) };
  }

  if (params.action === "reset-confirm") {
    const v = await body(req, resetConfirmSchema);
    if (!checkRateLimit(`reset-confirm:${ip}`, 20)) throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos.");
    const user = await findActive(v.identifier);
    if (!user) throw new ApiError(404, "Não encontramos uma conta com esse dado.");
    const weak = passwordProblem(v.password, [user.name.split(" ")[0], user.email, user.phone]);
    if (weak) throw new ApiError(400, weak);
    await useCode(user.id, "password_reset", v.code);
    // Receber o código prova que a pessoa controla o e-mail.
    const [updated] = await db.update(s.users).set({ passwordHash: await hashPassword(v.password), emailVerifiedAt: user.emailVerifiedAt ?? new Date() })
      .where(eq(s.users.id, user.id)).returning();
    // Senha nova: quem estava conectado com a antiga (inclusive um invasor) sai de todos os aparelhos.
    await revokeSessions(user.id);
    await audit(user.id, "password.reset", "user", user.id);
    await startSession(user.id);
    // O e-mail não substitui o aplicativo autenticador: com duas etapas ativas, o código ainda é pedido.
    if (updated.totpEnabledAt) return { mfaRequired: true };
    return publicUser(updated);
  }

  if (params.action === "email-send" || params.action === "email-confirm") {
    if (!session) throw new ApiError(401, "Entre na sua conta para continuar.");
    if (params.action === "email-confirm") {
      const v = await body(req, codeSchema);
      if (!session.email) throw new ApiError(409, "Cadastre um e-mail primeiro.");
      await useCode(session.id, "email_verify", v.code);
      await db.update(s.users).set({ emailVerifiedAt: new Date() }).where(eq(s.users.id, session.id));
      await audit(session.id, "email.verified", "user", session.id);
      return { ok: true };
    }
    const v = await body(req, emailSendSchema);
    let email = session.email;
    // Novo endereço: vale só depois de confirmado, e não pode pertencer a outra conta.
    if (v.email && v.email !== session.email) {
      if (!(await emailDomainExists(v.email))) throw new ApiError(400, EMAIL_DOMAIN_ERROR);
      const [other] = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.email, v.email), ne(s.users.id, session.id)));
      if (other) throw new ApiError(409, "Este e-mail já está em outra conta.");
      await db.update(s.users).set({ email: v.email, emailVerifiedAt: null }).where(eq(s.users.id, session.id));
      await audit(session.id, "email.change", "user", session.id);
      email = v.email;
    }
    if (!email) throw new ApiError(400, "Informe o e-mail.");
    await sendCode(session, email, "email_verify");
    return { sentTo: maskEmail(email) };
  }

  if (params.action === "logout") {
    await endSession();
    return { ok: true };
  }
  throw new ApiError(404, "Ação desconhecida.");
});
