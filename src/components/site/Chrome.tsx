"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { Logo } from "@/components/Logo";
import { OrbiAccent } from "@/components/OrbiMark";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ui";

const LINKS = [
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/passageiros", label: "Passageiros" },
  { href: "/motoristas", label: "Motoristas" },
  { href: "/clube", label: "Clube Orbi" },
  { href: "/empresa", label: "A empresa" },
];

/** account: endereço do app de quem já entrou. Assim o site e o app funcionam como uma coisa só. */
export function SiteNav({ account = null }: { account?: string | null }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  // Barra sempre escura: todas as páginas do site abrem com a faixa escura, como a inicial.
  const overHero = true;
  const pill = "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)]";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${overHero ? "on-deep border-b border-[color-mix(in_srgb,var(--on-deep)_8%,transparent)] bg-[color-mix(in_srgb,var(--deep)_78%,transparent)] text-on-deep backdrop-blur-xl" : "border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] text-ink backdrop-blur-lg"}`}>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-2 px-5 md:px-10">
        <Link href="/" aria-label="Orbi, página inicial"><Logo size={24} hole={overHero ? "var(--deep)" : "var(--bg)"} /></Link>
        <nav aria-label="Principal" className="mr-auto ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} className={pill}>{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/ajuda" className={`${pill} hidden lg:block`}>Ajuda</Link>
          {account
            ? <Link href={account} className="rounded-full bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_var(--glow)] transition-transform hover:-translate-y-px">Minha conta</Link>
            : <>
                <Link href="/entrar" className={`${pill} hidden sm:block`}>Entrar</Link>
                <Link href="/cadastro" className="hidden rounded-full bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_var(--glow)] transition-transform hover:-translate-y-px sm:block">Criar conta</Link>
              </>}
          <button type="button" className="grid size-11 place-items-center lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"}>
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Menu" className="anim-sheet border-t border-line bg-bg px-5 py-3 text-ink lg:hidden">
          {[...LINKS, { href: "/ajuda", label: "Ajuda" }, account ? { href: account, label: "Minha conta" } : { href: "/entrar", label: "Entrar ou criar conta" }].map((l) => <Link key={l.href} href={l.href} className="block py-3 text-lg font-medium">{l.label}</Link>)}
        </nav>
      )}
    </header>
  );
}

/** Progresso da leitura: uma linha fina com o degradê da marca, presa ao topo, que cresce com a rolagem. */
export function PlumbLine() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28 });
  return (
    <motion.div aria-hidden="true" style={{ scaleX, transformOrigin: "0 50%", background: "var(--grad)" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]" />
  );
}

export function SiteFooter({ cities = [] }: { cities?: { slug: string; name: string }[] }) {
  return (
    <footer className="on-deep bg-deep text-on-deep">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] md:px-10">
        <div>
          <Logo size={28} />
          <p className="mt-4 max-w-xs text-on-deep-muted">Mobilidade urbana mais simples, rápida e segura.</p>
          <p className="mt-2 text-sm text-on-deep-muted">Primeira operação: Ipatinga, Coronel Fabriciano e Timóteo, em Minas Gerais.</p>
        </div>
        <FooterCol title="Plataforma" links={[["Como funciona", "/como-funciona"], ["Passageiros", "/passageiros"], ["Motoristas", "/motoristas"], ["Requisitos para dirigir", "/motoristas/requisitos"], ["Clube Orbi", "/clube"]]} />
        {cities.length > 0 && <FooterCol title="Cidades" links={cities.map((c) => [c.name, `/cidades/${c.slug}`] as [string, string])} />}
        <FooterCol title="Empresa" links={[["A empresa", "/empresa"], ["Central de ajuda", "/ajuda"], ["Seja um parceiro", "/parceiros"], ["Tenho interesse", "/interesse"], ["Contato", "/contato"]]} />
        <FooterCol title="Transparência" links={[["Privacidade", "/privacidade"], ["Termos de uso", "/termos"], ["Termo do motorista", "/termos-motorista"], ["O que já funciona", "/status"], ["Créditos", "/creditos"]]} />
      </div>
      <p aria-hidden="true" className="display pointer-events-none mx-auto max-w-[1280px] overflow-hidden px-5 text-center text-[clamp(5rem,26vw,22rem)] leading-[.78] tracking-tight select-none md:px-10"><span className="relative inline-block" style={{ letterSpacing: "-0.06em", backgroundImage: "linear-gradient(180deg, color-mix(in srgb, var(--on-deep) 26%, transparent), transparent 85%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>orbı
        <OrbiAccent className="absolute text-[color-mix(in_srgb,#1166FF_70%,transparent)]" style={{ width: ".36em", right: "-.06em", top: "-.02em" }} /></span></p>
      <div className="pb-8" />
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-on-deep-muted">{title}</p>
      <ul className="space-y-2">
        {links.map(([label, href]) => <li key={href}><Link href={href} className="hover:underline">{label}</Link></li>)}
      </ul>
    </div>
  );
}
