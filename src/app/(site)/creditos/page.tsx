import { Body, Legal, PageHead } from "@/components/site/Page";

export const metadata = { title: "Créditos" };

export default function Creditos() {
  return (
    <>
      <PageHead title="Créditos" lead="Quem fez o que a Orbi usa e que não foi criado por nós." />
      <Body narrow>
        <Legal>
          <h2>Mapas</h2>
          <p>Mapas © colaboradores do OpenStreetMap, disponíveis sob a licença ODbL.</p>
        </Legal>
      </Body>
    </>
  );
}
