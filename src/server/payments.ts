import { randomUUID } from "node:crypto";

import type { PaymentMethod, PaymentRules } from "@/domain/payment-methods";
import { DEFAULT_PAYMENT_RULES } from "@/domain/payment-methods";

/**
 * Direto ao motorista (dinheiro, Pix na chave dele, maquininha dele): operacionais, ligados ou desligados no painel.
 * Pix pelo app: integração com Mercado Pago escrita conforme a API pública, AINDA NÃO TESTADA com credencial real.
 * Cartão pelo app: exige tokenização no navegador com o SDK do provedor e não está implementado.
 */
export const paymentAvailability = (rules: PaymentRules = DEFAULT_PAYMENT_RULES): Record<PaymentMethod, { available: boolean; note: string }> => {
  const off = { available: false, note: "Desligado pela Orbi no momento." };
  return {
    cash: rules.cash ? { available: true, note: "Pague direto ao motorista." } : off,
    pix_driver: rules.pix_driver ? { available: true, note: "QR Code do Pix do motorista no fim da viagem." } : off,
    card_machine: rules.card_machine ? { available: true, note: "Débito ou crédito na maquininha do motorista." } : off,
    pix: process.env.MERCADOPAGO_ACCESS_TOKEN
      ? { available: true, note: "Cobrança gerada ao fim da viagem." }
      : { available: false, note: "Aguardando contrato com o provedor de pagamentos." },
    card: { available: false, note: "Aguardando contrato com o provedor de pagamentos." },
  };
};

const MP = "https://api.mercadopago.com/v1/payments";

export async function createPixCharge(input: { rideId: string; amountCents: number; payerEmail: string }) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Pix não configurado.");
  const res = await fetch(MP, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": `ride-${input.rideId}-${randomUUID()}` },
    body: JSON.stringify({
      transaction_amount: input.amountCents / 100,
      description: `Corrida Orbi ${input.rideId.slice(0, 8)}`,
      payment_method_id: "pix",
      payer: { email: input.payerEmail },
      external_reference: input.rideId,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}`);
  const data = await res.json();
  return { externalId: String(data.id), copyPaste: data.point_of_interaction?.transaction_data?.qr_code as string | undefined };
}

export async function getPixStatus(externalId: string): Promise<"pending" | "paid" | "failed"> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Pix não configurado.");
  const res = await fetch(`${MP}/${externalId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}`);
  const { status } = await res.json();
  if (status === "approved") return "paid";
  return status === "rejected" || status === "cancelled" ? "failed" : "pending";
}
