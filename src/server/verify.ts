import { promises as dns } from "node:dns";
import { isValidCep, onlyDigits } from "@/domain/validation";

type Resolver = { resolveMx: (d: string) => Promise<unknown[]>; resolve4: (d: string) => Promise<unknown[]> };
const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA"]);

/**
 * Confere se o domínio do e-mail pode receber mensagens. Não prova que a caixa existe:
 * isso exige enviar um link de confirmação. Falha de rede não bloqueia ninguém.
 */
export async function emailDomainExists(email: string, resolver: Resolver = dns) {
  if (process.env.PRUMO_SKIP_EMAIL_DNS === "true") return true;
  const domain = email.split("@")[1];
  if (!domain) return false;
  const answered = async (lookup: Promise<unknown[]>) => {
    try { return (await lookup).length > 0; }
    catch (e) { return NOT_FOUND.has((e as NodeJS.ErrnoException).code ?? "") ? false : true; }
  };
  return (await answered(resolver.resolveMx(domain))) || (await answered(resolver.resolve4(domain)));
}

export type CepResult = { cep: string; street: string; district: string; city: string; state: string };

/** Devolve o endereço, null se o CEP não existe, "unavailable" se o serviço não respondeu. */
export async function lookupCep(value: string): Promise<CepResult | null | "unavailable"> {
  if (!isValidCep(value)) return null;
  const cep = onlyDigits(value);
  try {
    const res = await fetch(`${process.env.CEP_URL || "https://viacep.com.br"}/ws/${cep}/json/`, { signal: AbortSignal.timeout(5000) });
    if (res.status === 400) return null;
    if (!res.ok) return "unavailable";
    const data = await res.json();
    if (data.erro) return null;
    return { cep, street: data.logradouro ?? "", district: data.bairro ?? "", city: data.localidade ?? "", state: data.uf ?? "" };
  } catch {
    return "unavailable";
  }
}
