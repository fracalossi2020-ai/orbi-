import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { ApiError } from "./api";
import { checkRateLimit } from "./auth";
import { sendMail } from "./mail";

export type CodePurpose = "email_verify" | "password_reset";

const TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;
const hash = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest();

/** Gera um código de 6 dígitos, invalida os anteriores e envia por e-mail. Só o resumo do código fica no banco. */
export async function sendCode(user: { id: string; name: string }, email: string, purpose: CodePurpose) {
  if (!checkRateLimit(`code:${user.id}`, 5, 60 * 60_000)) throw new ApiError(429, "Muitos códigos pedidos. Aguarde uma hora.");
  const db = await getDb();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.update(s.verificationCodes).set({ usedAt: new Date() })
    .where(and(eq(s.verificationCodes.userId, user.id), eq(s.verificationCodes.purpose, purpose), isNull(s.verificationCodes.usedAt)));
  await db.insert(s.verificationCodes).values({ userId: user.id, purpose, codeHash: hash(user.id, code).toString("hex"), expiresAt: new Date(Date.now() + TTL_MS) });
  const first = user.name.split(" ")[0];
  const [subject, text] = purpose === "password_reset"
    ? ["Código para criar uma nova senha", `Olá, ${first}.\n\nSeu código para criar uma nova senha na Orbi é ${code}.\nEle vale por 15 minutos.\n\nSe não foi você que pediu, ignore este e-mail: sua senha continua a mesma.`]
    : ["Confirme seu e-mail na Orbi", `Olá, ${first}.\n\nSeu código de confirmação é ${code}.\nEle vale por 15 minutos.\n\nSe você não criou uma conta na Orbi, ignore este e-mail.`];
  await sendMail(email, subject, text);
}

/** Confere o código mais recente. Depois de 5 erros, é preciso pedir outro. */
export async function useCode(userId: string, purpose: CodePurpose, code: string) {
  const db = await getDb();
  const [row] = await db.select().from(s.verificationCodes)
    .where(and(eq(s.verificationCodes.userId, userId), eq(s.verificationCodes.purpose, purpose), isNull(s.verificationCodes.usedAt)))
    .orderBy(desc(s.verificationCodes.createdAt)).limit(1);
  if (!row || row.expiresAt < new Date()) throw new ApiError(400, "Código vencido. Peça um novo.");
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, "Muitas tentativas com este código. Peça um novo.");
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(row.codeHash, "hex"), hash(userId, code));
  if (!ok) {
    await db.update(s.verificationCodes).set({ attempts: row.attempts + 1 }).where(eq(s.verificationCodes.id, row.id));
    throw new ApiError(400, "Código incorreto. Confira o e-mail e tente de novo.");
  }
  await db.update(s.verificationCodes).set({ usedAt: new Date() }).where(eq(s.verificationCodes.id, row.id));
}
