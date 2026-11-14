"use client";
import { useState } from "react";
import { IDENTITIES, type Identity } from "@/lib/identities";
import { CarArt, MotoArt } from "@/components/VehicleArt";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { api, ErrorNote, Badge } from "@/components/ui";

function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure>
      <figcaption className="mb-2 text-xs font-semibold text-muted">{label}</figcaption>
      <div className="h-[330px] overflow-hidden rounded-[22px] bg-bg shadow-[0_0_0_5px_#14171b]">{children}</div>
    </figure>
  );
}

function HomeMock() {
  return (
    <div className="relative h-full">
      <svg viewBox="0 0 200 180" className="h-[190px] w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="200" height="180" fill="var(--surface-2)" />
        <path d="M0 50h200M0 110h200M50 0v180M130 0v180" stroke="var(--line)" strokeWidth="5" />
        <path d="M50 150 V110 H130 V40" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="150" r="6" fill="var(--accent)" /><circle cx="130" cy="40" r="7" fill="var(--primary)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[18px] bg-surface p-3">
        <p className="display text-lg">Para onde vamos?</p>
        <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-muted">Digite o destino</div>
        <div className="mt-2 flex items-center justify-between text-xs"><span>Essencial</span><span className="num font-semibold">R$ 00,00</span></div>
        <div className="btn btn-primary btn-sm mt-2 w-full">Pedir corrida</div>
      </div>
    </div>
  );
}

function DriverMock() {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center justify-between"><Logo size={13} hole="var(--bg)" /><Badge tone="ok">Online</Badge></div>
      <div className="card mt-3 p-3 text-xs">
        <p className="font-semibold">Nova corrida · 1,2 km até você</p>
        <div className="mt-2 flex justify-between"><span>Bruto</span><span className="num">R$ 00,00</span></div>
        <div className="flex justify-between text-muted"><span>Comissão</span><span className="num">− R$ 00,00</span></div>
        <div className="display mt-1.5 flex justify-between border-t border-line pt-1.5 text-base"><span>Você recebe</span><span className="num text-brand">R$ 00,00</span></div>
        <div className="mt-2 grid grid-cols-2 gap-1.5"><span className="btn btn-soft btn-sm !min-h-8">Recusar</span><span className="btn btn-primary btn-sm !min-h-8">Aceitar</span></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-lg bg-surface-2 p-2"><Icon name="wallet" size={18} className="mx-auto" />Ganhos</div>
        <div className="rounded-lg bg-surface-2 p-2"><Icon name="gift" size={18} className="mx-auto" />Clube</div>
      </div>
    </div>
  );
}

function AdminMock() {
  return (
    <div className="flex h-[150px] overflow-hidden rounded-xl bg-bg shadow-[0_0_0_1px_var(--line)]">
      <div className="flex w-10 flex-col items-center gap-2 bg-deep py-2 text-on-deep"><Icon name="chart" size={15} /><Icon name="users" size={15} /><Icon name="car" size={15} /><Icon name="receipt" size={15} /></div>
      <div className="flex-1 p-2.5">
        <p className="display text-sm">Indicadores</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
          {["Motoristas", "Corridas", "Comissões"].map((l) => <div key={l} className="rounded-md bg-surface p-1.5 shadow-[0_0_0_1px_var(--line)]"><span className="text-muted">{l}</span><p className="num display text-sm">0</p></div>)}
        </div>
        <svg viewBox="0 0 160 36" className="mt-2 h-9 w-full" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 C 30 26, 40 12, 70 16 S 120 6, 160 4" fill="none" stroke="var(--primary)" strokeWidth="2" /></svg>
      </div>
    </div>
  );
}

