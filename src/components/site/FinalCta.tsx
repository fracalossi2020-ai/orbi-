"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";
import { OrbiMark } from "@/components/OrbiMark";

/** Compromissos da Orbi: fixos, junto do convite para o app. */
const PROMISES: [string, string][] = [
  ["receipt", "Preço antes de pedir"], ["wallet", "Ganho claro antes de aceitar"], ["shield", "Motorista identificado"],
  ["share", "Viagem compartilhada"], ["sos", "Emergência a um toque"], ["scale", "Distribuição equilibrada"],
];

/** Convite para o app: painel no Azul Elétrico, com o símbolo da Orbi em branco e uma órbita girando devagar. */
export function FinalCta() {
  const reduce = useReducedMotion();
  return (
    <section className="panel-blue on-deep relative isolate overflow-hidden text-on-deep">
      <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-6 py-16 md:px-12 md:py-20 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mono-label text-[var(--mark)]">No app</p>
          <motion.h2 initial={reduce ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .7 }}
            className="display mt-4 max-w-[14ch] text-[clamp(2.4rem,5vw,4.4rem)] leading-[.95]">Sua próxima viagem começa no app.</motion.h2>
          <ul className="mt-8 grid max-w-xl gap-x-6 gap-y-3.5 sm:grid-cols-2" aria-label="Compromissos da Orbi">
            {PROMISES.map(([icon, text], i) => (
              <motion.li key={text} className="flex items-center gap-3 font-semibold" initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .5, delay: i * .06 }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white"><Icon name={icon} size={18} weight="duotone" /></span>
                {text}
              </motion.li>
            ))}
          </ul>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/entrar?perfil=passageiro" className="btn btn-lg bg-white text-[#0356C5] hover:-translate-y-0.5">Abrir o app <Icon name="arrow" size={18} /></Link>
            <Link href="/cadastro?perfil=motorista" className="btn btn-lg btn-line-deep">Quero ser motorista</Link>
          </div>
          <p className="mt-6 text-sm text-on-deep-muted">Apps para Android e iPhone em preparação. Hoje, use pelo navegador do celular.</p>
        </div>
        {/* O símbolo da marca, em branco, com uma órbita girando devagar em volta */}
        <div aria-hidden="true" className="relative mx-auto grid aspect-square w-[78%] max-w-[420px] place-items-center">
          <motion.div className="absolute inset-0 rounded-full border-2 border-white/25" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
            <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-white" />
          </motion.div>
          <div className="absolute inset-[14%] rounded-full border border-white/15" />
          <motion.div animate={reduce ? undefined : { y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
            <OrbiMark size={220} flat="#FFFFFF" className="h-auto w-[min(220px,48vw)]" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
