import { Body, Legal, PageHead } from "@/components/site/Page";
import { Note } from "@/components/ui";
import { DRIVER_TERMS_VERSION } from "@/domain/driver-rules";

export const metadata = { title: "Termo de adesão do motorista parceiro", description: "Regras, direitos e deveres de quem dirige com a Orbi." };

const version = DRIVER_TERMS_VERSION.split("-").reverse().join("/");

export default function TermosMotorista() {
  return (
    <>
      <PageHead eyebrow="Motorista parceiro" title="Termo de adesão do motorista parceiro" lead={`Versão de ${version}. O aceite fica registrado no seu cadastro, com data e versão.`} />
      <Body narrow>
        <Legal>
          <Note tone="warn">Minuta inicial. Precisa de revisão jurídica antes do início da operação.</Note>

          <h2>1. O que é este termo</h2>
          <p>Este termo define as regras para usar a plataforma Orbi como motorista parceiro no transporte remunerado privado individual de passageiros, nos termos da Lei 12.587/2012, com as alterações da Lei 13.640/2018, e das normas do município onde você roda.</p>

          <h2>2. Relação entre você e a Orbi</h2>
          <p>Você é um profissional autônomo. Não há vínculo de emprego, subordinação, horário obrigatório nem exclusividade: você decide quando fica online, quais corridas aceita e pode usar outras plataformas. A Orbi fornece a tecnologia que conecta você ao passageiro e cobra uma comissão por corrida concluída.</p>

          <h2>3. Requisitos para se cadastrar e continuar rodando</h2>
          <ul>
            <li>Idade mínima, tempo de habilitação e idade do carro definidos na página de requisitos, que seguem a regra do município.</li>
            <li>CNH definitiva, categoria B ou superior, válida e com a observação &quot;Exerce Atividade Remunerada&quot; (EAR).</li>
            <li>Certidão negativa de antecedentes criminais.</li>
            <li>Inscrição no INSS como contribuinte individual, que pode ser como microempreendedor individual (MEI).</li>
            <li>Veículo com CRLV em dia, nas condições de segurança e conforto exigidas, sem placa vermelha e sem adesivos comerciais.</li>
            <li>Documentos exigidos pelo município, quando houver, como cadastro municipal e seguro de Acidentes Pessoais de Passageiros (APP).</li>
          </ul>
          <p>Você declara que todas as informações e documentos enviados são verdadeiros e se compromete a atualizá-los quando vencerem ou mudarem. CNH vencida ou documento irregular impede ficar online até a regularização.</p>

          <h2>4. Ganhos, comissão e pagamentos</h2>
          <ul>
            <li>Antes de aceitar cada corrida, você vê o valor bruto, a comissão da Orbi e o valor líquido. Pode recusar sem justificar.</li>
            <li>A comissão e as tarifas são definidas por cidade e categoria e ficam visíveis no aplicativo. Mudanças são avisadas com antecedência no aplicativo.</li>
            <li>Corridas pagas direto a você (dinheiro, Pix na sua chave ou maquininha) têm a parte da Orbi registrada no seu saldo, para acerto. Corridas pagas pelo aplicativo têm o líquido creditado no saldo, com pedido de saque pelo aplicativo.</li>
            <li>Cupons de desconto são pagos pela Orbi e não reduzem o seu líquido.</li>
            <li>Impostos, contribuição ao INSS, combustível, manutenção e demais custos do veículo são de sua responsabilidade.</li>
          </ul>

          <h2>5. Conduta e segurança</h2>
          <ul>
            <li>Respeito a todos os passageiros, sem discriminação de qualquer tipo (raça, cor, gênero, orientação sexual, religião, origem, idade ou deficiência). Pessoas com deficiência e cão-guia devem ser atendidas.</li>
            <li>É proibido dirigir sob efeito de álcool ou drogas, usar o celular de forma insegura ao volante e desrespeitar as leis de trânsito.</li>
            <li>A pessoa ao volante deve ser sempre a titular do cadastro, no veículo cadastrado e aprovado. Compartilhar a conta leva ao desligamento.</li>
            <li>Respeite o limite de jornada e faça pausas: cansaço é causa de acidentes.</li>
            <li>Mantenha o aplicativo aberto durante a corrida, com o GPS do celular ligado: a posição é compartilhada com o passageiro e com quem ele escolher, para a segurança de todos.</li>
            <li>Em emergência, acione o 190 e o botão de emergência do aplicativo.</li>
          </ul>

          <h2>6. Avaliações, suspensão e desligamento</h2>
          <p>Passageiros e motoristas se avaliam ao fim de cada corrida. A conta pode ser suspensa ou desligada em caso de documentos irregulares, fraude, conduta que coloque pessoas em risco, discriminação, violência ou descumprimento deste termo. Você será informado do motivo e poderá apresentar sua defesa pelo atendimento do aplicativo antes da decisão definitiva, salvo quando houver risco imediato à segurança.</p>

          <h2>7. Seus dados (LGPD)</h2>
          <p>A Orbi trata seus dados pessoais (documentos, endereço, localização durante o uso, ganhos e avaliações) para cadastro, segurança, pagamento e cumprimento de obrigações legais, conforme a Lei Geral de Proteção de Dados e a <a href="/privacidade">Política de Privacidade</a>. Documentos só são vistos pela equipe de análise, e cada acesso fica registrado. Você pode pedir uma cópia ou a exclusão dos seus dados pelo aplicativo, respeitados os prazos legais de guarda.</p>

          <h2>8. Imagem e identificação</h2>
          <p>Seu primeiro nome, sua foto de perfil, o modelo, a cor e a placa do veículo aparecem para o passageiro da corrida, para que ele confira antes de embarcar.</p>

          <h2>9. Alterações deste termo</h2>
          <p>Mudanças neste termo são avisadas no aplicativo com antecedência. Se não concordar, você pode encerrar o cadastro a qualquer momento. Novas versões pedem novo aceite.</p>

          <h2>10. Foro</h2>
          <p>Fica eleito o foro da comarca do seu domicílio para resolver questões relacionadas a este termo.</p>
        </Legal>
      </Body>
    </>
  );
}
