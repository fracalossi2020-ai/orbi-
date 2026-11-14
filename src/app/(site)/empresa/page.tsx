import Link from "next/link";
import { eq } from "drizzle-orm";
import { Icon } from "@/components/Icon";
import { OrbiMark } from "@/components/OrbiMark";
import { CoverageMap } from "@/components/site/CoverageMap";
import { OrbiStory } from "@/components/site/OrbiStory";
import { Reveal } from "@/components/site/Fx";
import { Dark, PageHead } from "@/components/site/Page";
import { getDb, schema as s } from "@/db";

export const metadata = { title: "A empresa" };

const VALUES = [
  ["scale", "Respeito", "Motorista é parceiro do negócio. Regras claras, atendimento prioritário e nenhuma surpresa no valor."],
  ["receipt", "Transparência", "Passageiro vê o preço antes de pedir. Motorista vê bruto, comissão e líquido antes de aceitar."],
  ["shield", "Confiança", "Documentos validados, viagem compartilhável e um canal de emergência acompanhado por pessoas."],
] as const;

async function areas() {
  try {
    return await (await getDb()).select({ lat: s.regions.lat, lng: s.regions.lng, radiusKm: s.regions.radiusKm }).from(s.regions).where(eq(s.regions.active, true));
  } catch { return []; }
}

export default async function Empresa() {
  const coverage = await areas();
  return (
    <>
      <PageHead eyebrow="A empresa" title="Orbi: tudo girando em volta de você." lead="O nome vem de órbita. Quem viaja fica no centro: o motorista vem até você, o preço aparece antes e a viagem pode ser acompanhada do começo ao fim. É assim que queremos a mobilidade do Vale do Aço, correta com quem viaja e com quem dirige."
        visual={
          <div aria-hidden="true" className="relative mx-auto grid aspect-square w-[78%] max-w-[380px] place-items-center">
            <div className="absolute inset-0 rounded-full border-2 border-[color-mix(in_srgb,var(--primary)_30%,transparent)] motion-safe:animate-spin" style={{ animationDuration: "40s" }}>
              <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-primary" />
            </div>
            <div className="absolute inset-[14%] rounded-full border border-line" />
            <OrbiMark size={200} className="h-auto w-[min(200px,44vw)]" gid="empresa-mark" />
          </div>
        } />
      <OrbiStory />
      <Dark>
        <ul className="grid gap-4 lg:grid-cols-3">
          {VALUES.map(([icon, title, text], i) => (
            <Reveal as="li" key={title} delay={i * .07}>
              <div data-glow className="glass-deep h-full rounded-[28px] p-7">
                <span className="grid size-12 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--mark)_16%,transparent)] text-[var(--mark)]"><Icon name={icon} size={26} weight="duotone" /></span>
                <h2 className="display mt-6 text-3xl">{title}</h2>
                <p className="mt-3 text-on-deep-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Dark>
      <Dark className="bg-[color-mix(in_srgb,var(--deep)_88%,#000)]">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <p className="mono-label text-on-deep-muted">Onde começamos</p>
            <h2 className="display mt-3 text-[clamp(2rem,4.2vw,3.6rem)]">Começamos pelo Vale do Aço.</h2>
            <div className="mt-6 space-y-4 text-lg text-on-deep-muted">
              <p>A primeira operação será em Ipatinga, Coronel Fabriciano e Timóteo. A plataforma foi construída para receber novas cidades e modalidades sem precisar ser refeita.</p>
              <p>Motocicleta, motofrete, entregas e transporte corporativo ficam separados, com regras e cadastros próprios, e só entram quando estiverem legalmente permitidos.</p>
            </div>
            <Link href="/interesse" className="btn btn-lg btn-on-deep mt-8">Quero acompanhar <Icon name="arrow" size={18} /></Link>
          </Reveal>
          <Reveal delay={.1}><CoverageMap areas={coverage} className="h-[380px] sm:h-[460px]" /></Reveal>
        </div>
      </Dark>
    </>
  );
}
