import { LeadForm } from "@/components/site/LeadForm";
import { Body, PageHead } from "@/components/site/Page";

export const metadata = { title: "Tenho interesse" };

export default function Interesse() {
  return (
    <>
      <PageHead title="Avise quando a Orbi chegar." lead="Deixe seu contato e receba novidades sobre a operação no Vale do Aço." />
      <Body narrow><LeadForm kind="passageiro" cta="Quero receber novidades" messageLabel="Algo que queira nos contar? (opcional)" /></Body>
    </>
  );
}
