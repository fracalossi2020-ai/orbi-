"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { Faq } from "@/lib/home-faq";
import { socialLinks } from "@/lib/social";
import { Reveal } from "./Fx";
import { useSupport } from "./usePublic";

/**
 * A home em três partes, sobre o branco do site (as partes escuras são painéis arredondados):
 * 1. O que é: o hero e, logo abaixo, os três passos (ConceptStrip).
 * 2. No app: o convite para usar o app (FinalCta) e a parte de motoristas.
 * 3. Dúvidas: perguntas e respostas, redes sociais e contato (HomeFaq).
 */

const STEPS: [string, string, string][] = [
  ["pin", "Diga para onde vai", "Partida pelo GPS, destino pela busca."],
  ["receipt", "Veja o preço e confirme", "O valor aparece antes. Você só pede se quiser."],
  ["car", "Um motorista da região te busca", "Nome, foto, carro e placa na tela."],
];

/** Parte 1, continuação do hero: o conceito em três passos, sem mudar o fundo. */
export function ConceptStrip() {
  return (
    <section id="o-que-e" aria-label="Como a Orbi funciona" className="relative bg-bg text-ink">
      <div className="mx-auto max-w-[1440px] px-5 pb-12 md:px-10 md:pb-16">
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map(([icon, title, text], i) => (
            <Reveal as="li" key={title} delay={i * .06} className="flex items-start gap-4 rounded-[22px] border border-line bg-surface p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-primary"><Icon name={icon} size={22} weight="duotone" /></span>
              <span>
                <span className="block font-semibold">{i + 1}. {title}</span>
                <span className="mt-0.5 block text-sm text-muted">{text}</span>
              </span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Parte 3: perguntas e respostas, redes sociais e contato. */
export function HomeFaq({ items }: { items: Faq[] }) {
  const support = useSupport();
  const social = socialLinks();
  const whatsapp = support?.whatsapp ? `https://wa.me/${support.whatsapp}?text=${encodeURIComponent("Olá, Orbi!")}` : "";
  return (
    <section id="duvidas" aria-labelledby="duvidas-titulo" className="scroll-mt-20 bg-bg text-ink">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[1fr_1.6fr]">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="mono-label text-brand">Dúvidas</p>
          <h2 id="duvidas-titulo" className="display mt-3 text-[clamp(2rem,4vw,3.4rem)] leading-[.95]">Perguntas frequentes.</h2>
          <p className="mt-4 max-w-[38ch] text-muted">Não achou? Veja a <Link href="/ajuda" className="font-semibold text-primary underline underline-offset-4">central de ajuda</Link> ou fale com a gente.</p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Redes sociais e contato">
            {whatsapp && (
              <li><a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-primary"><Icon name="whatsapp" size={18} /> WhatsApp</a></li>
            )}
            {social.map((s) => (
              <li key={s.id}>
                <a href={s.href} target={s.id === "email" ? undefined : "_blank"} rel="noopener noreferrer" className="btn btn-ghost"><Icon name={s.icon} size={18} /> {s.label}</a>
              </li>
            ))}
            {!whatsapp && !social.length && <li><Link href="/contato" className="btn btn-ghost"><Icon name="chat" size={18} /> Fale conosco</Link></li>}
          </ul>
        </Reveal>

        <div className="divide-y divide-line border-y border-line">
          {items.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold md:text-lg [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 transition-transform group-open:rotate-45"><Icon name="plus" size={16} /></span>
              </summary>
              <p className="max-w-[62ch] pb-5 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
