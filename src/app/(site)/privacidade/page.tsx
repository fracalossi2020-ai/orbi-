import { Body, Legal, PageHead } from "@/components/site/Page";
import { Note } from "@/components/ui";

export const metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <>
      <PageHead title="Política de privacidade" lead="Como a Orbi trata seus dados, conforme a LGPD (Lei 13.709/2018)." />
      <Body narrow>
        <Legal>
          <Note tone="warn">Minuta inicial. Precisa de revisão jurídica e dos dados de registro da empresa e do encarregado antes do início da operação.</Note>
          <h2>Dados que coletamos</h2>
          <ul>
            <li><strong>Conta:</strong> nome, e-mail, telefone e senha (guardada em formato irreversível).</li>
            <li><strong>Motoristas:</strong> CPF, CNH, documentos, foto e dados do veículo.</li>
            <li><strong>Viagens:</strong> origem, destino, trajeto, horários, valores e avaliações.</li>
            <li><strong>Localização:</strong> do passageiro, ao pedir a corrida, e do motorista, enquanto estiver online ou em viagem.</li>
          </ul>
          <h2>Para que usamos</h2>
          <ul>
            <li>Executar a corrida e calcular preços e repasses (execução de contrato).</li>
            <li>Validar identidade e documentos e prevenir fraudes (legítimo interesse e segurança).</li>
            <li>Cumprir obrigações fiscais e regulatórias (obrigação legal).</li>
            <li>Enviar novidades, apenas com seu consentimento.</li>
          </ul>
          <h2>Com quem compartilhamos</h2>
          <p>Passageiro e motorista veem o primeiro nome um do outro e os dados necessários para a viagem. Serviços de mapas recebem coordenadas para calcular rotas, e provedores de pagamento recebem os dados da cobrança. Não vendemos dados pessoais.</p>
          <h2>Link de viagem compartilhada</h2>
          <p>Quem recebe o link vê o trajeto, o primeiro nome do motorista e o veículo enquanto a viagem durar. Ao fim da corrida, o link deixa de mostrar essas informações.</p>
          <h2>Seus direitos</h2>
          <p>No aplicativo, em Conta, você pode baixar uma cópia dos seus dados ou excluir sua conta. Na exclusão, seus dados pessoais são anonimizados. Registros financeiros e de viagem ficam retidos sem identificação pelo prazo exigido em lei.</p>
          <h2>Segurança</h2>
          <p>Documentos ficam em área privada e só a equipe autorizada acessa. Todo acesso administrativo a documentos fica registrado em histórico de atividades.</p>
        </Legal>
      </Body>
    </>
  );
}
