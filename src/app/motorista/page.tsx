"use client";
import { MapView } from "@/components/LazyMap";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/app/AppShell";
import { RideChat, type Message } from "@/components/app/RideChat";
import { api, Badge, ErrorNote, Field, km, METHOD_LABEL, mins, Note, pct, Spinner, Stars, useAction, useLive } from "@/components/ui";
import { brl } from "@/domain/pricing";
import { isDirect, METHOD_INFO, type PaymentMethod } from "@/domain/payment-methods";
import { CNH_CATEGORIES, DOC_INFO, type DriverRules } from "@/domain/driver-rules";
import { permissionHelp, useDriverGps } from "@/components/app/useDriverGps";


type Place = { label: string; lat: number; lng: number };
type Offer = {
  id: string; expiresAt: string; pickupDistanceM: number; pickupEtaS: number; origin: Place; dest: Place; stops: Place[]; geometry: [number, number][]; distanceM: number; durationS: number; paymentMethod: string;
  grossCents: number; commissionBps: number; commissionCents: number; driverNetCents: number; totalCents: number;
};
type Ride = {
  id: string; status: string; statusLabel: string; origin: Place; dest: Place; stops: Place[]; geometry: [number, number][]; distanceM: number; paymentMethod: string; totalCents: number; grossCents: number; commissionBps: number; commissionCents: number; driverNetCents: number;
  passenger: { name: string; rating: number | null; ratingCount: number }; messages: Message[]; myRating: number | null; paymentStatus: string;
  rider: { name: string; phone: string | null } | null;
};
type State = {
  driver: { status: string; online: boolean; reviewNote: string | null; lat: number | null; lng: number | null; pixKey: string | null; cardMachine: boolean } | null;
  paymentRules: { cash: boolean; pix_driver: boolean; card_machine: boolean };
  driverRules: DriverRules; termsVersion: string;
  docs: { id: string; kind: string; status: string; reviewNote: string | null }[]; vehicles: { id: string; categoryId: string; make: string; model: string; plate: string; status: string }[];
  categories: { id: string; name: string; description: string; modalityId: string }[]; regions: { id: string; name: string }[];
  offer: Offer | null; ride: Ride | null; balanceCents: number; manualLocationAllowed: boolean; rating: number | null; ratingCount: number;
};

