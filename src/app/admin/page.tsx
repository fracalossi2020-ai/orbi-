"use client";
import Link from "next/link";
import { PageTitle } from "@/components/app/AppShell";
import { Note, Spinner, useLive } from "@/components/ui";
import { brl } from "@/domain/pricing";

type Dash = {
  drivers: number; driversOnline: number; passengers: number; ridesCompleted: number; ridesCancelled: number; pendingDrivers: number; openTickets: number; pendingWithdrawals: number;
  grossCents: number; commissionCents: number; feesCents: number; discountsCents: number; tariffsUnreviewed: number; daily: { day: string; rides: number; gross: number }[];
};

function Tile({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = <><p className="text-sm text-muted">{label}</p><p className="display num mt-1 text-3xl" data-testid={`tile-${label}`}>{value}</p></>;
  return href ? <Link href={href} className="card block p-4 transition-shadow hover:shadow-[0_0_0_2px_var(--primary)]">{body}</Link> : <div className="card p-4">{body}</div>;
}

function Chart({ daily }: { daily: Dash["daily"] }) {
  if (!daily.length) return <p className="py-10 text-center text-sm text-muted">O gráfico aparece depois das primeiras corridas concluídas.</p>;
  const max = Math.max(...daily.map((d) => d.gross), 1);
  return (
    <ol className="flex h-44 items-end gap-1.5" aria-label="Faturamento bruto por dia nos últimos 14 dias">
      {daily.map((d) => (
        <li key={d.day} className="flex h-full max-w-14 flex-1 flex-col justify-end" title={`${d.day}: ${brl(d.gross)} em ${d.rides} corrida(s)`}>
          <span className="block rounded-t-md bg-primary" style={{ height: `${Math.max(4, (d.gross / max) * 100)}%` }} />
          <span className="num mt-1 text-center text-[10px] text-muted">{d.day.slice(8)}</span>
          <span className="sr-only">{d.day}: {brl(d.gross)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Dashboard() {
  const { data, loading } = useLive<Dash>("/api/admin/dashboard");
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  return (
    <>
      <PageTitle sub="Números reais da plataforma, atualizados em tempo real.">Indicadores</PageTitle>
      {data.tariffsUnreviewed > 0 && <div className="mb-4"><Note tone="warn">{data.tariffsUnreviewed} tarifa{data.tariffsUnreviewed > 1 ? "s" : ""} com valores iniciais. <Link className="font-semibold underline" href="/admin/tarifas">Revise antes de operar.</Link></Note></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Motoristas" value={data.drivers} href="/admin/motoristas" />
        <Tile label="Motoristas online" value={data.driversOnline} />
        <Tile label="Passageiros" value={data.passengers} href="/admin/usuarios" />
        <Tile label="Aguardando aprovação" value={data.pendingDrivers} href="/admin/motoristas" />
        <Tile label="Corridas realizadas" value={data.ridesCompleted} href="/admin/viagens" />
        <Tile label="Corridas canceladas" value={data.ridesCancelled} href="/admin/viagens" />
        <Tile label="Chamados abertos" value={data.openTickets} href="/admin/chamados" />
        <Tile label="Saques pendentes" value={data.pendingWithdrawals} href="/admin/pagamentos" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Tile label="Faturamento bruto" value={brl(data.grossCents)} />
        <Tile label="Comissões" value={brl(data.commissionCents)} />
        <Tile label="Taxas de serviço" value={brl(data.feesCents)} />
        <Tile label="Descontos concedidos" value={brl(data.discountsCents)} />
      </div>
      <section className="card mt-4 p-5"><h2 className="display mb-4 text-xl">Faturamento bruto, últimos 14 dias</h2><Chart daily={data.daily} /></section>
    </>
  );
}
