/**
 * Perguntas da home (parte 3). Respostas descrevem o que o app faz hoje, nas mesmas palavras da central de Ajuda.
 * Também viram dados estruturados (FAQPage) para o Google mostrar as respostas na busca.
 */
export type Faq = { q: string; a: string };

const list = (names: string[]) => names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0] ?? "";

export function homeFaq(cities: string[]): Faq[] {
  return [
    { q: "O que é a Orbi?", a: "Um aplicativo de corridas do Vale do Aço. Você escolhe para onde vai, vê o preço antes de pedir e um motorista da região te busca." },
    { q: "Em quais cidades funciona?", a: cities.length ? `Começamos por ${list(cities)}, em Minas Gerais. Novas cidades entram aos poucos.` : "Começamos pelo Vale do Aço, em Minas Gerais. Novas cidades entram aos poucos." },
    { q: "Preciso baixar alguma coisa?", a: "Não. A Orbi abre pelo navegador do celular e pode ser adicionada à tela de início, como um app. Os apps para Android e iPhone estão em preparação." },
    { q: "Como peço uma viagem?", a: "Entre na sua conta, escolha a partida (o GPS preenche, se você permitir) e o destino. O app mostra a rota, o tempo e o preço de cada categoria. Você confirma e acompanha o motorista chegando no mapa." },
    { q: "Consigo ver o preço antes?", a: "Sim. Aqui mesmo no site, a rota e o preço estimado aparecem sem cadastro. No app, o valor aparece antes de você confirmar, sem tarifa que muda no meio do caminho." },
    { q: "Como pago?", a: "Hoje, em dinheiro, direto ao motorista no fim da viagem. Pix e cartão no app entram depois do contrato com o provedor de pagamentos." },
    { q: "É seguro?", a: "O app mostra nome, foto, avaliação, carro e placa do motorista antes de você entrar. Você pode compartilhar a viagem ao vivo com quem quiser, e o botão de emergência chama a equipe da Orbi e o 190." },
    { q: "Como faço para dirigir com a Orbi?", a: "Crie sua conta de motorista e envie CNH, documento do veículo e uma foto do rosto. A equipe analisa e aprova. Cada oferta mostra o valor bruto, a comissão e o que fica com você antes do aceite." },
  ];
}
