"use client";
import { useState } from "react";
import { PageTitle } from "@/components/app/AppShell";
import { api, Badge, dateTime, Empty, ErrorNote, Field, km, Note, Spinner, useAction, useLive } from "@/components/ui";
import { brl } from "@/domain/pricing";

type Finance = {
  balanceCents: number; minWithdrawalCents: number;
  summary: { rides: number; grossCents: number; commissionCents: number; netCents: number; distanceM: number };
  entries: { id: string; description: string; amountCents: number; createdAt: string; type: string }[];
  withdrawals: { id: string; amountCents: number; status: string; createdAt: string; pixKey: string }[];
};
const PERIODS = [["day", "Hoje"], ["week", "Semana"], ["month", "Mês"]] as const;
const W_STATUS: Record<string, [string, "warn" | "ok" | "danger"]> = { requested: ["Solicitado", "warn"], paid: ["Pago", "ok"], rejected: ["Recusado", "danger"] };

export default function Ganhos() {
  const [period, setPeriod] = useState<string>("day");
  const { data, loading, reload } = useLive<Finance>(`/api/driver/finance?period=${period}`);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const { busy, error, run } = useAction();
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const s = data.summary;
  return (
    <>
      <PageTitle sub="O que entrou, o que a Orbi reteve e o que ficou com você.">Seus ganhos</PageTitle>
      <div role="tablist" aria-label="Período" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {PERIODS.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={period === v} onClick={() => setPeriod(v)} className={`rounded-xl py-2 font-semibold transition-colors ${period === v ? "bg-surface shadow-sm" : "text-muted"}`}>{l}</button>)}
      </div>
      <section className="card p-5">
        <dl className="space-y-2">
          <div className="flex justify-between"><dt>Valor bruto</dt><dd className="num font-semibold">{brl(s.grossCents)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Comissão Orbi</dt><dd className="num">− {brl(s.commissionCents)}</dd></div>
          <div className="display flex justify-between border-t border-line pt-3 text-3xl"><dt>Você recebeu</dt><dd className="num text-brand">{brl(s.netCents)}</dd></div>
        </dl>
        <p className="num mt-3 text-sm text-muted">{s.rides} corrida{s.rides === 1 ? "" : "s"} · {km(s.distanceM)}</p>
      </section>

      <section className="card mt-4 p-5">
        <div className="flex items-baseline justify-between"><h2 className="display text-xl">Saldo</h2><p className={`display num text-3xl ${data.balanceCents < 0 ? "text-danger" : ""}`} data-testid="balance">{brl(data.balanceCents)}</p></div>
        {data.balanceCents < 0 && <div className="mt-2"><Note tone="warn">Saldo negativo vem da parte da Orbi nas corridas em dinheiro. As próximas corridas digitais abatem esse valor.</Note></div>}
        <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
          await api("/api/driver/withdrawals", { body: { amountCents: Math.round(Number(amount.replace(",", ".")) * 100), pixKey } });
          setAmount(""); reload();
        }); }}>
          <Field label="Valor do saque"><input className="input" inputMode="decimal" required placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Chave Pix"><input className="input" required value={pixKey} onChange={(e) => setPixKey(e.target.value)} /></Field>
          <button className="btn btn-primary" disabled={busy}>Solicitar saque</button>
        </form>
        <p className="mt-2 text-xs text-muted">Mínimo de {brl(data.minWithdrawalCents)}. O pedido passa pela equipe financeira, e a transferência é feita fora do aplicativo até a integração com o provedor de pagamentos.</p>
        <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>
        {data.withdrawals.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {data.withdrawals.map((w) => <li key={w.id} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{dateTime(w.createdAt)}</span><span className="num font-semibold">{brl(w.amountCents)}</span><Badge tone={W_STATUS[w.status][1]}>{W_STATUS[w.status][0]}</Badge></li>)}
          </ul>
        )}
      </section>

      <h2 className="display mt-8 mb-3 text-2xl">Extrato</h2>
      {!data.entries.length ? <Empty icon="receipt" title="Nenhum lançamento ainda">Cada corrida concluída aparece aqui com bruto, comissão e líquido.</Empty> : (
        <ul className="card divide-y divide-line">
          {data.entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 p-4">
              <span><span className="block text-sm font-medium">{e.description}</span><span className="text-xs text-muted">{dateTime(e.createdAt)}</span></span>
              <span className={`num font-semibold whitespace-nowrap ${e.amountCents < 0 ? "text-danger" : "text-ok"}`}>{e.amountCents > 0 ? "+" : ""}{brl(e.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
