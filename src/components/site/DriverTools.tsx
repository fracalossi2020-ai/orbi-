"use client";
import { useEffect, useId, useRef, useState } from "react";
import { brl, quoteFare } from "@/domain/pricing";
import { useTariffs } from "./usePublic";

/** Comissão do exemplo. A taxa real é definida no painel por cidade e categoria e aparece em cada oferta. */
const EXAMPLE_COMMISSION_BPS = 1500;
const OFFER_SECONDS = 15;

/** Oferta como o motorista a vê, com a contagem regressiva do aceite. Valores ilustrativos. */
export function OfferCard() {
  const [left, setLeft] = useState(OFFER_SECONDS);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 1 ? OFFER_SECONDS : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const gross = 2500;
  const commission = Math.round((gross * EXAMPLE_COMMISSION_BPS) / 10000);
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <div data-glow className="glass-deep relative mx-auto w-full max-w-[400px] rounded-[32px] p-6">
      <div className="flex items-center justify-between">
        <p className="mono-label text-on-deep-muted">Nova oferta · exemplo ilustrativo</p>
        <span className="relative grid size-16 place-items-center" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90"><circle cx="32" cy="32" r={R} fill="none" stroke="color-mix(in srgb, var(--on-deep) 14%, transparent)" strokeWidth="4" /><circle cx="32" cy="32" r={R} fill="none" stroke="var(--mark)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / OFFER_SECONDS)} style={{ transition: "stroke-dashoffset 1s linear" }} /></svg>
          <span className="num absolute text-lg font-semibold">{left}</span>
        </span>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <p className="flex items-center gap-2"><span className="size-2.5 rounded-full border-2 border-[var(--mark)]" /><span className="text-on-deep-muted">Partida</span><span className="ml-auto font-semibold">Centro, Ipatinga</span></p>
        <p className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--mark)]" /><span className="text-on-deep-muted">Chegada</span><span className="ml-auto font-semibold">Centro, Timóteo</span></p>
      </div>
      <dl className="num mt-5 space-y-1.5 border-t border-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] pt-4">
        <div className="flex justify-between"><dt className="text-on-deep-muted">Valor bruto</dt><dd>{brl(gross)}</dd></div>
        <div className="flex justify-between"><dt className="text-on-deep-muted">Comissão Orbi ({EXAMPLE_COMMISSION_BPS / 100}%)</dt><dd>− {brl(commission)}</dd></div>
        <div className="flex items-baseline justify-between pt-1"><dt className="font-semibold">Você recebe</dt><dd className="display text-3xl text-[var(--mark)]">{brl(gross - commission)}</dd></div>
      </dl>
      <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-2 text-center text-sm font-semibold"><span className="rounded-full bg-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] py-3">Recusar</span><span className="rounded-full bg-on-deep py-3 text-deep">Aceitar</span></div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between"><label htmlFor={id} className="text-sm font-semibold">{label}</label><output htmlFor={id} className="num text-lg font-semibold">{value.toLocaleString("pt-BR")} {suffix}</output></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[color-mix(in_srgb,var(--on-deep)_16%,transparent)] accent-[var(--mark)]" />
    </div>
  );
}

/** Número que corre até o valor novo, como um painel. Sem animação com movimento reduzido. */
function Rolling({ cents }: { cents: number }) {
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(cents); return; }
    const start = performance.now(), a = from.current, b = cents;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 450, 1);
      const v = Math.round(a + (b - a) * (1 - Math.pow(1 - t, 3)));
      setShown(v); from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cents]);
  return <>{brl(shown)}</>;
}

/**
 * Simulador de ganhos com a tarifa e a comissão reais do painel, por cidade e categoria.
 * A pessoa ajusta como roda (horas, corridas por hora, tamanho das corridas); é estimativa, não promessa de ganho.
 */
