/**
 * Regularização do motorista parceiro.
 *
 * Base legal (Lei 13.640/2018, que incluiu o art. 11-B na Lei 12.587/2012), nos municípios que regulamentam o serviço:
 *   CNH categoria B ou superior com a observação "Exerce Atividade Remunerada" (EAR), veículo que atenda à idade máxima
 *   e às características exigidas pela autoridade de trânsito e pelo município, CRLV em dia, certidão negativa de
 *   antecedentes criminais e inscrição no INSS como contribuinte individual (pode ser MEI).
 * Prática das plataformas: CNH definitiva (não Permissão Para Dirigir), carro de 4 portas, 5 lugares e ar-condicionado,
 *   foto de perfil de frente, sem placa vermelha e sem adesivos.
 * Seguro APP e cadastro municipal variam por cidade.
 *
 * Moto (mototáxi, Lei 12.009/2009 e Resolução Contran 410/2012): 21 anos, 2 anos de habilitação na categoria A,
 *   curso especializado de mototaxista, colete com faixas refletivas, capacete com faixas, protetor de motor e aparador
 *   de linha. Só funciona onde o município autoriza: a modalidade nasce desligada e o administrador liga no painel.
 *
 * Os números ficam no painel (Configurações › Requisitos do motorista): os valores abaixo são só o ponto de partida.
 */

