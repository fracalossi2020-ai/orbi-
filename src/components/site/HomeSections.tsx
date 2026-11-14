"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { OfferFlow } from "./OfferFlow";
import { Reveal } from "./Fx";

const focusTrip = () => {
  document.getElementById("pedir")?.scrollIntoView({ block: "center" });
  document.getElementById("destino-site")?.focus({ preventScroll: true });
};


export function DriverBand() {
  return (
    <section className="on-deep relative isolate overflow-hidden bg-deep text-on-deep">
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Reveal>
          <p className="mono-label text-on-deep-muted">Motorista parceiro</p>
          <h2 className="display mt-3 text-[clamp(2.2rem,4.6vw,4rem)]">Quem movimenta a cidade também merece ser valorizado.</h2>
          <ul className="mt-8 space-y-4">
            {[
              ["scale", "Distribuição equilibrada", "Tempo parado e ganhos do dia contam, não só quem está mais perto."],
              ["wallet", "Ganho claro antes do aceite", "Bruto, comissão e líquido em cada oferta. Você pode recusar."],
              ["gift", "Clube Orbi", "Benefícios de parceiros para motoristas aprovados."],
            ].map(([icon, title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--on-deep)_9%,transparent)]"><Icon name={icon} size={22} weight="duotone" /></span>
                <span><span className="block font-semibold">{title}</span><span className="block text-sm text-on-deep-muted">{text}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/cadastro?perfil=motorista" className="btn btn-lg btn-on-deep">Quero dirigir <Icon name="arrow" size={18} /></Link>
            <Link href="/motoristas#ganhos" className="btn btn-lg btn-line-deep">Calcular meus ganhos</Link>
          </div>
        </Reveal>
        <Reveal delay={.1} className="relative min-h-[440px]">
          <OfferFlow />
        </Reveal>
      </div>
    </section>
  );
}

/** Depois que o formulário sai da tela, um atalho volta para ele. Some no rodapé e no celular, onde cobriria os botões. */
export function QuoteBar() {
  const [formVisible, setFormVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    const form = document.getElementById("pedir");
    const footer = document.querySelector("footer");
    const a = new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting));
    const b = new IntersectionObserver(([e]) => setFooterVisible(e.isIntersecting));
    if (form) a.observe(form);
    if (footer) b.observe(footer);
    return () => { a.disconnect(); b.disconnect(); };
  }, []);
  if (formVisible || footerVisible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 hidden justify-center px-4 pb-[env(safe-area-inset-bottom)] md:flex">
      <button type="button" onClick={focusTrip} className="on-deep anim-rise glass-deep pointer-events-auto flex items-center gap-3 rounded-full bg-[color-mix(in_srgb,var(--deep)_80%,transparent)] py-2 pr-2 pl-5 text-sm font-semibold text-on-deep shadow-[0_20px_50px_-20px_rgb(0_0_0/.7)]">
        Para onde vamos?
        <span className="grid size-9 place-items-center rounded-full bg-on-deep text-deep"><Icon name="arrow" size={18} /></span>
      </button>
    </div>
  );
}
