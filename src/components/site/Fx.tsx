"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";

/**
 * Um único ouvinte de ponteiro para todo o site: grava a posição do mouse em cada elemento
 * [data-glow], e o CSS desenha a luz. Não faz nada em telas de toque.
 */
export function Spotlight() {
  useEffect(() => {
    if (matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      document.querySelectorAll<HTMLElement>("[data-glow]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        el.style.setProperty("--mx", `${x - r.left}px`);
        el.style.setProperty("--my", `${y - r.top}px`);
      });
    };
    const on = (e: PointerEvent) => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(paint); };
    addEventListener("pointermove", on, { passive: true });
    return () => { removeEventListener("pointermove", on); cancelAnimationFrame(raf); };
  }, []);
  return null;
}

/** Entrada suave ao rolar; some com movimento reduzido. Dentro de listas, use as="li" (HTML válido). */
export function Reveal({ children, className = "", delay = 0, as = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "li" }) {
  const reduce = useReducedMotion();
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag className={className} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: .6, delay, ease: [.2, .8, .2, 1] }}>
      {children}
    </Tag>
  );
}

/**
 * Aviso de cookies (LGPD). O site usa só cookies necessários: sessão da conta e preferência de tema.
 * Não há anúncios nem rastreamento, então não há o que recusar; o aviso só informa, uma vez.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("prumo-cookies-ok") !== "1") setShow(true); } catch { /* armazenamento bloqueado: não insiste */ }
  }, []);
  if (!show) return null;
  const ok = () => { setShow(false); try { localStorage.setItem("prumo-cookies-ok", "1"); } catch { /* sem armazenamento */ } };
  return (
    <div role="region" aria-label="Aviso de cookies" className="anim-rise fixed inset-x-3 bottom-3 z-[55] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-[20px] bg-deep p-4 text-sm text-on-deep shadow-[0_24px_60px_-20px_rgb(0_0_0/.7)] sm:bottom-5 sm:flex-nowrap">
      <p className="flex-1">Usamos só cookies necessários: para manter você conectado e lembrar o tema. Sem anúncios e sem rastreamento. <a href="/privacidade" className="font-semibold underline underline-offset-2">Privacidade</a></p>
      <button type="button" onClick={ok} className="btn btn-sm btn-on-deep shrink-0">Entendi</button>
    </div>
  );
}

/** Faixa que corre na horizontal. A segunda cópia é só visual, escondida de leitores de tela. */
/** Faixa que corre como uma estrada: cada compromisso é um trecho, separado pela faixa amarela da pista. */
export function Marquee({ items }: { items: { icon: string; text: string }[] }) {
  const row = (hidden?: boolean) => (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((item) => (
        <li key={item.text} className="flex items-center gap-8 whitespace-nowrap">
          <span className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--mark)_18%,transparent)] text-[var(--mark)]"><Icon name={item.icon} size={18} weight="duotone" /></span>
            <span className="display text-lg md:text-xl">{item.text}</span>
          </span>
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[var(--mark)] opacity-70" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="road-band">
      <div className="marquee py-5">
        <div className="marquee-track flex w-max">{row()}{row(true)}</div>
      </div>
    </div>
  );
}