export const DOC_KINDS = ["cnh", "crlv", "selfie", "antecedentes", "residencia", "seguro_app", "curso_mototaxi"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_INFO: Record<DocKind, { label: string; hint: string }> = {
  cnh: { label: "CNH com EAR", hint: "Foto legível da CNH definitiva (frente e verso) ou o PDF da CNH digital, com a observação \"Exerce atividade remunerada\"." },
  crlv: { label: "Documento do veículo (CRLV)", hint: "CRLV do ano, em foto ou o PDF exportado do app Carteira Digital de Trânsito." },
  selfie: { label: "Foto de perfil", hint: "De frente, rosto e ombros, boa luz, sem óculos escuros e só você na foto. Aparece para o passageiro depois de aprovada." },
  antecedentes: { label: "Certidão de antecedentes criminais", hint: "Certidão negativa, emitida grátis no site da Polícia Federal (gov.br) ou da Polícia Civil de MG, com até 90 dias." },
  residencia: { label: "Comprovante de residência", hint: "Conta de água, luz, telefone ou internet dos últimos 3 meses, no seu nome ou com declaração de quem é o titular." },
  seguro_app: { label: "Apólice de seguro APP", hint: "Seguro de Acidentes Pessoais de Passageiros, quando a cidade exige." },
  curso_mototaxi: { label: "Certificado do curso de mototaxista", hint: "Curso especializado (Resolução Contran 410/2012), feito em autoescola ou no Detran. Só para quem vai levar passageiro de moto." },
};

export type DriverRules = {
  minAge: number;
  /** Anos desde a primeira habilitação. */
  minLicenseYears: number;
  /** Idade máxima do carro, em anos (o município pode exigir menos). */
  maxVehicleAge: number;
  minDoors: number;
  minSeats: number;
  requireAirConditioning: boolean;
  requiredDocs: DocKind[];
  /** Moto: anos de habilitação na categoria A (a lei pede 2). */
  motoMinLicenseYears: number;
  /** Idade máxima da moto, em anos (o município pode exigir menos). */
  maxMotoAge: number;
};

export const DEFAULT_DRIVER_RULES: DriverRules = {
  minAge: 21, minLicenseYears: 1, maxVehicleAge: 12, minDoors: 4, minSeats: 5, requireAirConditioning: true,
  requiredDocs: ["cnh", "crlv", "selfie", "antecedentes", "residencia"],
  motoMinLicenseYears: 2, maxMotoAge: 10,
};

/** Categorias de CNH aceitas no cadastro: A (só moto), B ou superior (carro), ou as duas. */
export const CNH_CATEGORIES = ["A", "B", "AB", "C", "AC", "D", "AD", "E", "AE"] as const;
/** Permitem dirigir carro. */
export const CAR_CNH = ["B", "AB", "C", "AC", "D", "AD", "E", "AE"] as const;
/** Permitem pilotar moto. */
export const MOTO_CNH = ["A", "AB", "AC", "AD", "AE"] as const;

/** Lê as regras salvas completando com o padrão (campos novos, como os da moto, ainda não existem nas regras já salvas). */
export const withDefaultRules = (saved: Partial<DriverRules> | null | undefined): DriverRules => ({ ...DEFAULT_DRIVER_RULES, ...(saved ?? {}) });

/** Versão do termo de adesão que o motorista aceita no cadastro. Mudou o texto: muda a versão e pede novo aceite. */
export const DRIVER_TERMS_VERSION = "2026-11-10";

const yearsBetween = (from: Date, to: Date) => {
  let y = to.getFullYear() - from.getFullYear();
  if (to.getMonth() < from.getMonth() || (to.getMonth() === from.getMonth() && to.getDate() < from.getDate())) y -= 1;
  return y;
};

/** O que impede o cadastro do motorista, com as regras atuais. Lista vazia: está tudo certo. */
export function driverProblems(d: { birthDate: Date; cnhCategory: string; cnhFirstLicenseAt: Date; cnhExpiresAt: Date; ear: boolean }, rules: DriverRules, now = new Date()) {
  const out: string[] = [];
  if (Number.isNaN(d.birthDate.getTime()) || d.birthDate > now) out.push("Data de nascimento inválida.");
  else if (yearsBetween(d.birthDate, now) < rules.minAge) out.push(`É preciso ter pelo menos ${rules.minAge} anos.`);
  if (!(CNH_CATEGORIES as readonly string[]).includes(d.cnhCategory)) out.push("A CNH precisa ser da categoria A (moto), B ou superior (carro).");
  if (Number.isNaN(d.cnhFirstLicenseAt.getTime()) || d.cnhFirstLicenseAt > now) out.push("Data da primeira habilitação inválida.");
  else if (yearsBetween(d.cnhFirstLicenseAt, now) < rules.minLicenseYears) out.push(`É preciso ter pelo menos ${rules.minLicenseYears} ${rules.minLicenseYears === 1 ? "ano" : "anos"} de habilitação.`);
  if (Number.isNaN(d.cnhExpiresAt.getTime()) || d.cnhExpiresAt < now) out.push("A CNH está vencida. Renove antes de se cadastrar.");
  if (!d.ear) out.push("A CNH precisa da observação EAR (Exerce Atividade Remunerada). Peça a inclusão no Detran-MG.");
  return out;
}

/**
 * O que impede o veículo de ser aceito, com as regras atuais.
 * `kind`: carro (padrão) ou moto. `driver`: dados da CNH, para conferir se ela permite esse tipo de veículo.
 */
export function vehicleProblems(
  v: { year: number; doors: number; seats: number; airConditioning: boolean; kind?: "car" | "moto"; motoGear?: boolean },
  rules: DriverRules, now = new Date(),
  driver?: { cnhCategory: string | null; cnhFirstLicenseAt: Date | null },
) {
  const out: string[] = [];
  if (v.kind === "moto") {
    const oldest = now.getFullYear() - rules.maxMotoAge;
    if (v.year < oldest) out.push(`A moto precisa ser de ${oldest} ou mais nova.`);
    if (v.year > now.getFullYear() + 1) out.push("Ano da moto inválido.");
    if (driver?.cnhCategory && !(MOTO_CNH as readonly string[]).includes(driver.cnhCategory)) out.push("Para levar passageiro de moto, a CNH precisa ter a categoria A.");
    if (driver?.cnhFirstLicenseAt && yearsBetween(driver.cnhFirstLicenseAt, now) < rules.motoMinLicenseYears) out.push(`Para moto, é preciso ter pelo menos ${rules.motoMinLicenseYears} anos de habilitação na categoria A.`);
    if (!v.motoGear) out.push("Confirme os equipamentos obrigatórios: colete e capacete com faixas refletivas, protetor de motor e aparador de linha.");
    return out;
  }
  const oldest = now.getFullYear() - rules.maxVehicleAge;
  if (v.year < oldest) out.push(`O carro precisa ser de ${oldest} ou mais novo.`);
  if (v.year > now.getFullYear() + 1) out.push("Ano do carro inválido.");
  if (v.doors < rules.minDoors) out.push(`O carro precisa ter pelo menos ${rules.minDoors} portas.`);
  if (v.seats < rules.minSeats) out.push(`O carro precisa ter pelo menos ${rules.minSeats} lugares.`);
  if (rules.requireAirConditioning && !v.airConditioning) out.push("O carro precisa ter ar-condicionado funcionando.");
  if (driver?.cnhCategory && !(CAR_CNH as readonly string[]).includes(driver.cnhCategory)) out.push("Para dirigir carro, a CNH precisa ser da categoria B ou superior.");
  return out;
}
