import { describe, expect, it } from "vitest";
import { isFullName, isValidBrPhone, isValidCep, isValidCnh, isValidCnpj, isValidCpf, isValidEmailFormat, isValidMobile, isValidPixKey, isValidPlate } from "@/domain/validation";
import { emailDomainExists } from "@/server/verify";

describe("documentos", () => {
  it("CPF confere os dígitos e recusa sequências", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224726")).toBe(false);
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("CNH confere os dígitos e recusa sequências", () => {
    expect(isValidCnh("71354015908")).toBe(true);
    expect(isValidCnh("11111111111")).toBe(false);
    expect(isValidCnh("71354015907")).toBe(false);
  });
  it("CNPJ aceita o formato numérico e o alfanumérico", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
  });
  it("placa aceita o formato antigo e o Mercosul", () => {
    expect(isValidPlate("ABC1D23")).toBe(true);
    expect(isValidPlate("abc-1234")).toBe(true);
    expect(isValidPlate("AB12345")).toBe(false);
  });
});

describe("contato", () => {
  it("celular exige DDD real, nono dígito e número não repetido", () => {
    expect(isValidMobile("(31) 98888-7777")).toBe(true);
    expect(isValidMobile("3188887777")).toBe(false);
    expect(isValidMobile("20988887777")).toBe(false);
    expect(isValidMobile("31999999999")).toBe(false);
  });
  it("telefone de contato aceita fixo", () => {
    expect(isValidBrPhone("3138887777")).toBe(true);
    expect(isValidBrPhone("3198887777")).toBe(false);
  });
  it("nome precisa de sobrenome", () => {
    expect(isFullName("Rita Lima")).toBe(true);
    expect(isFullName("Rita")).toBe(false);
  });
  it("CEP e e-mail conferem o formato", () => {
    expect(isValidCep("35160-039")).toBe(true);
    expect(isValidCep("00000000")).toBe(false);
    expect(isValidEmailFormat("a@b.com.br")).toBe(true);
    expect(isValidEmailFormat("a@b")).toBe(false);
  });
  it("chave Pix aceita os cinco tipos", () => {
    for (const k of ["529.982.247-25", "11222333000181", "+5531988887777", "31988887777", "a@b.com", "123e4567-e89b-12d3-a456-426614174000"]) expect(isValidPixKey(k)).toBe(true);
    expect(isValidPixKey("chave-qualquer")).toBe(false);
  });
});

describe("domínio do e-mail", () => {
  const fail = (code: string) => async () => { throw Object.assign(new Error(code), { code }); };
  it("aceita domínio com servidor de e-mail", async () => {
    expect(await emailDomainExists("a@b.com", { resolveMx: async () => [{}], resolve4: fail("ENOTFOUND") })).toBe(true);
  });
  it("recusa domínio inexistente", async () => {
    expect(await emailDomainExists("a@nada.com", { resolveMx: fail("ENOTFOUND"), resolve4: fail("ENOTFOUND") })).toBe(false);
  });
  it("não bloqueia ninguém por falha de rede", async () => {
    expect(await emailDomainExists("a@b.com", { resolveMx: fail("ETIMEOUT"), resolve4: fail("ETIMEOUT") })).toBe(true);
  });
});
