"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Identity } from "@/lib/identities";
import { CarArt, MotoArt } from "@/components/VehicleArt";
import { Icon } from "@/components/Icon";
import { CarStage } from "./CarStage";
import { Reveal } from "./Fx";

export type HomeCategory = { name: string; description: string; seats: number; kind?: "car" | "moto"; available?: boolean };

const focusTrip = () => {
  document.getElementById("pedir")?.scrollIntoView({ block: "center" });
  document.getElementById("destino-site")?.focus({ preventScroll: true });
};


const SAFETY = [
  { icon: "share", title: "Viagem compartilhada", text: "Mande um link e quem você escolher acompanha o trajeto ao vivo." },
  { icon: "sos", title: "Botão de emergência", text: "Abre um chamado prioritário para a equipe e liga para o 190." },
  { icon: "shield", title: "Confira antes de entrar", text: "Nome, foto, carro e placa aparecem no app assim que o motorista aceita." },
  { icon: "chat", title: "Chat da corrida", text: "Combine o ponto de encontro sem trocar número de telefone." },
];

const SOON = [
  { icon: "package", label: "Entregas" },
  { icon: "users", label: "Corporativo" },
];

/**
 * Escolha como ir: as categorias (do banco) numa garagem, cada carro na sua faixa, e o recibo que explica o preço.
 * O que ainda não funciona aparece como tal.
 */
export function Services({ categories }: { categories: HomeCategory[] }) {
  // O título conta só o que dá para pedir hoje; a moto desligada aparece na lista como "em breve".
  const ready = categories.filter((c) => c.available !== false).length;
  return (
    <section aria-labelledby="como-ir" className="relative overflow-hidden bg-surface text-ink">
      <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-10 md:py-28">
        <Reveal className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <p className="mono-label text-brand">Escolha como ir</p>
            <h2 id="como-ir" className="display mt-3 text-[clamp(2.4rem,5.4vw,4.8rem)] leading-[.95]">{ready > 1 ? `${["Um", "Dois", "Três", "Quatro", "Cinco"][ready - 1] ?? ready} jeitos de chegar.` : "Do seu jeito."} <span className="text-brand">Um preço antes de tudo.</span></h2>
          </div>
          <p className="max-w-[44ch] text-muted md:justify-self-end">Você vê o valor de cada categoria antes de pedir e só confirma se quiser. Sem tarifa que muda no meio do caminho.</p>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <ul className="border-t border-line">
            {categories.map((c, i) => (
              <Reveal as="li" key={c.name} delay={i * .08} className="garage-lane group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line py-7 sm:grid-cols-[13rem_minmax(0,1fr)_auto]">
                <div className="relative col-span-2 h-24 overflow-hidden sm:col-span-1">
                  <span aria-hidden="true" className="garage-road absolute inset-x-0 bottom-3 h-[3px]" />
                  <div className={`garage-car absolute bottom-3 left-0 ${c.available === false ? "opacity-55 grayscale-[.4]" : ""}`}>
                    {c.kind === "moto" ? <MotoArt className="w-32" title="" /> : <CarArt className={c.seats > 4 ? "w-52" : "w-44"} title="" />}
                  </div>
                </div>
                <div>
                  <h3 className="display flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl md:text-4xl">{c.name}
                    {c.available === false && <span className="rounded-full border border-dashed border-[color-mix(in_srgb,var(--ink)_35%,transparent)] px-2.5 py-1 font-[family-name:var(--f-inter)] text-xs font-semibold tracking-normal text-muted">Em breve</span>}
                  </h3>
                  <p className="mt-1 text-muted">{c.description}</p>
                  {c.available === false && <p className="mt-1 text-sm text-muted">Mototáxi depende de autorização de cada prefeitura. Liberamos aqui assim que a sua cidade permitir.</p>}
                </div>
                <p className="flex items-center gap-1.5 self-start rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold sm:self-center"><Icon name="user" size={16} />{c.seats}</p>
              </Reveal>
            ))}
            <li className="pt-8">
              <button type="button" onClick={focusTrip} className="btn btn-primary btn-lg">Ver o preço da minha viagem <Icon name="arrow" size={18} /></button>
            </li>
          </ul>

          {/* Recibo: como o preço é formado. Sem valores inventados. */}
          <Reveal delay={.15} className="receipt relative mx-auto w-full max-w-sm rotate-[1.5deg] bg-[#FBFAF6] px-7 pt-8 pb-12 text-[#22282c] shadow-[0_30px_60px_-30px_rgb(0_0_0/.45)] transition-transform duration-500 hover:rotate-0">
            <p className="mono-label text-center">Orbi · comprovante de preço</p>
            <p className="mt-1 text-center font-mono text-xs opacity-60">mostrado antes de você confirmar</p>
            <dl className="mt-7 space-y-3 font-mono text-sm">
              {[["Corrida", "distância + tempo"], ["Taxa de serviço", "fixa por categoria"], ["Cupom", "desconto na hora"]].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2"><dt>{k}</dt><span aria-hidden="true" className="flex-1 border-b border-dotted border-current opacity-40" /><dd>{v}</dd></div>
              ))}
              <div className="flex items-baseline gap-2 border-t-2 border-dashed border-current pt-4 text-base font-bold"><dt>TOTAL</dt><span aria-hidden="true" className="flex-1" /><dd>antes de pedir</dd></div>
            </dl>
            <p className="mt-7 text-center font-mono text-xs opacity-70">Tarifas definidas por cidade e categoria, no painel da Orbi.</p>
            <svg aria-hidden="true" viewBox="0 0 120 16" className="mx-auto mt-5 h-8 w-40 opacity-80"><g fill="currentColor">{Array.from({ length: 30 }, (_, i) => <rect key={i} x={i * 4} y={0} width={i % 3 ? 1.5 : 2.6} height={16} />)}</g></svg>
          </Reveal>
        </div>

        <Reveal className="mt-16 flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-surface-2 p-5 md:p-6">
          <div>
            <span className="mono-label text-muted">Em preparação · ainda não disponível</span>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SOON.map((s) => (
                <li key={s.label} className="inline-flex items-center gap-2 rounded-full border border-dashed border-[color-mix(in_srgb,var(--ink)_30%,transparent)] px-4 py-2 text-sm font-semibold">
                  <Icon name={s.icon} size={18} weight="duotone" />{s.label}
                </li>
              ))}
            </ul>
          </div>
          <Link href="/status" className="btn btn-sm btn-ghost">Ver o que já funciona</Link>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Viagem compartilhada, como quem recebe o link vê: a rota com o carro andando, em loop, e a chegada.
 * Ilustrativo: sem nomes nem lugares reais.
 */
