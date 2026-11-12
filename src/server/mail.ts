import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/db";
import { ApiError } from "./api";

/**
 * Envio de e-mail por SMTP: funciona com qualquer provedor, inclusive os gratuitos
 * (Brevo: 300 por dia; conta Gmail com senha de app). Sem SMTP_URL, em desenvolvimento
 * e nos testes, a mensagem vai para a pasta outbox em vez de sair.
 */
const outbox = () => process.env.PRUMO_MAIL_OUTBOX === "true" || (process.env.NODE_ENV !== "production" && !process.env.SMTP_URL);

export const mailConfigured = () => Boolean(process.env.SMTP_URL) || outbox();

export async function sendMail(to: string, subject: string, text: string) {
  if (process.env.SMTP_URL) {
    if (!process.env.MAIL_FROM) throw new ApiError(503, "Defina MAIL_FROM com o remetente verificado no provedor de e-mail.");
    const { createTransport } = await import("nodemailer");
    try {
      await createTransport(process.env.SMTP_URL).sendMail({ from: process.env.MAIL_FROM, to, subject, text });
    } catch {
      throw new ApiError(503, "Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.");
    }
    return;
  }
  if (outbox()) {
    const dir = path.join(dataDir(), "outbox");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}-${to.replace(/[^a-z0-9@.]/gi, "_")}.txt`), `Para: ${to}\nAssunto: ${subject}\n\n${text}\n`);
    console.info(`[e-mail não enviado: SMTP_URL ausente] Para ${to} · ${subject} · ver ${dir}`);
    return;
  }
  throw new ApiError(503, "O envio de e-mail ainda não foi configurado. Fale com o suporte.");
}

/** Mostra o suficiente para a pessoa reconhecer o endereço sem expô-lo inteiro. */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, Math.min(2, user.length))}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
}
