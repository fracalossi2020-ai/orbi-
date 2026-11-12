/**
 * Formas de pagamento da Orbi.
 * Direto ao motorista (funcionam hoje, sem provedor): dinheiro, Pix na chave do motorista e cartão na maquininha dele.
 *   O motorista recebe o valor inteiro e o extrato registra a comissão a acertar, como no dinheiro.
 * Pelo app (dependem de contrato com provedor): Pix cobrado pela Orbi e cartão.
 * Cada forma direta pode ser ligada ou desligada pelo administrador.
 */
export const PAYMENT_METHODS = ["cash", "pix_driver", "card_machine", "pix", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Pagas na mão do motorista: o dinheiro não passa pela Orbi. */
export const DIRECT_METHODS: PaymentMethod[] = ["cash", "pix_driver", "card_machine"];
export const isDirect = (m: PaymentMethod) => DIRECT_METHODS.includes(m);

export const METHOD_INFO: Record<PaymentMethod, { label: string; icon: string; how: string }> = {
  cash: { label: "Dinheiro", icon: "money", how: "Pague ao motorista no fim da viagem." },
  pix_driver: { label: "Pix para o motorista", icon: "qr", how: "No fim, o app mostra o QR Code do Pix do motorista com o valor certo." },
  card_machine: { label: "Cartão na maquininha", icon: "card", how: "Débito ou crédito na maquininha do motorista, no fim da viagem." },
  pix: { label: "Pix pelo app", icon: "qr", how: "Cobrança gerada pela Orbi ao fim da viagem." },
  card: { label: "Cartão pelo app", icon: "card", how: "Cartão salvo na sua conta." },
};

/** O que o administrador liga ou desliga. */
export type PaymentRules = { cash: boolean; pix_driver: boolean; card_machine: boolean };
export const DEFAULT_PAYMENT_RULES: PaymentRules = { cash: true, pix_driver: true, card_machine: true };

/** O motorista recebe por esta forma? Pix exige chave cadastrada; maquininha, a confirmação de que ele tem uma. */
export function driverAccepts(method: PaymentMethod, d: { pixKey: string | null; cardMachine: boolean }) {
  if (method === "pix_driver") return !!d.pixKey;
  if (method === "card_machine") return d.cardMachine;
  return true;
}