function SafetyLive() {
  const route = "M30 150 C 70 150, 70 92, 120 92 S 186 46, 232 40";
  return (
    <Reveal delay={.1} className="relative mx-auto mt-12 w-full max-w-[420px]">
      <div aria-hidden="true" className="relative overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--on-deep)_12%,transparent)] bg-[#040B18] shadow-[0_40px_90px_-40px_rgb(3_86_197/.7)]">
        <svg viewBox="0 0 260 190" className="block w-full">
          <defs>
            <linearGradient id="safe-route" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0A3BFF" /><stop offset="1" stopColor="#00E1FF" /></linearGradient>
            <radialGradient id="safe-glow" cx=".8" cy=".1" r=".9"><stop offset="0" stopColor="#0B6BFF" stopOpacity=".3" /><stop offset="1" stopColor="#0B6BFF" stopOpacity="0" /></radialGradient>
          </defs>
          <rect width="260" height="190" fill="url(#safe-glow)" />
          <g stroke="rgb(140 180 255 / .09)" strokeWidth="8" fill="none" strokeLinecap="round">
            <path d="M-10 70 L270 50" /><path d="M-10 132 L270 118" /><path d="M60 -10 L80 200" /><path d="M170 -10 L184 200" />
          </g>
          <path d={route} stroke="url(#safe-route)" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".18" />
          <path d={route} stroke="url(#safe-route)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="30" cy="150" r="5" fill="#fff" stroke="#0B6BFF" strokeWidth="3" />
          <path d="M232 26 c-6 0 -10 4.5 -10 10 c0 7 10 16 10 16 s10 -9 10 -16 c0 -5.5 -4 -10 -10 -10z" fill="#00E1FF" />
          <circle cx="232" cy="36" r="3.4" fill="#040B18" />
          {/* Carro andando pela rota, com o pulso de quem está sendo acompanhado */}
          <g>
            <circle r="14" fill="#00E1FF" opacity=".18"><animate attributeName="r" values="8;18;8" dur="2s" repeatCount="indefinite" /><animateMotion dur="9s" repeatCount="indefinite" path={route} keyPoints="0;1;1" keyTimes="0;.85;1" calcMode="linear" /></circle>
            <circle r="6.5" fill="#fff" stroke="#0B6BFF" strokeWidth="3"><animateMotion dur="9s" repeatCount="indefinite" path={route} keyPoints="0;1;1" keyTimes="0;.85;1" calcMode="linear" /></circle>
          </g>
        </svg>
        <div className="flex items-center gap-3 border-t border-white/8 px-4 py-3.5">
          <span className="relative grid size-2.5 place-items-center"><span className="pulse-ring absolute size-2.5 rounded-full bg-[#5BD49B]" /><span className="size-2.5 rounded-full bg-[#5BD49B]" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Viagem compartilhada ao vivo</span><span className="block text-xs text-on-deep-muted">Quem recebe o link vê o trajeto e a chegada</span></span>
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-semibold">Exemplo</span>
        </div>
      </div>
      {/* Etiquetas flutuando ao redor do cartão */}
      <span aria-hidden="true" className="safety-float absolute -top-4 -right-3 flex items-center gap-2 rounded-2xl border border-white/12 bg-[#0A1424]/90 px-3 py-2 text-xs font-semibold backdrop-blur-md sm:-right-8">
        <span className="grid size-6 place-items-center rounded-lg text-white" style={{ background: "var(--grad)" }}><Icon name="shield" size={14} weight="fill" /></span>Motorista verificado
      </span>
      <span aria-hidden="true" className="safety-float absolute top-[46%] -left-3 flex items-center gap-2 rounded-2xl border border-white/12 bg-[#0A1424]/90 px-3 py-2 text-xs font-semibold backdrop-blur-md [animation-delay:-2.5s] sm:-left-8">
        <span className="grid size-6 place-items-center rounded-lg bg-[#E5484D] text-white"><Icon name="sos" size={14} weight="fill" /></span>Emergência a um toque
      </span>
    </Reveal>
  );
}

