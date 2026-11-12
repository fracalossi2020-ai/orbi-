"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { api, ErrorNote, Note, useAction, useLive } from "@/components/ui";
import { PIX_KEY_TYPES, type PixKeyType } from "@/domain/pix";

type DriverState = { driver: { pixKey: string | null; pixKeyType: string | null; cardMachine: boolean } | null; paymentRules: { cash: boolean; pix_driver: boolean; card_machine: boolean } };

/**
 * Como o motorista recebe direto do passageiro. Com chave Pix, ele passa a receber corridas pagas por Pix
 * (o app gera o QR Code com o valor); com maquininha, as pagas no cartão. Sem nada, só dinheiro.
 */
export function PaymentPrefs() {
  const { data, reload } = useLive<DriverState>("/api/driver/state", { live: false });
  const [type, setType] = useState<PixKeyType>("phone");
  const [key, setKey] = useState("");
  const [machine, setMachine] = useState(false);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  useEffect(() => {
    if (!data?.driver) return;
    setType((data.driver.pixKeyType as PixKeyType) ?? "phone");
    setKey(data.driver.pixKey ? (data.driver.pixKeyType === "phone" ? data.driver.pixKey.replace(/^\+55/, "") : data.driver.pixKey) : "");
    setMachine(data.driver.cardMachine);
  }, [data?.driver]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data?.driver) return null;
  const rules = data.paymentRules;
  const save = () => run(async () => {
    setSaved(false);
    await api("/api/driver/payment-prefs", { body: { pixKeyType: key.trim() ? type : null, pixKey: key.trim() || null, cardMachine: machine } });
    setSaved(true); reload();
  });
  const placeholder: Record<PixKeyType, string> = { cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", phone: "(31) 99999-9999", email: "voce@exemplo.com", random: "123e4567-e89b-12d3-a456-426614174000" };
  return (
    <section id="recebimento" className="card scroll-mt-24 p-5" aria-labelledby="recebimento-titulo">
      <h2 id="recebimento-titulo" className="display text-xl">Como você recebe</h2>
      <p className="mt-1 text-sm text-muted">O passageiro paga direto para você. A parte da Orbi entra no seu saldo, como no dinheiro.</p>
      <div className="mt-5 space-y-5">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand"><Icon name="money" size={20} /></span><div><p className="font-semibold">Dinheiro</p><p className="text-sm text-muted">{rules.cash ? "Sempre aceito." : "Desligado pela Orbi no momento."}</p></div></div>
        {rules.pix_driver && (
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand"><Icon name="qr" size={20} /></span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold">Pix na sua chave</p>
              <p className="text-sm text-muted">Com a chave cadastrada, você recebe corridas pagas por Pix. A chave aparece para o passageiro só nessas corridas.</p>
              <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                <label className="block"><span className="sr-only">Tipo de chave</span>
                  <select className="input" value={type} onChange={(e) => setType(e.target.value as PixKeyType)}>
                    {(Object.keys(PIX_KEY_TYPES) as PixKeyType[]).map((k) => <option key={k} value={k}>{PIX_KEY_TYPES[k]}</option>)}
                  </select>
                </label>
                <label className="block"><span className="sr-only">Chave Pix</span>
                  <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder={placeholder[type]} autoComplete="off"
                    inputMode={type === "email" ? "email" : type === "random" ? "text" : "numeric"} />
                </label>
              </div>
              {!key.trim() && <p className="text-xs text-muted">Deixe vazio para não receber por Pix.</p>}
            </div>
          </div>
        )}
        {rules.card_machine && (
          <label className="flex cursor-pointer items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand"><Icon name="card" size={20} /></span>
            <span className="flex-1"><span className="block font-semibold">Maquininha de cartão</span><span className="block text-sm text-muted">Marque se você tem maquininha no carro. Assim recebe corridas pagas no débito ou crédito.</span></span>
            <input type="checkbox" name="cardMachine" className="mt-2 size-6 accent-[var(--primary)]" checked={machine} onChange={(e) => setMachine(e.target.checked)} />
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
        {saved && <Note tone="ok">Formas de recebimento salvas.</Note>}
        <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={save}>Salvar formas de recebimento</button>
      </div>
    </section>
  );
}
