import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Dark, Features, PageHead, type Feature } from "@/components/site/Page";
import { Reveal } from "@/components/site/Fx";
import { PhoneMock } from "@/components/site/PhoneMock";
import { StoryPhone } from "@/components/site/StoryPhone";

export const metadata = { title: "Passageiros" };

const ITEMS: Feature[] = [
  ["receipt", "Preço antes de pedir", "Você compara as categorias, o tempo de chegada e o valor, e só confirma quando quiser. Sem tela a mais e sem surpresa no fim da viagem."],
  ["shield", "Motorista identificado", "Foto, nome, carro, placa e avaliação na sua tela. Documentos validados pela nossa equipe."],
  ["share", "Viagem compartilhada", "Envie um link para acompanharem seu trajeto em tempo real, sem precisar de conta."],
  ["sos", "Emergência a um toque", "Ligue para o 190 e abra um chamado prioritário direto da corrida."],
  ["wallet", "Dinheiro hoje, Pix e cartão em breve", "O aplicativo mostra as formas de pagamento disponíveis antes de você pedir."],
  ["help", "Quem responde é gente", "Ajuda, reclamações e sugestões ficam registradas e são respondidas no aplicativo."],
];

export default function Passageiros() {
  return (
    <>
      <PageHead eyebrow="Para quem viaja" title="Abra, diga para onde vai, veja o preço." lead="Sem tela a mais e sem surpresa no fim da viagem."
        visual={<div className="py-4"><PhoneMock /></div>}>
        <Link href="/cadastro?perfil=passageiro" className="btn btn-lg btn-on-deep">Criar minha conta <Icon name="arrow" size={18} /></Link>
        <Link href="/como-funciona#demonstracao" className="btn btn-lg btn-line-deep">Ver a demonstração</Link>
      </PageHead>
      <Dark>
        <Reveal><p className="mono-label text-on-deep-muted">O que muda para você</p><h2 className="display mt-3 max-w-[18ch] text-[clamp(2rem,4.2vw,3.6rem)]">Segurança e clareza em cada viagem.</h2></Reveal>
        <div className="mt-10"><Features items={ITEMS} /></div>
      </Dark>
      <StoryPhone />
    </>
  );
}
