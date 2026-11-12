"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { api, ThemeToggle } from "@/components/ui";
import { can, type Resource, type Role } from "@/domain/permissions";
import { MfaSetup } from "@/components/app/SecurityPanel";

export const ADMIN_NAV: { href: string; label: string; icon: string; res: Resource; group: string }[] = [
  { href: "/admin", label: "Indicadores", icon: "chart", res: "dashboard", group: "Operação" },
  { href: "/admin/motoristas", label: "Motoristas", icon: "car", res: "drivers", group: "Operação" },
  { href: "/admin/veiculos", label: "Veículos", icon: "shield", res: "vehicles", group: "Operação" },
  { href: "/admin/usuarios", label: "Usuários", icon: "users", res: "users", group: "Operação" },
  { href: "/admin/viagens", label: "Viagens", icon: "route", res: "rides", group: "Operação" },
  { href: "/admin/chamados", label: "Chamados", icon: "help", res: "tickets", group: "Operação" },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: "wallet", res: "payments", group: "Financeiro" },
  { href: "/admin/relatorios", label: "Relatórios", icon: "receipt", res: "reports", group: "Financeiro" },
  { href: "/admin/tarifas", label: "Tarifas e comissão", icon: "scale", res: "tariffs", group: "Financeiro" },
  { href: "/admin/planos", label: "Planos", icon: "layers", res: "plans", group: "Financeiro" },
  { href: "/admin/cupons", label: "Cupons", icon: "ticket", res: "coupons", group: "Crescimento" },
  { href: "/admin/campanhas", label: "Campanhas", icon: "megaphone", res: "campaigns", group: "Crescimento" },
  { href: "/admin/parceiros", label: "Parceiros", icon: "store", res: "partners", group: "Crescimento" },
  { href: "/admin/interessados", label: "Interessados", icon: "doc", res: "leads", group: "Crescimento" },
  { href: "/admin/regioes", label: "Regiões", icon: "map", res: "regions", group: "Plataforma" },
  { href: "/admin/modalidades", label: "Modalidades", icon: "moto", res: "modalities", group: "Plataforma" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "settings", res: "settings", group: "Plataforma" },
  { href: "/admin/equipe", label: "Equipe", icon: "lock", res: "staff", group: "Plataforma" },
  { href: "/admin/atividades", label: "Histórico", icon: "history", res: "audit", group: "Plataforma" },
];
const GROUPS = ["Operação", "Financeiro", "Crescimento", "Plataforma"];

const RoleCtx = createContext<Role>("atendente");
export const useRole = () => useContext(RoleCtx);
const ROLE_LABEL: Record<string, string> = { admin: "Administrador", gestor: "Gestor", atendente: "Atendente" };

export function AdminShell({ role, mfaReady = true, children }: { role: Role; mfaReady?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = ADMIN_NAV.filter((n) => can(role, n.res, "read"));
  const logout = async () => { await api("/api/auth/logout", { body: {} }); window.location.href = "/entrar"; };
  const nav = (
    <nav aria-label="Administração" className="space-y-5">
      {GROUPS.map((g) => {
        const list = items.filter((n) => n.group === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-on-deep-muted">{g}</p>
            {list.map((n) => {
              const on = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
              return <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${on ? "bg-[color-mix(in_srgb,var(--on-deep)_16%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)]"}`}><Icon name={n.icon} size={18} weight={on ? "fill" : "regular"} />{n.label}</Link>;
            })}
          </div>
        );
      })}
    </nav>
  );
  return (
    <RoleCtx.Provider value={role}>
      <div className="min-h-svh bg-bg lg:grid lg:grid-cols-[250px_1fr]">
        <aside className="on-deep sticky top-0 hidden h-svh overflow-auto bg-deep p-4 text-on-deep lg:block">
          <Link href="/admin" className="mb-6 block px-2"><Logo size={22} /></Link>
          {nav}
        </aside>
        <div className="min-w-0">
          <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line px-3 md:px-6">
            <button type="button" className="grid size-11 place-items-center lg:hidden" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? "close" : "menu"} /></button>
            <Link href="/admin" className="mr-auto ml-1 lg:hidden" aria-label="Orbi, painel"><Logo size={20} hole="var(--surface)" /></Link>
            <span className="hidden text-sm text-muted lg:block">Perfil: <strong className="text-ink">{ROLE_LABEL[role]}</strong></span>
            <div className="flex items-center"><ThemeToggle /><Link href="/admin/seguranca" aria-label="Minha segurança" title="Minha segurança" className="grid size-11 place-items-center rounded-full hover:bg-surface-2"><Icon name="lock" size={20} /></Link><button type="button" onClick={logout} aria-label="Sair" className="grid size-11 place-items-center rounded-full hover:bg-surface-2"><Icon name="logout" size={20} /></button></div>
          </header>
          {open && <div className="on-deep anim-sheet bg-deep p-4 text-on-deep lg:hidden">{nav}</div>}
          <main className="mx-auto max-w-7xl p-4 md:p-8">
            {mfaReady ? children : (
              <div className="mx-auto max-w-2xl space-y-4">
                <h1 className="display text-3xl">Proteja o painel</h1>
                <p className="text-muted">O painel mostra dados de passageiros e motoristas. Para usar, ative a verificação em duas etapas: além da senha, a entrada vai pedir um código do seu celular.</p>
                <MfaSetup onEnabled={() => window.location.reload()} />
              </div>
            )}
          </main>
        </div>
      </div>
    </RoleCtx.Provider>
  );
}
