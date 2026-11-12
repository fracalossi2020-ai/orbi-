import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Dark, PageHead, Steps } from "@/components/site/Page";
import { Reveal } from "@/components/site/Fx";
import { RideDemo } from "@/components/site/RideDemo";
import { StoryPhone } from "@/components/site/StoryPhone";
import { Tech } from "@/components/site/Tech";

export const metadata = { title: "Como funciona" };

export default function ComoFunciona() {
  return (
    <>
      <PageHead eyebrow="Passo a passo" title="Como funciona." lead="Dois caminhos simples, ligados pela mesma corrida.">
        <Link href="/cadastro?perfil=passageiro" className="btn btn-lg btn-on-deep">Quero viajar <Icon name="arrow" size={18} /></Link>
        <Link href="/cadastro?perfil=motorista" className="btn btn-lg btn-line-deep">Quero dirigir</Link>
      </PageHead>
      <StoryPhone />
      <Dark>
        <Reveal><p className="mono-label text-on-deep-muted">Para dirigir</p><h2 className="display mt-3 text-[clamp(2rem,4.2vw,3.6rem)]">E do outro lado da corrida.</h2></Reveal>
        <div className="mt-10">
          <Steps items={[
            { title: "Cadastre-se", text: "Envie CNH, documento do veículo e uma foto do rosto." },
            { title: "Aguarde a análise", text: "Nossa equipe valida os documentos e aprova o cadastro." },
            { title: "Fique online", text: "Rode quando quiser. Você vê origem, destino e ganho antes de aceitar." },
            { title: "Acompanhe seus ganhos", text: "Extrato por corrida, relatórios e pedido de saque." },
          ]} />
        </div>
      </Dark>
      <RideDemo />
      <Tech />
    </>
  );
}