export function EarningsSim() {
  const cities = useTariffs();
  const [cityIdx, setCityIdx] = useState(0);
  const [catIdx, setCatIdx] = useState(0);
  const [hours, setHours] = useState(8);
  const [perHour, setPerHour] = useState(1.5);
  const [kmAvg, setKmAvg] = useState(6);
  const [minAvg, setMinAvg] = useState(15);
  const [days, setDays] = useState(5);
  const city = cities?.[cityIdx];
  const cat = city?.categories[catIdx] ?? city?.categories[0];
  if (!cities) return <div className="glass-deep h-80 animate-pulse rounded-[32px]" aria-label="Carregando tarifas" />;
  if (!city || !cat) return <p className="glass-deep rounded-[32px] p-6 text-on-deep-muted">As tarifas ainda não foram cadastradas no painel.</p>;
  const fare = quoteFare(cat.tariff, kmAvg * 1000, minAvg * 60);
  const ridesDay = Math.round(hours * perHour * 10) / 10;
  const grossDay = Math.round(fare.grossCents * ridesDay);
  const commissionDay = Math.round(fare.commissionCents * ridesDay);
  const netDay = grossDay - commissionDay;
  const netShare = grossDay ? Math.round((netDay / grossDay) * 100) : 0;
  const rows = [["Por dia", 1], ["Por semana", days], ["Por mês", days * 4.33]] as const;
  const select = "w-full cursor-pointer rounded-xl bg-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] px-3 py-2.5 font-semibold";
  return (
    <div data-glow className="glass-deep grid gap-8 rounded-[32px] p-6 md:p-9 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Cidade
            <select className={`${select} mt-1.5`} value={cityIdx} onChange={(e) => { setCityIdx(Number(e.target.value)); setCatIdx(0); }}>
              {cities.map((c, i) => <option key={c.id} value={i} className="text-[#242B30]">{c.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Categoria
            <select className={`${select} mt-1.5`} value={catIdx} onChange={(e) => setCatIdx(Number(e.target.value))}>
              {city.categories.map((c, i) => <option key={c.slug} value={i} className="text-[#242B30]">{c.name}</option>)}
            </select>
          </label>
        </div>
        <Slider label="Horas online por dia" value={hours} min={1} max={14} suffix="h" onChange={setHours} />
        <Slider label="Corridas por hora" value={perHour} min={0.5} max={4} step={0.5} suffix="" onChange={setPerHour} />
        <Slider label="Distância média da corrida" value={kmAvg} min={1} max={30} suffix="km" onChange={setKmAvg} />
        <Slider label="Duração média da corrida" value={minAvg} min={5} max={60} suffix="min" onChange={setMinAvg} />
        <Slider label="Dias rodando por semana" value={days} min={1} max={7} suffix="" onChange={setDays} />
      </div>
      <div>
        <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)] p-4"><p className="mono-label text-on-deep-muted">Corrida média</p><p className="num mt-1 text-2xl font-semibold"><Rolling cents={fare.grossCents} /></p><p className="text-xs text-on-deep-muted">pela tarifa de {city.name}</p></div>
          <div className="rounded-2xl bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)] p-4"><p className="mono-label text-on-deep-muted">Comissão</p><p className="num mt-1 text-2xl font-semibold">{(fare.commissionBps / 100).toLocaleString("pt-BR")}%</p><p className="text-xs text-on-deep-muted">definida no painel · {ridesDay.toLocaleString("pt-BR")} corridas/dia</p></div>
        </div>
        <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--on-deep)_14%,transparent)]">
          <div className="bg-[var(--mark)] transition-[width] duration-300" style={{ width: `${netShare}%` }} />
        </div>
        <p className="mono-label mt-2 flex justify-between text-on-deep-muted"><span>Fica com você · {netShare}%</span><span>Comissão · {100 - netShare}%</span></p>
        <table className="num mt-6 w-full text-left text-sm sm:text-base">
          <caption className="sr-only">Ganhos estimados com os valores escolhidos</caption>
          <thead><tr className="mono-label text-on-deep-muted"><th className="pb-2 font-medium"> </th><th className="pb-2 text-right font-medium">Bruto</th><th className="hidden pb-2 text-right font-medium sm:table-cell">Comissão</th><th className="pb-2 text-right font-medium">Você recebe</th></tr></thead>
          <tbody>
            {rows.map(([label, mult]) => (
              <tr key={label} className="border-t border-[color-mix(in_srgb,var(--on-deep)_12%,transparent)]">
                <th scope="row" className="py-3 pr-2 font-medium whitespace-nowrap text-on-deep-muted">{label}</th>
                <td className="py-3 text-right whitespace-nowrap"><Rolling cents={Math.round(grossDay * mult)} /></td>
                <td className="hidden py-3 text-right text-on-deep-muted sm:table-cell">− <Rolling cents={Math.round(commissionDay * mult)} /></td>
                <td className="py-3 text-right text-base font-semibold whitespace-nowrap text-[var(--mark)] sm:text-lg"><Rolling cents={Math.round(netDay * mult)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-on-deep-muted">Estimativa com a tarifa e a comissão atuais do painel, sem promessa de ganho: depende de quantos pedidos houver. Antes de combustível, manutenção e outros custos seus.</p>
      </div>
    </div>
  );
}
