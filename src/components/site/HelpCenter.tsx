"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useSupport } from "./usePublic";

/** Perguntas frequentes. Cada resposta descreve o que o app faz hoje; o que depende de contrato aparece como tal. */
type QA = { q: string; a: string };
const TOPICS: { id: string; title: string; icon: string; items: QA[] }[] = [
  { id: "viagem", title: "Viagens", icon: "car", items: [
    { q: "Como peço uma viagem?", a: "Entre na conta de passageiro, escolha a partida (o GPS preenche, se você permitir) e o destino final. O app mostra a rota, o tempo e o preço de cada categoria antes de você confirmar." },
    { q: "Consigo ver o preço antes de pedir?", a: "Sim. No site, a rota e o preço estimado aparecem sem cadastro. No app, o valor de cada categoria aparece antes de você confirmar o pedido." },
    { q: "Posso agendar uma viagem?", a: "Sim. Na tela de preços, escolha \"Agendar\" e o dia e hora. A busca por motorista começa alguns minutos antes, e o preço mostrado no agendamento fica garantido. As agendadas aparecem em Viagens, onde você também pode cancelar." },
    { q: "Dá para fazer paradas no caminho?", a: "Sim, até duas paradas entre a partida e o destino final. O preço segue a tarifa sobre o trajeto completo." },
    { q: "Posso pedir uma viagem para outra pessoa?", a: "Sim. Em \"Quem vai viajar\", escolha \"Outra pessoa\" e informe nome e celular. O motorista vê esse nome e pode ligar só durante a corrida. A cobrança fica na sua conta." },
    { q: "Como cancelo?", a: "Pelo app, enquanto a viagem ainda não começou: na busca, com o motorista a caminho ou já no local. Hoje não há cobrança por cancelamento." },
    { q: "Esqueci um objeto no carro. E agora?", a: "Abra um chamado em Ajuda, no app, contando a viagem e o objeto. Nossa equipe fala com o motorista." },
  ] },
  { id: "pagamento", title: "Pagamento", icon: "wallet", items: [
    { q: "Quais formas de pagamento existem?", a: "Hoje, dinheiro, pago direto ao motorista no fim da viagem. Pix e cartão no app entram depois do contrato com o provedor de pagamentos." },
    { q: "Como o preço é calculado?", a: "Bandeirada, mais um valor por quilômetro e por minuto do trajeto, com um valor mínimo por corrida, mais a taxa de serviço. As tarifas de cada cidade estão abertas na página da cidade." },
    { q: "Como uso um cupom?", a: "Na tela de preços, toque em \"Tenho um cupom\" e digite o código. O desconto aparece antes de você confirmar. O cupom é pago pela Orbi e não reduz o ganho do motorista." },
  ] },
  { id: "seguranca", title: "Segurança", icon: "shield", items: [
    { q: "Como sei quem é o motorista?", a: "Assim que o motorista aceita, o app mostra nome, foto, avaliação, carro, cor e placa. Confira antes de entrar." },
    { q: "Posso compartilhar a viagem?", a: "Sim. Durante a corrida, toque em \"Compartilhar\": quem receber o link acompanha o trajeto ao vivo, sem precisar de conta." },
    { q: "O que o botão de emergência faz?", a: "Abre um chamado prioritário para a equipe da Orbi e liga para o 190. Em perigo, fale primeiro com o 190." },
  ] },
  { id: "motorista", title: "Para motoristas", icon: "steering", items: [
    { q: "O que preciso para dirigir?", a: "CNH, documento do veículo (CRLV) e uma foto do rosto. A equipe analisa os documentos e aprova o cadastro." },
    { q: "Quanto a Orbi retém?", a: "A comissão é definida por cidade e categoria e aparece em cada oferta, junto com o valor bruto e o que fica com você, antes do aceite. Faça a conta no simulador da página Motoristas." },
    { q: "Como as corridas são distribuídas?", a: "Não vai só para o carro mais próximo: tempo parado, ganhos do dia, aceite e avaliação também contam, para equilibrar quem roda." },
    { q: "Como recebo?", a: "Cada corrida entra no extrato. Corridas em dinheiro você recebe na hora; as pagas no app viram saldo, e você pede o saque pelo app." },
  ] },
  { id: "conta", title: "Conta e privacidade", icon: "user", items: [
    { q: "Posso entrar com o Google?", a: "Sim, passageiros e motoristas podem usar \"Continuar com Google\". Se você já tem conta com o mesmo e-mail, ela é ligada ao Google em vez de duplicada." },
    { q: "Como baixo ou apago meus dados?", a: "Em Conta, no app, você baixa uma cópia dos seus dados ou exclui a conta. Corridas e lançamentos ficam guardados sem dados pessoais, por obrigação fiscal." },
  ] },
];