/** Ajuda curta ao lado de uma pergunta do cadastro. */
function Help({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-xs text-muted">{children}</span>;
}
const STATUS: Record<string, [string, "warn" | "ok" | "danger"]> = { pending: ["Em análise", "warn"], approved: ["Aprovado", "ok"], rejected: ["Recusado", "danger"] };

function Onboarding({ state, reload }: { state: State; reload: () => void }) {
  const rules = state.driverRules;
  const DOCS_BASE = rules.requiredDocs.map((kind) => ({ kind, ...DOC_INFO[kind] }));
  const [f, setF] = useState({ cpf: "", cnh: "", regionId: state.regions[0]?.id ?? "", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" });
  const [reg, setReg] = useState({ birthDate: "", cnhCategory: "B", cnhFirstLicenseAt: "", cnhExpiresAt: "", cnhEar: false, inss: false, acceptTerms: false });
  // null: CEP ainda não consultado; "official": veio da base; "manual": serviço fora do ar.
  const [cepSource, setCepSource] = useState<null | "official" | "manual">(null);
  const [cepError, setCepError] = useState<string | null>(null);
  const [officialStreet, setOfficialStreet] = useState(false);
  const changeCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    setF((p) => ({ ...p, cep: digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits }));
    setCepSource(null);
    setCepError(null);
    if (digits.length !== 8) return;
    try {
      const r = await api<{ unavailable?: boolean; address?: { street: string; district: string; city: string; state: string } }>(`/api/geo/cep?cep=${digits}`);
      if (r.address) {
        setF((p) => ({ ...p, street: r.address!.street, district: r.address!.district, city: r.address!.city, state: r.address!.state }));
        setOfficialStreet(Boolean(r.address.street));
        setCepSource("official");
      } else {
        setOfficialStreet(false);
        setCepSource("manual");
      }
    } catch (e) { setCepError((e as Error).message); }
  };
  const [v, setV] = useState({ categoryId: state.categories.find((c) => c.modalityId === "corrida-carro")?.id ?? "", make: "", model: "", color: "", plate: "", year: "", doors: "4", seats: "5", airConditioning: true, ownership: "proprio", noRedPlate: false, motoGear: false });
  const oldestYear = new Date().getFullYear() - rules.maxVehicleAge;
  // Moto (mototáxi): aparece como categoria quando o administrador liga a modalidade; tem campos e documentos próprios.
  const isMoto = (categoryId: string) => state.categories.find((c) => c.id === categoryId)?.modalityId === "corrida-moto";
  const motoChosen = state.vehicles.length ? state.vehicles.some((x) => isMoto(x.categoryId)) : isMoto(v.categoryId);
  const vehicleCats = state.categories.filter((c) => c.modalityId === "corrida-carro" || c.modalityId === "corrida-moto");
  const oldestMoto = new Date().getFullYear() - rules.maxMotoAge;
  const { busy, error, run } = useAction();
  const latest = (kind: string) => state.docs.find((d) => d.kind === kind);
  const upload = (kind: string, file: File) => run(async () => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    const res = await fetch("/api/driver/documents", { method: "POST", body: form });
    if (!res.ok) throw new Error((await res.json()).error);
    reload();
  });

  if (!state.driver) {
    return (
      <>
        <PageTitle sub="Passo 1 de 3. Seus dados ficam protegidos e só a equipe de análise tem acesso.">Vamos fazer seu cadastro</PageTitle>
        <div className="mb-4"><Note tone="ok">Para dirigir pela Orbi: {rules.minAge} anos ou mais, CNH definitiva categoria B ou superior com a observação EAR{rules.minLicenseYears ? `, ${rules.minLicenseYears} ${rules.minLicenseYears === 1 ? "ano" : "anos"} de habilitação` : ""}, certidão de antecedentes criminais, inscrição no INSS e carro de {oldestYear} ou mais novo. <a className="font-semibold underline" href="/motoristas/requisitos" target="_blank" rel="noreferrer">Ver todos os requisitos</a></Note></div>
        <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/driver/onboarding", { body: { ...f, ...reg } }); reload(); }); }}>
          <h2 className="display text-xl">Seus dados</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF"><input className="input num" name="cpf" inputMode="numeric" required maxLength={14} value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></Field>
            <Field label="Data de nascimento"><input className="input num" name="birthDate" type="date" required value={reg.birthDate} onChange={(e) => setReg({ ...reg, birthDate: e.target.value })} /></Field>
          </div>
          <h2 className="display pt-2 text-xl">Sua CNH</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número da CNH"><input className="input" name="cnh" inputMode="numeric" required value={f.cnh} onChange={(e) => setF({ ...f, cnh: e.target.value })} /></Field>
            <Field label="Categoria"><select className="input" name="cnhCategory" value={reg.cnhCategory} onChange={(e) => setReg({ ...reg, cnhCategory: e.target.value })}>{CNH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Primeira habilitação"><input className="input num" name="cnhFirstLicenseAt" type="date" required value={reg.cnhFirstLicenseAt} onChange={(e) => setReg({ ...reg, cnhFirstLicenseAt: e.target.value })} /></Field>
            <Field label="Validade da CNH"><input className="input num" name="cnhExpiresAt" type="date" required value={reg.cnhExpiresAt} onChange={(e) => setReg({ ...reg, cnhExpiresAt: e.target.value })} /></Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <input type="checkbox" name="cnhEar" className="mt-0.5 size-5 accent-[var(--primary)]" checked={reg.cnhEar} onChange={(e) => setReg({ ...reg, cnhEar: e.target.checked })} />
            <span><strong>Minha CNH é definitiva e tem a observação &quot;Exerce Atividade Remunerada&quot; (EAR).</strong>
              <Help>Obrigatória por lei para transporte por aplicativo. Sem ela, peça a inclusão no Detran-MG (exame psicológico e taxa). Permissão Para Dirigir (provisória) não é aceita.</Help></span>
          </label>
          <h2 className="display pt-2 text-xl">Endereço</h2>
          <Field label="CEP"><input className="input num" name="cep" inputMode="numeric" autoComplete="postal-code" required value={f.cep} onChange={(e) => changeCep(e.target.value)} /></Field>
          {cepError && <ErrorNote>{cepError}</ErrorNote>}
          {cepSource === "manual" && <Note tone="warn">Não foi possível consultar o CEP agora. Preencha o endereço: a equipe vai conferir.</Note>}
          {cepSource && (
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label="Rua"><input className="input" name="street" autoComplete="address-line1" required readOnly={officialStreet} value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} /></Field>
              <Field label="Número"><input className="input" name="number" required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
              <div className="col-span-2"><Field label="Complemento (opcional)"><input className="input" name="complement" value={f.complement} onChange={(e) => setF({ ...f, complement: e.target.value })} /></Field></div>
              <div className="col-span-2"><Field label="Bairro"><input className="input" name="district" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} /></Field></div>
              <Field label="Cidade"><input className="input" name="city" required readOnly={cepSource === "official"} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
              <Field label="Estado"><input className="input" name="state" required maxLength={2} readOnly={cepSource === "official"} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} /></Field>
            </div>
          )}
          <Field label="Cidade onde vai rodar">
            <select className="input" name="regionId" value={f.regionId} onChange={(e) => setF({ ...f, regionId: e.target.value })}>{state.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          </Field>
          <h2 className="display pt-2 text-xl">Regularização</h2>
          <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <input type="checkbox" name="inss" className="mt-0.5 size-5 accent-[var(--primary)]" checked={reg.inss} onChange={(e) => setReg({ ...reg, inss: e.target.checked })} />
            <span><strong>Sou inscrito no INSS como contribuinte individual (pode ser como MEI).</strong>
              <Help>Exigência da Lei 13.640/2018. Dá direito a aposentadoria e auxílio-doença. O MEI de motorista de aplicativo é aberto de graça no portal gov.br.</Help></span>
          </label>
          <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <input type="checkbox" name="acceptTerms" className="mt-0.5 size-5 accent-[var(--primary)]" checked={reg.acceptTerms} onChange={(e) => setReg({ ...reg, acceptTerms: e.target.checked })} />
            <span><strong>Li e aceito o <a className="underline" href="/termos-motorista" target="_blank" rel="noreferrer">Termo de adesão do motorista parceiro</a>.</strong>
              <Help>Versão de {state.termsVersion.split("-").reverse().join("/")}.Explica a relação sem vínculo de emprego, a comissão, as regras de conduta e de segurança e como seus dados são usados.</Help></span>
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Enviando…" : "Continuar"}</button>
          {!cepSource && <p className="text-center text-xs text-muted">Digite o CEP para preencher o endereço.</p>}
        </form>
      </>
    );
  }
  const DOCS = motoChosen && !rules.requiredDocs.includes("curso_mototaxi") ? [...DOCS_BASE, { kind: "curso_mototaxi" as const, ...DOC_INFO.curso_mototaxi }] : DOCS_BASE;
  const missing = [...DOCS.filter((d) => !latest(d.kind) || latest(d.kind)?.status === "rejected").map((d) => d.label), ...(state.vehicles.length ? [] : ["Dados do veículo"])];
  const incomplete = state.driver.status === "pending" && missing.length > 0;
  return (
    <>
      <PageTitle sub={state.driver.status === "rejected" ? "Seu cadastro não foi aprovado. Veja o motivo abaixo e envie de novo o que faltou." : incomplete ? `Falta enviar: ${missing.join(", ")}.` : "Assim que os documentos e o veículo forem aprovados, você pode ficar online."}>
        {state.driver.status === "rejected" ? "Cadastro não aprovado" : state.driver.status === "suspended" ? "Cadastro suspenso" : incomplete ? "Complete seu cadastro" : "Cadastro em análise"}
      </PageTitle>
      {state.driver.reviewNote && <div className="mb-4"><Note tone="warn">{state.driver.reviewNote}</Note></div>}
      <section className="card p-5">
        <h2 className="display mb-3 text-xl">Documentos</h2>
        <ul className="space-y-3">
          {DOCS.map((d) => {
            const doc = latest(d.kind);
            return (
              <li key={d.kind} className="flex flex-wrap items-center gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
                <span className="min-w-0 flex-1"><span className="block font-semibold">{d.label}</span><span className="block text-xs text-muted">{doc?.reviewNote ?? d.hint}</span></span>
                {doc && <Badge tone={STATUS[doc.status][1]}>{STATUS[doc.status][0]}</Badge>}
                {doc?.status !== "approved" && (
                  <label className="btn btn-soft btn-sm cursor-pointer">{doc ? "Enviar de novo" : "Enviar"}
                    <input type="file" data-doc={d.kind} className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => e.target.files?.[0] && upload(d.kind, e.target.files[0])} />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card mt-4 p-5">
        <h2 className="display mb-3 text-xl">Veículo</h2>
        {state.vehicles.map((x) => (
          <p key={x.id} className="mb-2 flex items-center justify-between gap-2"><span>{x.make} {x.model} · <span className="num font-semibold">{x.plate}</span></span><Badge tone={STATUS[x.status][1]}>{STATUS[x.status][0]}</Badge></p>
        ))}
        {!state.vehicles.length && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/driver/vehicle", { body: { ...v, year: Number(v.year) || undefined, doors: motoChosen ? 0 : Number(v.doors), seats: motoChosen ? 1 : Number(v.seats) } }); reload(); }); }}>
            <p className="text-sm text-muted sm:col-span-2">{motoChosen
              ? `Moto (mototáxi): de ${oldestMoto} ou mais nova, CNH categoria A há pelo menos ${rules.motoMinLicenseYears} anos, curso de mototaxista e os equipamentos de segurança da lei.`
              : `Aceitamos carros de ${oldestYear} ou mais novos, com pelo menos ${rules.minDoors} portas e ${rules.minSeats} lugares${rules.requireAirConditioning ? " e ar-condicionado funcionando" : ""}. Placa vermelha e carro adesivado não são aceitos.`}</p>
            <Field label="Categoria"><select className="input" name="categoryId" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>{vehicleCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Marca"><input className="input" name="make" required value={v.make} onChange={(e) => setV({ ...v, make: e.target.value })} /></Field>
            <Field label="Modelo"><input className="input" name="model" required value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} /></Field>
            <Field label="Cor"><input className="input" name="color" required value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} /></Field>
            <Field label="Placa"><input className="input" name="plate" required placeholder="ABC1D23" value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value })} /></Field>
            <Field label="Ano"><input className="input" name="year" inputMode="numeric" required value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} /></Field>
            {!motoChosen && <><Field label="Portas"><select className="input" name="doors" value={v.doors} onChange={(e) => setV({ ...v, doors: e.target.value })}>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="Lugares (com o motorista)"><select className="input" name="seats" value={v.seats} onChange={(e) => setV({ ...v, seats: e.target.value })}>{[2, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field></>}
            <Field label={motoChosen ? "De quem é a moto" : "De quem é o carro"}><select className="input" name="ownership" value={v.ownership} onChange={(e) => setV({ ...v, ownership: e.target.value })}>
              <option value="proprio">Meu</option><option value="financiado">Meu, financiado</option><option value="familiar">De alguém da família</option><option value="alugado">Alugado</option>
            </select></Field>
            {!motoChosen && <label className="flex items-center gap-3 self-end py-3 text-sm font-semibold"><input type="checkbox" name="airConditioning" className="size-5 accent-[var(--primary)]" checked={v.airConditioning} onChange={(e) => setV({ ...v, airConditioning: e.target.checked })} />Tem ar-condicionado funcionando</label>}
            {motoChosen
              ? <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm sm:col-span-2"><input type="checkbox" name="motoGear" className="mt-0.5 size-5 accent-[var(--primary)]" checked={v.motoGear} onChange={(e) => setV({ ...v, motoGear: e.target.checked })} />
                  <span><strong>A moto tem protetor de motor e aparador de linha, e eu uso colete e capacete com faixas refletivas.</strong><Help>Equipamentos obrigatórios para mototáxi (Lei 12.009/2009 e Resolução Contran 356/2010). Leve um capacete extra para o passageiro.</Help></span></label>
              : <label className="flex items-start gap-3 text-sm sm:col-span-2"><input type="checkbox" name="noRedPlate" className="mt-0.5 size-5 accent-[var(--primary)]" checked={v.noRedPlate} onChange={(e) => setV({ ...v, noRedPlate: e.target.checked })} />O carro não tem placa vermelha nem adesivos comerciais, e o CRLV está em dia.</label>}
            <button className="btn btn-primary sm:col-span-2" disabled={busy}>Cadastrar veículo</button>
          </form>
        )}
      </section>
      <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
    </>
  );
}

/** A tela mais importante: tudo o que importa aparece antes do aceite. */
/** Como o motorista recebe nesta corrida. Formas diretas: ele recebe tudo e a parte da Orbi entra no saldo. */
function PayHint({ method, totalCents, atEnd }: { method: string; totalCents: number; atEnd?: boolean }) {
  const info = METHOD_INFO[method as PaymentMethod];
  if (!info) return null;
  const text: Record<string, string> = {
    cash: `Receba ${brl(totalCents)} em dinheiro do passageiro.`,
    pix_driver: `O passageiro paga ${brl(totalCents)} por Pix na sua chave: o app mostra o QR Code para ele. Confira no seu banco antes de liberar.`,
    card_machine: `Cobre ${brl(totalCents)} na sua maquininha.`,
    pix: "Pago pelo app: o líquido entra no seu saldo quando o Pix for confirmado.",
    card: "Pago pelo app: o líquido entra no seu saldo.",
  };
  const direct = isDirect(method as PaymentMethod);
  return (
    <div className={`flex items-start gap-3 rounded-2xl p-3 text-sm ${atEnd ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]" : "bg-surface-2"}`} data-testid="pay-hint">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-on-primary"><Icon name={info.icon} size={18} /></span>
      <span><span className="block font-semibold">{atEnd ? "No fim da viagem · " : ""}{info.label}</span><span className="block text-muted">{text[method]}{direct ? " A parte da Orbi entra no seu saldo." : ""}</span></span>
    </div>
  );
}

function OfferCard({ offer, reload }: { offer: Offer; reload: () => void }) {
  const { busy, error, run } = useAction();
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [offer.expiresAt]);
  const respond = (accept: boolean) => run(async () => { await api(`/api/driver/offers/${offer.id}`, { body: { accept } }); reload(); });
  return (
    <section aria-label="Nova corrida" className="card anim-rise overflow-hidden" data-testid="offer">
      <MapView className="h-32 md:h-52" ariaLabel="Rota da corrida oferecida" route={offer.geometry} points={[{ id: "o", kind: "origin", lat: offer.origin.lat, lng: offer.origin.lng }, ...offer.stops.map((p, i) => ({ id: `s${i}`, kind: "stop" as const, lat: p.lat, lng: p.lng })), { id: "d", kind: "dest", lat: offer.dest.lat, lng: offer.dest.lng }]} />
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between"><h2 className="display text-2xl">Nova corrida</h2><span className="num rounded-full bg-primary px-3 py-1 font-bold text-on-primary" role="timer">{left}s</span></div>
        <p className="num text-sm text-muted">{km(offer.pickupDistanceM)} até o passageiro (~{mins(offer.pickupEtaS)}) · {km(offer.distanceM)} de viagem · {METHOD_LABEL[offer.paymentMethod]}</p>
        <dl className="text-sm"><div className="flex gap-2"><dt className="text-muted">Busca em</dt><dd className="font-medium">{offer.origin.label}</dd></div>{offer.stops.map((p, i) => <div key={i} className="flex gap-2"><dt className="text-muted">Parada {i + 1}</dt><dd className="font-medium">{p.label}</dd></div>)}<div className="flex gap-2"><dt className="text-muted">Leva para</dt><dd className="font-medium">{offer.dest.label}</dd></div></dl>
        <dl className="space-y-1.5 rounded-2xl bg-surface-2 p-4">
          <div className="flex justify-between"><dt>Valor bruto</dt><dd className="num font-semibold">{brl(offer.grossCents)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Comissão Orbi ({pct(offer.commissionBps)})</dt><dd className="num">− {brl(offer.commissionCents)}</dd></div>
          <div className="display flex justify-between border-t border-line pt-2 text-2xl"><dt>Você recebe</dt><dd className="num text-brand" data-testid="net">{brl(offer.driverNetCents)}</dd></div>
        </dl>
        <PayHint method={offer.paymentMethod} totalCents={offer.totalCents} />
        <ErrorNote>{error}</ErrorNote>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-ghost btn-lg" disabled={busy} onClick={() => respond(false)}>Recusar</button>
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => respond(true)}>Aceitar</button>
        </div>
      </div>
    </section>
  );
}

