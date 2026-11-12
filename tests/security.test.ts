import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, clientIp, decrypt, encrypt, hashRecovery, newRecoveryCodes, passwordProblem, rateLimit, sniffFile, totpAt, verifyTotp } from "@/server/security";

describe("aplicativo autenticador (TOTP)", () => {
  // RFC 6238, apêndice B: segredo "12345678901234567890", instante 59 s → 94287082 (8 dígitos); com 6 dígitos, 287082.
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("base32 e vetor oficial da norma", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(totpAt(secret, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe("081804");
  });
  it("aceita um passo de diferença no relógio e recusa código repetido", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totpAt(secret, step), null, now)).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step - 3), null, now)).toBeNull();
    // Já usado este passo: o mesmo código não vale de novo.
    expect(verifyTotp(secret, totpAt(secret, step), step, now)).toBeNull();
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
  });
  it("códigos de recuperação: 10, únicos, conferidos sem diferenciar traço e maiúsculas", () => {
    const { codes, hashes } = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(hashRecovery(codes[0].toLowerCase().replace("-", ""))).toBe(hashes[0]);
  });
});

describe("senha", () => {
  it("recusa curta, muito usada, repetida e com dados pessoais", () => {
    expect(passwordProblem("abc")).toContain("8 caracteres");
    expect(passwordProblem("12345678")).toContain("fácil de adivinhar");
    expect(passwordProblem("aaaaaaaaaa")).toContain("fácil de adivinhar");
    expect(passwordProblem("joana2026!", ["Joana"])).toContain("nome");
    expect(passwordProblem("x-31999998888", [null, null, "31999998888"])).toContain("telefone");
    expect(passwordProblem("cavalo-azul-ponte-77", ["Joana", "joana@x.com"])).toBeNull();
  });
});

describe("arquivos e segredos", () => {
  it("reconhece o tipo pelo conteúdo, não pelo nome", () => {
    expect(sniffFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffFile(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffFile(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
  it("cifra e decifra; com outra chave, falha", () => {
    const k = new TextEncoder().encode("k".repeat(40));
    const blob = encrypt("SEGREDO", k);
    expect(blob).not.toContain("SEGREDO");
    expect(decrypt(blob, k)).toBe("SEGREDO");
    expect(() => decrypt(blob, new TextEncoder().encode("x".repeat(40)))).toThrow();
  });
});

describe("IP e limite", () => {
  it("usa o IP acrescentado pelo proxy, não o que o navegador inventou", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 200.1.2.3" } });
    expect(clientIp(req)).toBe("200.1.2.3");
  });
  it("limite por chave", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3)).toBe(true);
    expect(rateLimit(key, 3)).toBe(false);
  });
});
