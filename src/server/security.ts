import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Peças de segurança usadas pela API: IP real de quem acessa, limite de tentativas, senha forte,
 * tipo real dos arquivos enviados, cifra de segredos e códigos do aplicativo autenticador (TOTP).
 */

// ------------------------------------------------------------------ IP de quem acessa

/**
 * O IP vem do proxy da hospedagem. O primeiro valor de x-forwarded-for é escrito pelo próprio navegador e pode ser
 * falso; o confiável é o que o proxy acrescentou por último. TRUST_PROXY_HOPS diz quantos proxies há na frente (padrão 1).
 */
export function clientIp(req: NextRequest | Request) {
  const h = req.headers;
  const real = h.get("x-real-ip");
  if (real && process.env.TRUST_X_REAL_IP === "true") return real.trim();
  const list = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length) return "local";
  const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS ?? 1) || 1);
  return list[Math.max(0, list.length - hops)];
}

// ------------------------------------------------------------------ limite de tentativas

const buckets = new Map<string, { n: number; until: number }>();
let lastSweep = 0;

/**
 * Conta tentativas por chave dentro de uma janela. Devolve false quando passou do limite.
 * A memória é limpa de tempos em tempos, para um ataque com muitas chaves não esgotar o servidor.
 */
export function rateLimit(key: string, max = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  if (now - lastSweep > 60_000 || buckets.size > 50_000) {
    lastSweep = now;
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
    if (buckets.size > 50_000) buckets.clear();
  }
  const b = buckets.get(key);
  if (!b || b.until < now) { buckets.set(key, { n: 1, until: now + windowMs }); return true; }
  b.n += 1;
  return b.n <= max;
}

/** Zera a contagem (por exemplo, depois de um login certo). */
export const resetLimit = (key: string) => { buckets.delete(key); };

// ------------------------------------------------------------------ senha

// Senhas mais usadas no Brasil e no mundo (vazamentos públicos): recusadas mesmo com 8 caracteres ou mais.
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "12345678910", "123123123", "87654321", "11111111", "00000000", "99999999", "12341234",
  "password", "password1", "senha123", "senha1234", "senhasenha", "qwertyui", "qwerty123", "asdfghjk", "iloveyou", "abcd1234",
  "abc12345", "mudar123", "admin123", "administrador", "brasil123", "flamengo", "corinthians", "palmeiras", "cruzeiro", "atletico",
  "prumo123", "prumoprumo", "ipatinga", "timoteo123", "minhasenha", "teste123", "teste1234", "11223344", "102030405060",
]);

/** Motivo para recusar a senha, ou null se ela serve. */
export function passwordProblem(password: string, personal: (string | null | undefined)[] = []) {
  if (password.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  if (password.length > 128) return "A senha pode ter até 128 caracteres.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || /^(0123456789|1234567890|9876543210)/.test(password)) return "Essa senha é muito usada e fácil de adivinhar. Escolha outra.";
  for (const p of personal) {
    const v = (p ?? "").toLowerCase().replace(/\s+/g, "");
    if (v.length >= 4 && (lower.includes(v) || lower.includes(v.split("@")[0] ?? ""))) return "A senha não pode conter seu nome, e-mail ou telefone.";
  }
  return null;
}

// ------------------------------------------------------------------ arquivos enviados

/** Tipo real do arquivo pelos primeiros bytes (não pelo que o navegador declarou). */
export function sniffFile(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

/** Cabeçalhos para entregar um arquivo enviado por usuário sem que ele rode nada no site. */
export const fileHeaders = (mime: string, extra: Record<string, string> = {}) => ({
  "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin", ...extra,
});

// ------------------------------------------------------------------ cifra de segredos (AES-256-GCM)

const keyFrom = (secret: Uint8Array) => createHash("sha256").update("prumo:cifra:v1").update(secret).digest();

export function encrypt(text: string, secret: Uint8Array) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decrypt(blob: string, secret: Uint8Array) {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Segredo em formato desconhecido.");
  const d = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

// ------------------------------------------------------------------ aplicativo autenticador (TOTP, RFC 6238)

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

/** Código de 6 dígitos para um passo de 30 s. */
export function totpAt(secretB32: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secretB32)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

export const totpStep = (now = Date.now()) => Math.floor(now / 30_000);

/**
 * Confere o código aceitando o passo anterior e o seguinte (relógio do celular adiantado ou atrasado).
 * Devolve o passo usado, para impedir que o mesmo código seja reaproveitado.
 */
export function verifyTotp(secretB32: string, code: string, lastStep: number | null, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const cur = totpStep(now);
  for (const s of [cur - 1, cur, cur + 1]) {
    if (lastStep !== null && s <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpAt(secretB32, s)), Buffer.from(code))) return s;
  }
  return null;
}

export const otpauthUrl = (secretB32: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`Orbi:${account}`)}?secret=${secretB32}&issuer=Orbi&algorithm=SHA1&digits=6&period=30`;

/** Códigos de recuperação: 10 códigos de uso único, mostrados uma vez; só o resumo fica guardado. */
export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})/, "$1-"));
  return { codes, hashes: codes.map(hashRecovery) };
}
export const hashRecovery = (code: string) => createHash("sha256").update(`prumo:rec:${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`).digest("hex");
