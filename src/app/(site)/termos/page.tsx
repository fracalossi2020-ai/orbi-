import { Body, Legal, PageHead } from "@/components/site/Page";
import { Note } from "@/components/ui";

export const metadata = { title: "Termos de uso" };

export default function Termos() {
  return (
    <>
      <PageHead title="Termos de uso" lead="As regras de uso da plataforma Orbi." />
      <Body narrow>
        <Legal>
          <Note tone="warn">Minuta inicial. Precisa de revisão jurídica antes do início da operação.</Note>
          <h2>O que é a Orbi</h2>
          <p>A Orbi é uma plataforma que conecta passageiros e motoristas parceiros. Modalidades, cidades e formas de pagamento disponíveis aparecem no aplicativo.</p>
          <h2>Conta</h2>
          <p>Cada pessoa mantém uma única conta, com dados verdadeiros, e responde pelo uso dela. A Orbi pode suspender contas em caso de fraude ou risco à segurança.</p>
          <h2>Motoristas parceiros</h2>
          <p>Para ficar online, o motorista precisa de cadastro aprovado, documentos válidos e veículo aprovado. Antes de cada aceite, ele vê o valor bruto, a comissão e o líquido da corrida, e pode recusar.</p>
          <h2>Preços e pagamento</h2>
          <p>O preço estimado aparece antes da solicitação. Cupons são custeados pela Orbi e não reduzem o valor líquido do motorista. Em corridas em dinheiro, a parte da Orbi é registrada no saldo do motorista.</p>
          <h2>Conduta e segurança</h2>
          <p>Respeito é obrigatório nos dois sentidos. Em emergência, acione as autoridades pelo 190 e use o botão de emergência no aplicativo.</p>
        </Legal>
      </Body>
    </>
  );
}
