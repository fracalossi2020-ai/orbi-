"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { api, dateTime, ThemeToggle, useLive } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: string };

function Notifications() {
  const { data, reload } = useLive<{ notifications: { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }[] }>("/api/account/notifications");
  const [open, setOpen] = useState(false);
  const unread = data?.notifications.filter((n) => !n.readAt).length ?? 0;
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) { await api("/api/account/notifications", { body: {} }); reload(); }
  };
  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={unread ? `Notificações, ${unread} nova${unread > 1 ? "s" : ""}` : "Notificações"} className="relative grid size-11 place-items-center rounded-full hover:bg-surface-2">
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-primary" />}
      </button>
      {open && (
        <div className="card anim-rise absolute top-12 right-0 z-[60] max-h-[70svh] w-[min(340px,calc(100vw-2rem))] overflow-auto p-2">
          {!data?.notifications.length && <p className="p-4 text-sm text-muted">Nenhuma notificação por aqui.</p>}
          {data?.notifications.map((n) => (
            <div key={n.id} className="rounded-xl p-3 hover:bg-surface-2">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-muted">{n.body}</p>
              <p className="mt-1 text-xs text-muted">{dateTime(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Faixa de "sem internet": no 4G o sinal cai em túneis e áreas sem cobertura. O app se recupera sozinho quando volta. */
function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    on();
    addEventListener("online", on);
    addEventListener("offline", on);
    return () => { removeEventListener("online", on); removeEventListener("offline", on); };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-14 z-40 flex items-center justify-center gap-2 bg-[var(--warn)] px-4 py-2 text-center text-sm font-semibold text-white md:top-16">
      <span className="size-2 animate-pulse rounded-full bg-white" />Sem internet. Assim que o sinal voltar, o app atualiza sozinho.
    </div>
  );
}

/** Estrutura dos aplicativos: barra inferior no celular, lateral no computador. */
/** topNav: no computador, barra escura com menu em pílulas no lugar da lateral (passageiro). No celular nada muda. */
export function AppShell({ nav, title, children, flush, topNav = false }: { nav: NavItem[]; title: string; children: React.ReactNode; flush?: boolean; topNav?: boolean }) {
  const path = usePathname();
  const root = nav[0].href;
  const isActive = (href: string) => (href === root ? path === root : path.startsWith(href));
  const logout = async () => { await api("/api/auth/logout", { body: {} }); window.location.href = "/entrar"; };
  return (
    <div className={`flex min-h-svh flex-col bg-bg ${topNav ? "" : "md:flex-row"}`}>
      <aside className={`sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-line bg-surface p-4 ${topNav ? "" : "md:flex"}`}>
        <Link href="/" className="mb-6 px-2" aria-label="Orbi, tela inicial"><Logo size={22} hole="var(--surface)" /></Link>
        <nav aria-label={title} className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors ${isActive(n.href) ? "bg-surface-2 text-brand" : "hover:bg-surface-2"}`}>
              <Icon name={n.icon} size={20} weight={isActive(n.href) ? "fill" : "regular"} />{n.label}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted hover:bg-surface-2"><Icon name="logout" size={20} /> Sair</button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`glass sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line px-3 ${topNav ? "md:h-16 md:border-transparent md:bg-deep md:px-8 md:text-on-deep" : "md:justify-end"}`}>
          <Link href="/" className="px-1 md:hidden" aria-label="Orbi, tela inicial"><Logo size={20} hole="var(--surface)" /></Link>
          {topNav && (
            <div className="hidden min-w-0 flex-1 items-center gap-6 md:flex">
              <Link href="/" aria-label="Orbi, tela inicial"><Logo size={22} hole="var(--deep)" /></Link>
              <nav aria-label={title} className="flex items-center gap-1">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}
                    className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${isActive(n.href) ? "bg-on-deep text-deep" : "hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)]"}`}>{n.label}</Link>
                ))}
              </nav>
            </div>
          )}
          <div className="flex items-center"><ThemeToggle /><Notifications />
            {topNav && <button type="button" onClick={logout} className="ml-1 hidden rounded-full px-3.5 py-2 text-sm font-semibold hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] md:block">Sair</button>}
            {/* Passageiro e motorista saem pela tela Conta; a equipe não tem essa tela. */}
            {!nav.some((n) => n.href.endsWith("/conta")) && <button type="button" onClick={logout} aria-label="Sair" className="grid size-11 place-items-center rounded-full hover:bg-surface-2 md:hidden"><Icon name="logout" size={20} /></button>}
          </div>
        </header>
        <OfflineBanner />
        <main className={`flex-1 ${flush ? "" : "mx-auto w-full max-w-4xl p-4 pb-24 md:p-8"}`}>{children}</main>
      </div>

      <nav aria-label={title} className="glass fixed inset-x-0 bottom-0 z-40 flex border-t border-line px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((n) => {
          const on = isActive(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
              className={`flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-tight font-semibold ${on ? "text-ink" : "text-muted"}`}>
              <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${on ? "bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] text-brand" : ""}`}>
                <Icon name={n.icon} size={22} weight={on ? "fill" : "regular"} />
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return <div className="mb-7"><h1 className="display text-3xl md:text-[2.75rem]">{children}</h1>{sub && <p className="mt-2 max-w-2xl text-muted">{sub}</p>}</div>;
}