function Proposal({ id, current, official, onPick, onOfficial, canSetOfficial }: { id: Identity; current: boolean; official: boolean; onPick: () => void; onOfficial: () => void; canSetOfficial: boolean }) {
  return (
    <article data-identity={id.id} className="scope flex flex-col gap-5 rounded-card p-4 shadow-[0_0_0_1px_var(--line)] md:p-5" style={current ? { boxShadow: "0 0 0 3px var(--primary)" } : undefined}>
      <header>
        <div className="flex flex-wrap items-center gap-2"><h2 className="display text-3xl">{id.name}</h2>{official && <Badge tone="brand">Oficial</Badge>}{current && !official && <Badge>Em prévia</Badge>}</div>
        <p className="mt-1.5 text-sm text-muted">{id.concept}</p>
      </header>
      <ul className="grid grid-cols-5 gap-1.5">
        {id.palette.map((c) => (
          <li key={c.hex}><span className="block h-12 rounded-md shadow-[0_0_0_1px_rgb(0_0_0/.1)_inset]" style={{ background: c.hex }} />
            <span className="mt-1 block text-[11px] leading-tight font-semibold">{c.name}</span><span className="block text-[11px] text-muted">{c.hex}</span><span className="block text-[11px] text-muted">{c.role}</span></li>
        ))}
      </ul>
      <dl className="space-y-1.5 text-sm">
        <div><dt className="inline font-semibold">Tipografia: </dt><dd className="inline text-muted">{id.type.display} + {id.type.body}. {id.type.why}</dd></div>
        <div><dt className="inline font-semibold">Fundo: </dt><dd className="inline text-muted">{id.palette.find((p) => p.role === "Fundo")?.name ?? "Branco"}</dd></div>
        <div><dt className="inline font-semibold">Botões: </dt><dd className="inline text-muted">{id.buttons}</dd></div>
        <div><dt className="inline font-semibold">Ícones: </dt><dd className="inline text-muted">{id.icons}</dd></div>
      </dl>
      <div className="flex gap-2 text-ink">{["car", "pin", "wallet", "shield", "star", "route"].map((n) => <Icon key={n} name={n} weight={({ a: "regular", b: "bold", c: "light", d: "duotone" } as const)[id.id]} />)}</div>
      <div className="grid grid-cols-2 gap-3"><Phone label="Tela inicial"><HomeMock /></Phone><Phone label="Painel do motorista"><DriverMock /></Phone></div>
      <figure><figcaption className="mb-2 text-xs font-semibold text-muted">Painel administrativo</figcaption><AdminMock /></figure>
      <figure><figcaption className="mb-2 text-xs font-semibold text-muted">Aplicação da marca</figcaption>
        <div className="grid grid-cols-[3fr_2fr] items-end gap-2"><CarArt /><MotoArt /></div></figure>
      <div className="mt-auto flex flex-col gap-2 pt-1">
        <button type="button" className="btn btn-primary" onClick={onPick} aria-pressed={current}>{current ? "Em uso nesta sessão" : "Ver o site nesta identidade"}</button>
        {canSetOfficial && <button type="button" className="btn btn-ghost" disabled={official} onClick={onOfficial}>{official ? "É a identidade oficial" : "Definir como oficial"}</button>}
      </div>
    </article>
  );
}

export function IdentityBoard({ official, preview, canSetOfficial }: { official: string; preview: string | null; canSetOfficial: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const current = preview ?? official;
  const apply = async (identity: string, isOfficial: boolean) => {
    try {
      await api("/api/public/identity", { body: { identity, official: isOfficial } });
      window.location.reload();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="pt-12 pb-20">
      <div className="mx-auto max-w-[1800px] px-5 md:px-10">
        <h1 className="display max-w-[20ch] text-[clamp(2.4rem,5vw,4.6rem)]">Quatro identidades. Escolha uma.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">Todas usam o mesmo símbolo: o peso do prumo, cuja ponta é também um pino de mapa. Ao escolher, a plataforma inteira muda, inclusive o carro 3D da página inicial.</p>
        {!canSetOfficial && <p className="mt-2 text-sm text-muted">A prévia vale só neste navegador. Para definir a identidade oficial, entre com uma conta de administrador.</p>}
        <ErrorNote>{error}</ErrorNote>
        <div className="mt-10 grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {IDENTITIES.map((id) => (
            <Proposal key={id.id} id={id} current={current === id.id} official={official === id.id} canSetOfficial={canSetOfficial}
              onPick={() => apply(id.id, false)} onOfficial={() => apply(id.id, true)} />
          ))}
        </div>
      </div>
    </div>
  );
}