const plain = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function HelpCenter() {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const support = useSupport();
  const found = useMemo(() => {
    const words = plain(q).split(/\s+/).filter((w) => w.length > 1);
    return TOPICS.map((t) => ({ ...t, items: t.items.filter((it) => (!topic || t.id === topic) && words.every((w) => plain(`${it.q} ${it.a}`).includes(w))) })).filter((t) => t.items.length);
  }, [q, topic]);
  const total = found.reduce((n, t) => n + t.items.length, 0);
  return (
    <>
      <section className="on-deep relative overflow-hidden bg-deep text-on-deep">
        <div aria-hidden="true" className="grid-lines absolute inset-0" />
        <div aria-hidden="true" className="hero-aurora absolute inset-0 opacity-80" />
        <div className="relative mx-auto max-w-[920px] px-5 pt-32 pb-16 text-center md:px-10 md:pt-40">
          <p className="mono-label text-on-deep-muted">Central de ajuda</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,6vw,5rem)] leading-[.95]">Como podemos ajudar?</h1>
          <label className="help-search relative mx-auto mt-10 flex max-w-2xl items-center gap-3 rounded-full bg-surface px-5 text-ink shadow-[0_30px_80px_-30px_rgb(0_0_0/.8)]">
            <Icon name="search" size={22} className="shrink-0 text-muted" />
            <span className="sr-only">Buscar nas perguntas</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: cancelar, agendar, cupom, saque" className="min-h-16 w-full bg-transparent text-lg outline-none" type="search" />
          </label>
          <p className="mt-4 text-sm text-on-deep-muted" role="status">{q || topic ? `${total} ${total === 1 ? "resposta" : "respostas"}` : `${TOPICS.reduce((n, t) => n + t.items.length, 0)} respostas em ${TOPICS.length} assuntos`}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Assuntos">
            {TOPICS.map((t) => (
              <button key={t.id} type="button" aria-pressed={topic === t.id} onClick={() => setTopic(topic === t.id ? null : t.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${topic === t.id ? "bg-on-deep text-deep" : "shadow-[0_0_0_1px_color-mix(in_srgb,var(--on-deep)_28%,transparent)_inset] hover:bg-[color-mix(in_srgb,var(--on-deep)_10%,transparent)]"}`}>
                <Icon name={t.icon} size={16} />{t.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bg text-ink">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-16 md:px-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-12">
            {!found.length && <p className="text-muted">Nenhuma resposta com essas palavras. Tente outra busca, ou fale com a gente ao lado.</p>}
            {found.map((t) => (
              <div key={t.id}>
                <h2 className="display flex items-center gap-3 text-2xl md:text-3xl"><span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-brand"><Icon name={t.icon} size={20} weight="duotone" /></span>{t.title}</h2>
                <div className="mt-5 divide-y divide-line border-y border-line">
                  {t.items.map((it) => (
                    <details key={it.q} className="help-qa group" open={!!q && total <= 3}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold">
                        {it.q}
                        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 transition-transform duration-300 group-open:rotate-45"><Icon name="plus" size={16} /></span>
                      </summary>
                      <p className="max-w-[62ch] pb-6 text-muted">{it.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[24px] bg-surface p-6 shadow-[0_0_0_1px_var(--line)_inset]">
              <p className="display text-2xl">Não achou?</p>
              <p className="mt-2 text-sm text-muted">Quem tem conta abre um chamado em Ajuda, no app, e acompanha a resposta por lá.</p>
              <div className="mt-5 space-y-2">
                {support?.whatsapp && (
                  <a href={`https://wa.me/${support.whatsapp}?text=${encodeURIComponent("Olá, Orbi! Preciso de ajuda.")}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
                    <Icon name="chat" size={18} /> Falar no WhatsApp
                  </a>
                )}
                <Link href="/entrar" className="btn btn-ghost w-full">Abrir um chamado no app</Link>
                <Link href="/contato" className="btn btn-ghost w-full">Formulário de contato</Link>
              </div>
              <p className="mt-5 text-xs text-muted">Em perigo, ligue para o 190.</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
