import { describe, expect, it } from "vitest";
import { crc16, normalizePixKey, pixKeyMatches, pixPayload } from "@/domain/pix";
import { driverAccepts, isDirect } from "@/domain/payment-methods";
import { ledgerEffect } from "@/domain/pricing";

describe("Pix copia e cola", () => {
  it("CRC16-CCITT confere com o vetor padrão", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("CRC confere com o exemplo do manual do Banco Central", () => {
    const body = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(body)).toBe("1D3D");
  });
  it("leva chave, valor, nome e cidade, e termina com o CRC certo", () => {
    const p = pixPayload({ key: "+5531999998888", name: "José da Silva", city: "Timóteo", amountCents: 2345, txid: "Orbi123" });
    expect(p).toContain("0014br.gov.bcb.pix0114+5531999998888");
    expect(p).toContain("54052" + "3.45");
    expect(p).toContain("5913JOSE DA SILVA");
    expect(p).toContain("6007TIMOTEO");
    expect(p).toContain("0507Orbi123");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
  it("normaliza a chave conforme o tipo escolhido", () => {
    expect(normalizePixKey("(31) 99999-8888", "phone")).toBe("+5531999998888");
    expect(normalizePixKey("529.982.247-25", "cpf")).toBe("52998224725");
    expect(normalizePixKey(" Voce@Exemplo.com ", "email")).toBe("voce@exemplo.com");
    expect(pixKeyMatches("529.982.247-25", "cpf")).toBe(true);
    expect(pixKeyMatches("529.982.247-25", "phone")).toBe(false);
    expect(pixKeyMatches("31999998888", "phone")).toBe(true);
  });
});

describe("formas de pagamento", () => {
  it("Pix na chave e maquininha são pagos direto ao motorista, como o dinheiro", () => {
    expect(isDirect("pix_driver") && isDirect("card_machine") && isDirect("cash")).toBe(true);
    expect(isDirect("pix")).toBe(false);
    const fare = { totalCents: 2000, driverNetCents: 1500 };
    expect(ledgerEffect("pix_driver", fare)).toEqual({ type: "cash_due", amountCents: -500 });
    expect(ledgerEffect("card_machine", fare)).toEqual({ type: "cash_due", amountCents: -500 });
    expect(ledgerEffect("pix", fare)).toEqual({ type: "ride_net", amountCents: 1500 });
  });
  it("só recebe corrida por Pix quem tem chave, e por maquininha quem tem uma", () => {
    expect(driverAccepts("pix_driver", { pixKey: null, cardMachine: true })).toBe(false);
    expect(driverAccepts("pix_driver", { pixKey: "+5531999998888", cardMachine: false })).toBe(true);
    expect(driverAccepts("card_machine", { pixKey: "x", cardMachine: false })).toBe(false);
    expect(driverAccepts("cash", { pixKey: null, cardMachine: false })).toBe(true);
  });
});
