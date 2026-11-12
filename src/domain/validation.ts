/**
 * Conferências feitas sem serviço externo. Elas barram números digitados errado ou inventados,
 * mas não provam que o dado pertence à pessoa: isso exige código por SMS, link por e-mail,
 * consulta a base oficial e a análise dos documentos pela equipe.
 */

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

const allSame = (v: string) => /^(.)\1*$/.test(v);

export function isValidCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSame(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

export function isValidCnh(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSame(d)) return false;
  let first = 0;
  for (let i = 0; i < 9; i++) first += Number(d[i]) * (9 - i);
  first %= 11;
  let discount = 0;
  if (first >= 10) { first = 0; discount = 2; }
  let second = 0;
  for (let i = 0; i < 9; i++) second += Number(d[i]) * (i + 1);
  second %= 11;
  // Há duas interpretações publicadas para o caso com desconto. Aceitar as duas evita recusar
  // uma CNH verdadeira; o documento ainda passa pela análise da equipe.
  const strict = second >= 10 ? 0 : second - discount;
  let wrapped = second - discount;
  if (wrapped < 0) wrapped += 11;
  if (wrapped >= 10) wrapped = 0;
  return first === Number(d[9]) && (strict === Number(d[10]) || wrapped === Number(d[10]));
}

/** Aceita o formato numérico e o alfanumérico adotado pela Receita Federal. */
export function isValidCnpj(value: string) {
  const c = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c) || allSame(c)) return false;
  const check = (len: number) => {
    let sum = 0;
    let weight = 2;
    for (let i = len - 1; i >= 0; i--) {
      sum += (c.charCodeAt(i) - 48) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(c[12]) && check(13) === Number(c[13]);
}

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Celular brasileiro: DDD existente, nono dígito e número que não seja uma sequência repetida. */
export function isValidMobile(value: string) {
  const d = onlyDigits(value);
  return d.length === 11 && DDDS.has(Number(d.slice(0, 2))) && d[2] === "9" && !allSame(d.slice(3));
}

/** Telefone de contato: aceita celular ou fixo, para empresas e parceiros. */
export function isValidBrPhone(value: string) {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidMobile(d);
  return d.length === 10 && DDDS.has(Number(d.slice(0, 2))) && "2345".includes(d[2]) && !allSame(d.slice(2));
}

export const isValidPlate = (value: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value.toUpperCase().replace(/[^A-Z0-9]/g, ""));

export const isValidCep = (value: string) => {
  const d = onlyDigits(value);
  return d.length === 8 && !allSame(d);
};

export const isValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(value.trim());

/** Pelo menos nome e sobrenome. */
export const isFullName = (value: string) => value.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length >= 2;

/** Os cinco tipos de chave Pix. Celular aceita o formato com +55 usado pelo Banco Central. */
export function isValidPixKey(value: string) {
  const v = value.trim();
  if (isValidEmailFormat(v)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
  if (isValidCnpj(v)) return true;
  const d = onlyDigits(v);
  if (/^\+?55/.test(v) && d.length === 13) return isValidMobile(d.slice(2));
  return isValidCpf(v) || isValidMobile(v);
}