/** Google Maps aceita paradas no caminho; o Waze só navega até um ponto por vez. */
const navUrl = (p: Place, app: "google" | "waze", via: Place[] = []) => app === "google"
  ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving${via.length ? `&waypoints=${via.map((v) => `${v.lat},${v.lng}`).join("%7C")}` : ""}`
  : `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;

function ActiveRide({ ride, reload, position }: { ride: Ride; reload: () => void; position: { lat: number; lng: number } | null }) {
  const { busy, error, run } = useAction();
  const [alerted, setAlerted] = useState(false);
  const act = (action: string) => run(async () => { await api(`/api/rides/${ride.id}/${action}`, { body: {} }); reload(); });
  const target = ride.status === "in_progress" ? ride.dest : ride.origin;
  return (
    <section className="card overflow-hidden" data-testid="active-ride">
      <MapView className="h-64" ariaLabel="Mapa da corrida" route={ride.geometry} points={[
        { id: "o", kind: "origin", lat: ride.origin.lat, lng: ride.origin.lng }, { id: "d", kind: "dest", lat: ride.dest.lat, lng: ride.dest.lng },
        ...ride.stops.map((p, i) => ({ id: `s${i}`, kind: "stop" as const, lat: p.lat, lng: p.lng })),
        ...(position ? [{ id: "me", kind: "me" as const, ...position }] : []),
      ]} />
      <div className="space-y-3 p-5">
        <h2 className="display text-2xl">{ride.statusLabel}</h2>
        <p className="text-sm">Passageiro: <strong>{ride.passenger.name}</strong>{ride.passenger.rating ? <span className="num"> · ★ {ride.passenger.rating.toFixed(1).replace(".", ",")}</span> : " · sem avaliações"}</p>
        {ride.rider && (
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3" data-testid="rider">
            <Icon name="users" size={20} className="text-brand" />
            <p className="min-w-0 flex-1 text-sm">Quem embarca: <strong>{ride.rider.name}</strong><span className="block text-xs text-muted">Pedido por {ride.passenger.name} para outra pessoa.</span></p>
            {ride.rider.phone && <a className="btn btn-soft btn-sm" href={`tel:+55${ride.rider.phone}`}>Ligar</a>}
          </div>
        )}
        <p className="text-sm"><span className="text-muted">{ride.status === "in_progress" ? "Destino" : "Buscar em"}:</span> <strong>{target.label}</strong></p>
        {ride.stops.length > 0 && (
          <ol className="space-y-1.5 rounded-xl bg-surface-2 p-3 text-sm" data-testid="stops" aria-label="Paradas no caminho">
            {ride.stops.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">Parada: <strong>{p.label}</strong></span>
                {ride.status === "in_progress" && <a className="text-xs font-semibold underline" target="_blank" rel="noreferrer" href={navUrl(p, "waze")}>Waze</a>}
              </li>
            ))}
          </ol>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a className="btn btn-soft" target="_blank" rel="noreferrer" href={navUrl(target, "google", ride.status === "in_progress" ? ride.stops : [])}><Icon name="route" size={18} /> Google Maps</a>
          <a className="btn btn-soft" target="_blank" rel="noreferrer" href={navUrl(ride.status === "in_progress" && ride.stops[0] ? ride.stops[0] : target, "waze")}><Icon name="route" size={18} /> Waze{ride.status === "in_progress" && ride.stops.length ? " (parada 1)" : ""}</a>
        </div>
        <p className="num text-sm text-muted">Bruto {brl(ride.grossCents)} · comissão {brl(ride.commissionCents)} · você recebe <strong className="text-ink">{brl(ride.driverNetCents)}</strong> · {METHOD_LABEL[ride.paymentMethod]}</p>
        {ride.status === "in_progress" && <PayHint method={ride.paymentMethod} totalCents={ride.totalCents} atEnd />}
        <RideChat rideId={ride.id} messages={ride.messages} onSent={reload} />
        {ride.status === "accepted" && <button type="button" className="btn btn-primary btn-lg w-full" disabled={busy} onClick={() => act("arrive")}>Cheguei ao passageiro</button>}
        {ride.status === "arrived" && <button type="button" className="btn btn-primary btn-lg w-full" disabled={busy} onClick={() => act("start")}>Iniciar viagem</button>}
        {ride.status === "in_progress" && <button type="button" className="btn btn-primary btn-lg w-full" disabled={busy} onClick={() => act("complete")}>Encerrar viagem</button>}
        <div className="grid grid-cols-2 gap-2">
          {ride.status !== "in_progress" && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(async () => { await api(`/api/rides/${ride.id}/cancel`, { body: { reason: "Cancelada pelo motorista" } }); reload(); })}>Não vou conseguir</button>}
          <a href="tel:190" className="btn btn-danger" onClick={() => { if (!alerted) { setAlerted(true); api(`/api/rides/${ride.id}/emergency`, { body: {} }); } }}><Icon name="sos" size={18} /> Emergência</a>
        </div>
        {alerted && <Note tone="warn">Chamado de emergência aberto para a nossa equipe. Em perigo, fale com o 190.</Note>}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </section>
  );
}

