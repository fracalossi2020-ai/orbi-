import { Badge } from "@/components/ui";
import { Body, PageHead } from "@/components/site/Page";

export const metadata = { title: "O que já funciona" };

const GROUPS: { title: string; tone: "ok" | "warn" | "neutral"; label: string; items: [string, string][] }[] = [
  {
    title: "Operacional", tone: "ok", label: "Funciona", items: [
      ["Contas e acesso", "Cadastro por e-mail ou telefone e senha, sessões e níveis de acesso (admin, gestor, atendente)."],
      ["Ciclo da corrida", "Cotação, pedido, oferta, aceite, chegada, início, fim, cancelamento e avaliação, com atualização em tempo real."],
      ["Distribuição de corridas", "Algoritmo equilibrado, com pesos configuráveis e fila quando o motorista recusa ou não responde."],
      ["Financeiro do motorista", "Bruto, comissão e líquido antes do aceite, extrato, relatórios, planos e pedido de saque com aprovação."],
      ["Painel administrativo", "Indicadores, aprovações, tarifas, cupons, campanhas, parceiros, regiões, chamados, relatórios e histórico."],
      ["Pagamento em dinheiro", "Registrado na corrida e refletido no saldo do motorista."],
      ["Conferência de dados", "CPF, CNH, CNPJ e placa pelo cálculo oficial, celular por DDD e formato, domínio do e-mail, CEP e CPF, CNH, telefone e placa sem duplicidade. Barra erros de digitação e números inventados, mas não prova que o dado é da pessoa."],
      ["LGPD e segurança", "Exportação e exclusão de dados, viagem compartilhada, botão de emergência, ocorrências e registro de atividades."],
    ],
  },
  {
    title: "Depende de integração externa", tone: "warn", label: "Precisa de contrato", items: [
      ["Pix", "Código escrito para o Mercado Pago, nunca testado com credencial real. Fica oculto até configurar o token."],
      ["Cartão", "Não implementado: depende da escolha do provedor e da tokenização no aplicativo."],
      ["Transferência do saque", "O pedido e a aprovação funcionam, mas a transferência é feita fora do sistema e marcada como paga pela equipe."],
      ["Mapas, rotas e endereços", "Funcionam com serviços públicos gratuitos (OpenFreeMap, OSRM, Photon), que não são indicados para produção."],
      ["Login por SMS e Google", "Não implementados: dependem de provedores de SMS e OAuth. Sem o código por SMS, o celular informado não está confirmado."],
      ["E-mail: confirmação e nova senha", "Código pronto e testado com a caixa de saída local. Para enviar de verdade, falta uma conta SMTP (Brevo grátis: 300 por dia) em SMTP_URL e MAIL_FROM. Nunca testado com envio real."],
      ["Notificações push", "As notificações funcionam dentro do aplicativo. Push com a tela bloqueada exige app nativo ou configuração de Web Push."],
      ["Validação de identidade", "A análise de documentos é manual. Consultar CPF, CNH e placa nas bases oficiais e a biometria dependem de um fornecedor pago."],
      ["Ligação com número protegido", "O contato hoje é pelo chat da corrida. Mascarar números exige provedor de telefonia."],
    ],
  },
  {
    title: "Demonstração", tone: "neutral", label: "Só ilustração", items: [
      ["Pedido na página inicial", "Mapa esquemático, rota ilustrativa e valores fictícios. Não pede corrida nem cobra nada."],
      ["Exemplos em Tecnologia", "Motoristas e valores de exemplo, calculados com o algoritmo real."],
      ["Carro 3D", "Modelo conceito licenciado (CC BY 4.0), não representa a frota."],
    ],
  },
  {
    title: "Preparado, ainda desligado", tone: "neutral", label: "Desligado", items: [
      ["Moto, motofrete, entregas e corporativo", "Modalidades já existem no banco, com documentos e regras próprias. Ficam inativas até a validação legal e a criação das telas específicas."],
      ["Novas cidades", "Basta cadastrar a região e suas tarifas no painel."],
    ],
  },
];

export default function Status() {
  return (
    <>
      <PageHead title="O que já funciona, de verdade." lead="Separamos o que opera hoje, o que depende de terceiros e o que é só demonstração." />
      <Body>
        <div className="space-y-14">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h2 className="display mb-5 text-3xl">{g.title}</h2>
              <ul className="divide-y divide-line border-y border-line">
                {g.items.map(([t, d]) => (
                  <li key={t} className="grid gap-2 py-4 md:grid-cols-[1fr_2fr_auto] md:items-baseline md:gap-6">
                    <span className="font-semibold">{t}</span><span className="text-muted">{d}</span><span><Badge tone={g.tone}>{g.label}</Badge></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Body>
    </>
  );
}