/** Segurança: à esquerda, a viagem compartilhada ao vivo; à direita, os recursos em cartões. */
export function Safety() {
  return (
    <section aria-labelledby="seguranca" className="on-deep relative overflow-hidden bg-deep text-on-deep">
      <div className="mx-auto grid max-w-[1280px] gap-14 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="mono-label text-on-deep-muted">Segurança</p>
            <h2 id="seguranca" className="display mt-3 text-[clamp(2.4rem,5vw,4.4rem)] leading-[.95]">Do pedido à chegada, você não fica sozinho.</h2>
            <p className="mt-5 max-w-[44ch] text-on-deep-muted">Recursos que já funcionam no app, em toda viagem, sem custo extra.</p>
          </Reveal>
          {/* Viagem compartilhada ao vivo: a rota com o carro andando e quem acompanha à distância */}
          <SafetyLive />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:self-center">
          {SAFETY.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * .06} className="group relative overflow-hidden rounded-[24px] border border-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] bg-[color-mix(in_srgb,#0A1E3D_45%,transparent)] p-6 transition-colors duration-300 hover:border-[color-mix(in_srgb,#0B6BFF_55%,transparent)]">
              <span aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[#0B6BFF] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30" />
              <span className="grid size-12 place-items-center rounded-2xl text-white shadow-[0_12px_30px_-12px_#0B6BFF] transition-transform duration-500 group-hover:-rotate-6" style={{ background: "var(--grad)" }}><Icon name={s.icon} size={24} weight="fill" /></span>
              <h3 className="display mt-6 text-2xl">{s.title}</h3>
              <p className="mt-2 text-on-deep-muted">{s.text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Para quem dirige: o carro 3D e a oferta como o motorista vê. Valores rotulados como ilustrativos. */
export function DriverBand({ car }: { car: Identity["car"] }) {
  return (
    <section className="on-deep relative isolate overflow-hidden bg-deep text-on-deep">
      <div aria-hidden="true" className="hero-aurora absolute inset-0 -z-10 opacity-70" />
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
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
        <Reveal delay={.1} className="relative h-[380px] overflow-hidden rounded-[28px] bg-[color-mix(in_srgb,var(--deep)_75%,#000)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--on-deep)_12%,transparent)] sm:h-[480px] lg:h-[560px]">
          <CarStage colors={car} />
          <div className="glass-deep pointer-events-none absolute right-4 bottom-4 w-[min(300px,calc(100%-2rem))] rounded-[22px] bg-[color-mix(in_srgb,var(--deep)_88%,transparent)] p-4">
            <p className="mono-label text-on-deep-muted">Nova oferta · exemplo ilustrativo</p>
            <dl className="num mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-on-deep-muted">Valor bruto</dt><dd>R$ 25,00</dd></div>
              <div className="flex justify-between"><dt className="text-on-deep-muted">Comissão Orbi</dt><dd>− R$ 3,75</dd></div>
              <div className="flex items-baseline justify-between border-t border-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] pt-1.5"><dt className="font-semibold">Você recebe</dt><dd className="text-xl font-semibold text-[var(--mark)]">R$ 21,25</dd></div>
            </dl>
          </div>
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