function RatePassenger({ rideId, name, onDone }: { rideId: string; name: string; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const { busy, error, run } = useAction();
  return (
    <section className="card anim-rise space-y-3 p-5">
      <h2 className="display text-xl">Como foi a viagem com {name}?</h2>
      <Stars value={stars} onChange={setStars} />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={!stars || busy} onClick={() => run(async () => { await api(`/api/rides/${rideId}/rate`, { body: { stars } }); onDone(); })}>Enviar avaliação</button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>Agora não</button>
      </div>
    </section>
  );
}

export default function DriverHome() {
  const { data, reload, loading, error } = useLive<State>("/api/driver/state", { intervalMs: 8000 });
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [manual, setManual] = useState(false);
  const [rate, setRate] = useState<{ id: string; name: string } | null>(null);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const action = useAction();
  const online = !!data?.driver?.online;
  const prevRide = useRef<Ride | null>(null);

  useEffect(() => {
    if (data?.driver?.lat != null && data.driver.lng != null && !position) setPosition({ lat: data.driver.lat, lng: data.driver.lng });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Corrida recém-concluída: pede a avaliação do passageiro.
  useEffect(() => {
    if (prevRide.current && !data?.ride && prevRide.current.status === "in_progress") setRate({ id: prevRide.current.id, name: prevRide.current.passenger.name });
    prevRide.current = data?.ride ?? null;
  }, [data?.ride]);

  // Enquanto estiver online, a posição vem do GPS deste celular (iPhone ou Android), não do carro nem do IP.
  const gps = useDriverGps(online && !manual, (f) => setPosition({ lat: f.lat, lng: f.lng }));
  useEffect(() => { setGeoNote(gps.error ? `${gps.error} ${permissionHelp(gps.device)}` : null); }, [gps.error, gps.device]);

  // Posição manual (só em teste): renova o sinal para não ser considerada antiga.
  useEffect(() => {
    if (!online || !manual || !position) return;
    const send = () => api("/api/driver/location", { body: position }).catch(() => undefined);
    send();
    const t = setInterval(send, 30000);
    return () => clearInterval(t);
  }, [online, manual, position]);

  const goOnline = () => {
    action.setError(null);
    const send = (p: { lat: number; lng: number }) => action.run(async () => { await api("/api/driver/status", { body: { online: true, ...p } }); setPosition(p); reload(); });
    if (manual && position) { send(position); return; }
    if (!navigator.geolocation) { action.setError("Este aparelho não oferece GPS."); return; }
    navigator.geolocation.getCurrentPosition((pos) => send({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => action.setError("Permita o acesso à localização para ficar online."), { enableHighAccuracy: true, timeout: 10000 });
  };
  const goOffline = () => action.run(async () => { await api("/api/driver/status", { body: { online: false } }); reload(); });

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;
  if (!data.driver || data.driver.status !== "approved") return <Onboarding state={data} reload={reload} />;

  return (
    <div className="space-y-4">
      {!data.ride && !data.offer && (
        <section className="on-deep flex items-center justify-between gap-4 rounded-card bg-deep p-5 text-on-deep">
          <div>
            <p className="display text-2xl" data-testid="online-state">{online ? "Você está online" : "Você está offline"}</p>
            <p className="text-sm text-on-deep-muted">{online ? "Aguardando corridas. Você decide o que aceitar." : "Fique online quando quiser rodar."}</p>
          </div>
          <button type="button" className={`btn btn-lg ${online ? "btn-line-deep" : "btn-on-deep"}`} disabled={action.busy || (manual && !position)} onClick={online ? goOffline : goOnline}>{online ? "Ficar offline" : "Ficar online"}</button>
        </section>
      )}
      <ErrorNote>{action.error}</ErrorNote>
      {geoNote && online && !manual && <Note tone="warn">{geoNote}</Note>}
      {online && !manual && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-surface-2 px-4 py-3 text-sm" data-testid="gps-status">
          <span className="flex items-center gap-2 font-semibold"><Icon name="phone" size={16} />GPS {gps.device === "este aparelho" ? "deste aparelho" : `do seu ${gps.device}`}</span>
          <span className="text-muted">{gps.fix ? (gps.fix.accuracy != null ? `precisão ±${Math.max(1, Math.round(gps.fix.accuracy))} m` : "sinal recebido") : "procurando sinal…"}</span>
          <span className="text-muted">{gps.screenOn ? "tela mantida acesa" : "deixe a tela acesa enquanto roda"}</span>
        </div>
      )}
      {online && !manual && gps.offline && <Note tone="warn">Sem internet agora (4G sem sinal ou Wi-Fi caiu). O GPS continua marcando sua posição e ela é enviada assim que a conexão voltar. Enquanto isso, novas corridas não chegam.</Note>}
      {online && !manual && !gps.offline && gps.fix?.accuracy != null && gps.fix.accuracy > 100 && <Note tone="warn">Sinal de GPS fraco (precisão de ±{Math.round(gps.fix.accuracy)} m). Em lugar aberto, longe de prédios, ele melhora.</Note>}
      {online && !manual && gps.hidden && <Note tone="warn">A Orbi saiu da tela: o celular pausa o GPS de apps abertos no navegador. Volte para o app para continuar recebendo corridas.</Note>}
      {data.driver && !data.driver.pixKey && data.paymentRules?.pix_driver && !data.ride && !data.offer && (
        <a href="/motorista/conta#recebimento" className="flex items-center gap-3 rounded-2xl p-3 text-sm shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary"><Icon name="qr" size={20} /></span>
          <span className="flex-1"><span className="block font-semibold">Receba também por Pix e cartão</span><span className="block text-muted">Cadastre sua chave Pix ou sua maquininha para receber mais corridas.</span></span>
          <Icon name="arrow" size={18} />
        </a>
      )}

      {data.offer && !data.ride && <OfferCard offer={data.offer} reload={reload} />}
      {data.ride && <ActiveRide ride={data.ride} reload={reload} position={position} />}
      {rate && <RatePassenger rideId={rate.id} name={rate.name} onDone={() => setRate(null)} />}

      {!data.ride && !data.offer && (
        <>
          <MapView className="h-64 rounded-card" ariaLabel="Sua posição" onPick={manual ? (p) => setPosition(p) : undefined} points={position ? [{ id: "me", kind: "me", ...position }] : []} />
          {data.manualLocationAllowed && (
            <label className="flex items-start gap-3 rounded-xl border border-dashed border-line p-3 text-sm">
              <input type="checkbox" name="manual" className="mt-0.5 size-5 accent-[var(--primary)]" checked={manual} onChange={(e) => setManual(e.target.checked)} />
              <span><strong>Modo de teste:</strong> marcar minha posição no mapa em vez de usar o GPS. Indisponível em produção.</span>
            </label>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-sm text-muted">Saldo</p><p className="display num text-2xl">{brl(data.balanceCents)}</p></div>
        <div className="card p-4"><p className="text-sm text-muted">Sua nota</p><p className="display num text-2xl">{data.rating ? data.rating.toFixed(1).replace(".", ",") : "—"}</p></div>
      </div>
    </div>
  );
}
