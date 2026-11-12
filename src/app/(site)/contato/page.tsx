import { LeadForm } from "@/components/site/LeadForm";
import { Body, PageHead } from "@/components/site/Page";

export const metadata = { title: "Contato" };

export default function Contato() {
  return (
    <>
      <PageHead title="Fale com a Orbi." lead="Tem conta? O atendimento mais rápido fica dentro do aplicativo, em Ajuda." />
      <Body narrow><LeadForm kind="contato" cta="Enviar mensagem" askCity={false} /></Body>
    </>
  );
}
