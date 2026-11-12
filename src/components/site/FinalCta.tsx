"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";
import { PhoneMock } from "./PhoneMock";

/** Compromissos da Orbi: fixos, junto do convite final. */
const PROMISES: [string, string][] = [
  ["receipt", "Preço antes de pedir"], ["wallet", "Ganho claro antes de aceitar"], ["shield", "Motorista identificado"],
  ["share", "Viagem compartilhada"], ["sos", "Emergência a um toque"], ["scale", "Distribuição equilibrada"],
];

/**
 * Convite final, no estilo da capa do manual: preto profundo, o arco azul da marca atravessando a seção
 * e o celular com o app em movimento.
 */
export function FinalCta() {
  const reduce = useReducedMotion();
  return (
    <section className="on-deep relative isolate overflow-hidden bg-deep text-on-deep">
      {/* Arco da marca + brilho, como na capa do manual */}
      <svg aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-10 size-full">
        <defs>
          <linearGradient id="cta-arc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0A3BFF" /><stop offset=".6" stopColor="#0B6BFF" /><stop offset="1" stopColor="#00E1FF" /></linearGradient>
          <filter id="cta-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="80" /></filter>
        </defs>
        <motion.g initial={reduce ? false : { opacity: 0, x: 120 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: [.2, .8, .2, 1] }}>
          <path d="M760 960C900 620 1120 400 1500 300L1500 520C1240 560 1060 740 980 960Z" fill="url(#cta-arc)" filter="url(#cta-blur)" opacity=".6" />
          <path d="M760 960C900 620 1120 400 1500 300L1500 520C1240 560 1060 740 980 960Z" fill="url(#cta-arc)" opacity=".9" />
        </motion.g>
      </svg>
      <div aria-hidden="true" className="orbit-grid absolute inset-0 -z-10" />
      {/* O arco se apaga antes do rodapé: as duas partes emendam sem linha */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-deep to-transparent" />

      <div className="mx-auto grid max-w-[1280px] items-center gap-16 px-5 py-24 md:px-10 md:py-32 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="mono-label text-[var(--mark)]">Comece agora</p>
          <motion.h2 initial={reduce ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .7 }}
            className="display mt-4 max-w-[12ch] text-[clamp(2.8rem,6.6vw,6rem)] leading-[.92]">Encontre seu caminho. <span className="text-grad">Faça parte da Orbi.</span></motion.h2>
          <ul className="mt-10 grid max-w-xl gap-x-6 gap-y-3.5 sm:grid-cols-2" aria-label="Compromissos da Orbi">
            {PROMISES.map(([icon, text], i) => (
              <motion.li key={text} className="flex items-center gap-3 font-semibold" initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .5, delay: i * .06 }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] bg-[color-mix(in_srgb,#0B6BFF_18%,transparent)] text-[#5CC8FF]"><Icon name={icon} size={18} weight="duotone" /></span>
                {text}
              </motion.li>
            ))}
          </ul>
          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/cadastro?perfil=passageiro" className="btn btn-lg btn-on-deep">Quero ser passageiro <Icon name="arrow" size={18} /></Link>
            <Link href="/cadastro?perfil=motorista" className="btn btn-lg btn-line-deep">Quero ser motorista</Link>
          </div>
          <p className="mt-6 text-sm text-on-deep-muted">Apps para Android e iPhone em preparação. Hoje, use pelo navegador do celular.</p>
        </div>
        <motion.div className="mx-auto" initial={reduce ? false : { opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 60, damping: 16 }}>
          <motion.div animate={reduce ? undefined : { y: [0, -10, 0], rotate: [-2, -1, -2] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
            <PhoneMock />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
