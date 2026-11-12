"use client";
import { useState } from "react";
import { PageTitle } from "@/components/app/AppShell";
import { Icon } from "@/components/Icon";
import { api, Badge, dateTime, Empty, ErrorNote, Field, Note, pct, Spinner, useAction, useLive } from "@/components/ui";
import { brl } from "@/domain/pricing";

type Partner = { id: string; name: string; category: string; city: string; address: string; phone: string; benefit: string };
type Club = {
  partners: Partner[]; plans: { id: string; name: string; description: string; priceCents: number; periodDays: number; commissionBps: number }[];
  campaigns: { id: string; name: string; description: string; kind: string; bonusPerRideCents: number }[];
  savings: { id: string; partnerName: string; originalCents: number; paidCents: number; createdAt: string }[]; totalSavedCents: number;
};
const parse = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);

export default function ClubePage() {
  const { data, loading, reload } = useLive<Club>("/api/driver/club", { live: false });
  const [f, setF] = useState({ partnerId: "", original: "", paid: "" });
  const { busy, error, run } = useAction();
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  return (
    <>
      <PageTitle sub="Condições especiais com parceiros, para quem movimenta a cidade.">Clube Orbi</PageTitle>

      <section className="on-deep rounded-card bg-deep p-6 text-on-deep">
        <p className="text-sm text-on-deep-muted">Minha Economia</p>
        <p className="display num mt-1 text-5xl" data-testid="saved">{brl(data.totalSavedCents)}</p>
        <p className="mt-1 text-sm text-on-deep-muted">{data.savings.length ? "É o que você deixou de gastar usando parceiros." : "Registre o uso de um parceiro para começar a somar."}</p>
      </section>

      {data.campaigns.length > 0 && (
        <section className="mt-6">
          <h2 className="display mb-3 text-2xl">Oportunidades</h2>
          <ul className="space-y-2">
            {data.campaigns.map((c) => <li key={c.id} className="card p-4"><p className="font-semibold">{c.name}{c.bonusPerRideCents > 0 && <Badge tone="brand"> + {brl(c.bonusPerRideCents)} por corrida</Badge>}</p><p className="text-sm text-muted">{c.description}</p></li>)}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="display mb-3 text-2xl">Parceiros</h2>
        {!data.partners.length ? <Empty icon="store" title="As primeiras parcerias estão a caminho">A Orbi está negociando com oficinas, borracharias e lojas do Vale do Aço. Os parceiros confirmados aparecem aqui.</Empty> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.partners.map((p) => (
              <li key={p.id} className="card p-4"><Badge>{p.category}</Badge><p className="display mt-2 text-xl">{p.name}</p><p className="mt-1 text-sm font-medium text-brand">{p.benefit}</p>
                <p className="mt-2 text-sm text-muted">{[p.address, p.city].filter(Boolean).join(", ")}</p>{p.phone && <a className="text-sm underline" href={`tel:${p.phone}`}>{p.phone}</a>}</li>
            ))}
          </ul>
        )}
      </section>

      {data.partners.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="display mb-1 text-xl">Registrar economia</h2>
          <p className="mb-3 text-sm text-muted">Informe o preço normal e quanto você pagou. Os valores são declarados por você.</p>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
            await api("/api/driver/savings", { body: { partnerId: f.partnerId, originalCents: parse(f.original), paidCents: parse(f.paid) } });
            setF({ partnerId: "", original: "", paid: "" }); reload();
          }); }}>
            <Field label="Parceiro"><select className="input" required value={f.partnerId} onChange={(e) => setF({ ...f, partnerId: e.target.value })}><option value="">Escolha</option>{data.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Preço normal"><input className="input" inputMode="decimal" required value={f.original} onChange={(e) => setF({ ...f, original: e.target.value })} /></Field>
            <Field label="Valor pago"><input className="input" inputMode="decimal" required value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} /></Field>
            <button className="btn btn-primary sm:col-span-3" disabled={busy}>Registrar</button>
          </form>
          <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>
          {data.savings.length > 0 && <ul className="mt-4 divide-y divide-line text-sm">{data.savings.map((s) => <li key={s.id} className="flex justify-between py-2"><span>{s.partnerName} · {dateTime(s.createdAt)}</span><span className="num font-semibold text-ok">{brl(s.originalCents - s.paidCents)}</span></li>)}</ul>}
        </section>
      )}

      <section className="mt-6">
        <h2 className="display mb-3 text-2xl">Planos de assinatura</h2>
        {!data.plans.length ? <Note>Nenhum plano disponível no momento. A comissão padrão da sua cidade continua valendo.</Note> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.plans.map((p) => (
              <li key={p.id} className="card p-4"><p className="display text-xl">{p.name}</p><p className="text-sm text-muted">{p.description}</p>
                <p className="num mt-2 text-sm">{brl(p.priceCents)} a cada {p.periodDays} dias · comissão de {pct(p.commissionBps)}</p>
                <button type="button" className="btn btn-soft btn-sm mt-3" disabled={busy} onClick={() => run(async () => { await api("/api/driver/plan", { body: { planId: p.id } }); reload(); })}><Icon name="check" size={16} /> Assinar com meu saldo</button></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
