import { LeadForm } from "@/components/site/LeadForm";
import { Body, PageHead } from "@/components/site/Page";

export const metadata = { title: "Seja um parceiro" };

export default function Parceiros() {
  return (
    <>
      <PageHead title="Sua oficina no caminho de quem roda todo dia." lead="Oficinas, borracharias, centros automotivos, troca de óleo, pneus, lava-jatos, autopeças e assistência veicular: ofereça condições aos motoristas Orbi." />
      <Body narrow><LeadForm kind="parceiro" cta="Quero ser parceiro" messageLabel="Conte sobre o seu negócio e o benefício que imagina" /></Body>
    </>
  );
}
