import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Dark, Features, PageHead, type Feature } from "@/components/site/Page";
import { Reveal } from "@/components/site/Fx";
import { EarningsSim, OfferCard } from "@/components/site/DriverTools";

export const metadata = { title: "Motoristas" };

const BENEFITS: Feature[] = [
  ["receipt", "Você vê antes de aceitar", "Origem, destino, valor bruto, comissão e líquido em cada oferta. Se não compensar, você recusa."],
  ["scale", "Distribuição equilibrada", "A corrida não vai só para o carro mais próximo: tempo parado e ganhos do dia também contam."],
  ["wallet", "Extrato de verdade", "Cada corrida no extrato, com relatórios por dia, semana e mês, e pedido de saque."],
  ["gift", "Clube Orbi", "Parceiros locais com condições especiais, e “Minha Economia” somando quanto você poupou."],
  ["help", "Atendimento prioritário", "Chamado de motorista entra na frente da fila."],
  ["shield", "Sua segurança também", "Passageiro identificado, avaliação nos dois sentidos e botão de emergência."],
];

const STEPS = [
  ["user", "Cadastre-se", "Envie CNH, documento do veículo e uma foto do rosto."],
  ["shield", "Aguarde a análise", "Nossa equipe valida os documentos e aprova o cadastro."],
  ["car", "Fique online", "Rode quando quiser. Você vê origem, destino e ganho antes de aceitar."],
  ["wallet", "Acompanhe seus ganhos", "Extrato por corrida, relatórios e pedido de saque."],
] as const;

export default function Motoristas() {
  return (
    <>
      <PageHead eyebrow="Para quem dirige" title="Mais respeito para quem dirige." lead="Aqui você é parceiro do negócio: sabe quanto recebe, quanto a Orbi retém e por quê."
        visual={<OfferCard />}>
        <Link href="/cadastro?perfil=motorista" className="btn btn-lg btn-on-deep">Quero dirigir <Icon name="arrow" size={18} /></Link>
        <Link href="/motoristas/requisitos" className="btn btn-lg btn-line-deep">Ver os requisitos</Link>
      </PageHead>

      <Dark className="!pt-0">
        <Reveal><p className="mono-label text-on-deep-muted">Faça a conta</p><h2 className="display mt-3 max-w-[18ch] text-[clamp(2rem,4.2vw,3.6rem)]">Quanto fica com você?</h2></Reveal>
        <Reveal className="mt-10 scroll-mt-24" delay={.05}><div id="ganhos" className="scroll-mt-24"><EarningsSim /></div></Reveal>
      </Dark>

      <Dark className="bg-[color-mix(in_srgb,var(--deep)_88%,#000)]">
        <Reveal><p className="mono-label text-on-deep-muted">Por que a Orbi</p><h2 className="display mt-3 max-w-[18ch] text-[clamp(2rem,4.2vw,3.6rem)]">Regras claras dos dois lados.</h2></Reveal>
        <div className="mt-10"><Features items={BENEFITS} /></div>
      </Dark>

      <Dark>
        <Reveal><p className="mono-label text-on-deep-muted">Como começar</p><h2 className="display mt-3 text-[clamp(2rem,4.2vw,3.6rem)]">Quatro passos até a primeira corrida.</h2></Reveal>
        <div className="relative mt-12">
        <span aria-hidden="true" className="absolute top-[34px] right-[12%] left-[12%] hidden h-px bg-[color-mix(in_srgb,var(--on-deep)_20%,transparent)] md:block" />
        <ol className="relative grid gap-4 md:grid-cols-4">
          {STEPS.map(([icon, title, text], i) => (
            <Reveal as="li" key={title} delay={i * .07}>
              <div data-glow className="glass-deep relative h-full rounded-[28px] p-6">
                <span className="relative grid size-14 place-items-center rounded-2xl bg-on-deep text-deep"><Icon name={icon} size={26} weight="duotone" /></span>
                <p className="mono-label mt-6 text-on-deep-muted">Passo {i + 1} de 4</p>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-on-deep-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        </div>
        <div className="mt-10"><Link href="/cadastro?perfil=motorista" className="btn btn-lg btn-on-deep">Começar meu cadastro <Icon name="arrow" size={18} /></Link></div>
      </Dark>
    </>
  );
}
