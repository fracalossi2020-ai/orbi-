import { Body, Legal, PageHead } from "@/components/site/Page";

export const metadata = { title: "Créditos" };

export default function Creditos() {
  return (
    <>
      <PageHead title="Créditos" lead="Quem fez o que a Orbi usa e que não foi criado por nós." />
      <Body narrow>
        <Legal>
          <h2>Modelo 3D do carro</h2>
          <p>“Car Concept”, de Eric Chadwick / Darmstadt Graphics Group, licenciado sob CC BY 4.0, a partir de um modelo original em domínio público de Unity Fan. Modificado pela Orbi: cores, remoção de marcas de terceiros e compressão.</p>
          <h2>Mapas</h2>
          <p>Mapas © colaboradores do OpenStreetMap, disponíveis sob a licença ODbL.</p>
        </Legal>
      </Body>
    </>
  );
}
