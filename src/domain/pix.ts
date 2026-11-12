/**
 * Pix "copia e cola" estático (BR Code), no padrão do Banco Central (EMV QRCPS-MPM).
 * Gerado aqui, sem provedor: leva a chave do motorista, o nome, a cidade e o valor da corrida.
 * Qualquer aplicativo de banco lê o código; o dinheiro vai direto para a conta do motorista.
 */

import { isValidCnpj, isValidCpf, isValidEmailFormat, isValidMobile, onlyDigits } from "./validation";

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no fim do código. */
export function crc16(text: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Sem acentos e em maiúsculas, como os bancos esperam no nome e na cidade. */
const ascii = (t: string, max: number) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim().toUpperCase().slice(0, max) || "Orbi";

export const PIX_KEY_TYPES = { cpf: "CPF", cnpj: "CNPJ", phone: "Celular", email: "E-mail", random: "Chave aleatória" } as const;
export type PixKeyType = keyof typeof PIX_KEY_TYPES;

/**
 * Chave como o Pix espera, a partir do tipo escolhido pelo motorista (celular e CPF têm 11 dígitos,
 * então o tipo não é adivinhado): celular com +55, CPF e CNPJ só números, e-mail em minúsculas.
 */
export function normalizePixKey(key: string, type: PixKeyType) {
  const k = key.trim();
  const digits = k.replace(/\D/g, "");
  if (type === "phone") return `+55${digits.replace(/^55(?=\d{10,11}$)/, "")}`;
  if (type === "cpf" || type === "cnpj") return digits;
  return k.toLowerCase();
}

/** A chave confere com o tipo escolhido? */
export function pixKeyMatches(key: string, type: PixKeyType) {
  const k = key.trim();
  const d = onlyDigits(k);
  if (type === "cpf") return isValidCpf(k);
  if (type === "cnpj") return isValidCnpj(k);
  if (type === "phone") return isValidMobile(d.length === 13 && d.startsWith("55") ? d.slice(2) : d);
  if (type === "email") return isValidEmailFormat(k);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k);
}

/** key: já normalizada (normalizePixKey). */
export function pixPayload(input: { key: string; name: string; city: string; amountCents: number; txid?: string }) {
  const account = field("00", "br.gov.bcb.pix") + field("01", input.key);
  const txid = (input.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body = [
    field("00", "01"),
    field("26", account),
    field("52", "0000"),
    field("53", "986"),
    field("54", (input.amountCents / 100).toFixed(2)),
    field("58", "BR"),
    field("59", ascii(input.name, 25)),
    field("60", ascii(input.city, 15)),
    field("62", field("05", txid)),
  ].join("") + "6304";
  return body + crc16(body);
}
