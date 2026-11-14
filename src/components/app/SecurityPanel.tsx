"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/Icon";
import { api, dateTime, ErrorNote, Note, useAction, useLive } from "@/components/ui";

type MfaState = { enabled: boolean; required: boolean; recoveryLeft: number };
type Session = { id: string; device: string; createdAt: string; lastSeenAt: string; current: boolean };

/** Códigos de recuperação: mostrados uma única vez, com opção de copiar e baixar. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Códigos de recuperação da Orbi (cada um vale uma vez):\n\n${codes.join("\n")}\n`;
  return (
    <div className="space-y-3" data-testid="recovery-codes">
      <Note tone="warn">Guarde estes códigos num lugar seguro. Se perder o celular, cada um permite entrar uma vez. Eles não aparecem de novo.</Note>
      <ol className="num grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-4 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-soft btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* sem área de transferência */ } }}><Icon name="copy" size={16} />{copied ? "Copiados" : "Copiar"}</button>
        <a className="btn btn-soft btn-sm" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="orbi-codigos-de-recuperacao.txt">Baixar</a>
        <button type="button" className="btn btn-primary btn-sm" onClick={onDone}>Já guardei</button>
      </div>
    </div>
  );
}

/** Ativar, renovar códigos ou desativar a verificação em duas etapas (aplicativo autenticador). */
export function MfaSetup({ onEnabled }: { onEnabled?: () => void }) {
  const { data, reload } = useLive<MfaState>("/api/account/mfa", { live: false });
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"none" | "recovery" | "disable">("none");
  const { busy, error, run, setError } = useAction();
  useEffect(() => {
    if (!setup) { setQr(null); return; }
    QRCode.toString(setup.otpauth, { type: "svg", margin: 1, color: { dark: "#0F2C35", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(null));
  }, [setup]);
  if (!data) return null;

  const start = () => run(async () => { setCode(""); setSetup(await api("/api/account/mfa-start", { body: {} })); });
  const needCode = () => { if (code.length !== 6) throw new Error("Digite os 6 números que aparecem no aplicativo autenticador."); };
  const enable = () => run(async () => { needCode(); const r = await api<{ recoveryCodes: string[] }>("/api/account/mfa-enable", { body: { code } }); setCodes(r.recoveryCodes); setSetup(null); setCode(""); reload(); });
  const renew = () => run(async () => { needCode(); const r = await api<{ recoveryCodes: string[] }>("/api/account/mfa-recovery", { body: { code } }); setCodes(r.recoveryCodes); setCode(""); setMode("none"); reload(); });
  const disable = () => run(async () => { if (!password) throw new Error("Digite sua senha."); needCode(); await api("/api/account/mfa-disable", { body: { code, password } }); setCode(""); setPassword(""); setMode("none"); reload(); });
  const codeInput = <input className="input num text-center text-xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} aria-label="Código de 6 números do aplicativo" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />;

  return (
    <section className="card p-5" aria-labelledby="mfa-titulo" data-testid="mfa">
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${data.enabled ? "bg-primary text-on-primary" : "bg-surface-2 text-brand"}`}><Icon name="lock" size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="mfa-titulo" className="display text-xl">Verificação em duas etapas</h2>
          <p className="text-sm text-muted">{data.enabled
            ? `Ativa. Além da senha, a entrada pede o código do aplicativo autenticador. Códigos de recuperação restantes: ${data.recoveryLeft}.`
            : data.required ? "Obrigatória para a equipe: protege o painel mesmo que alguém descubra a sua senha." : "Recomendado: mesmo que alguém descubra sua senha, não entra sem o código do seu celular."}</p>
        </div>
      </div>

      {codes && <div className="mt-4"><RecoveryCodes codes={codes} onDone={() => { setCodes(null); onEnabled?.(); }} /></div>}

      {!data.enabled && !codes && (
        setup ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-[200px_1fr] sm:items-start">
            {qr ? <div className="mx-auto w-[200px] overflow-hidden rounded-xl bg-white p-2" role="img" aria-label="QR Code para o aplicativo autenticador" dangerouslySetInnerHTML={{ __html: qr }} /> : <div className="map-loading mx-auto aspect-square w-[200px] rounded-xl" />}
            <div className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>Instale um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou outro).</li>
                <li>No aplicativo, toque em adicionar e leia o QR Code. Sem câmera? Digite a chave abaixo.</li>
                <li>Digite os 6 números que o aplicativo mostrar.</li>
              </ol>
              <p className="break-all rounded-xl bg-surface-2 p-3 font-mono text-xs" data-testid="mfa-secret">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
              {codeInput}
              <ErrorNote>{error}</ErrorNote>
              <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={enable}>{busy ? "Conferindo…" : "Ativar"}</button>
            </div>
          </div>
        ) : (
          <div className="mt-4"><ErrorNote>{error}</ErrorNote><button type="button" className="btn btn-primary" disabled={busy} onClick={start}>Ativar a verificação em duas etapas</button></div>
        )
      )}

      {data.enabled && !codes && (
        <div className="mt-4 space-y-3">
          {mode === "none" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-soft btn-sm" onClick={() => { setError(null); setCode(""); setMode("recovery"); }}>Gerar novos códigos de recuperação</button>
              {!data.required && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setError(null); setCode(""); setMode("disable"); }}>Desativar</button>}
            </div>
          ) : (
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-semibold">{mode === "recovery" ? "Confirme com o código do aplicativo" : "Para desativar, confirme a senha e o código"}</p>
              {mode === "disable" && <input className="input" type="password" autoComplete="current-password" placeholder="Senha" aria-label="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />}
              {codeInput}
              <ErrorNote>{error}</ErrorNote>
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={mode === "recovery" ? renew : disable}>{mode === "recovery" ? "Gerar códigos" : "Desativar"}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("none")}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PasswordChange() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const { busy, error, run } = useAction();
  const save = () => run(async () => {
    setDone(false);
    if (!current) throw new Error("Digite a senha que você usa hoje.");
    if (next.length < 8) throw new Error("A nova senha precisa de pelo menos 8 caracteres.");
    await api("/api/auth/password-change", { body: { current, password: next } });
    setDone(true); setCurrent(""); setNext("");
  });
  return (
    <section className="card p-5" aria-labelledby="senha-titulo">
      <h2 id="senha-titulo" className="display text-xl">Trocar a senha</h2>
      <p className="text-sm text-muted">Ao trocar, os outros aparelhos conectados saem da conta.</p>
      <form className="mt-4 grid max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <input className="input" type="password" autoComplete="current-password" placeholder="Senha atual" aria-label="Senha atual" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" placeholder="Nova senha (8 ou mais caracteres)" aria-label="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} />
        <ErrorNote>{error}</ErrorNote>
        {done && <Note tone="ok">Senha trocada. Os outros aparelhos foram desconectados.</Note>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Trocando…" : "Trocar senha"}</button>
      </form>
    </section>
  );
}

function Sessions() {
  const { data, reload } = useLive<{ sessions: Session[] }>("/api/account/sessions", { live: false });
  const { busy, error, run } = useAction();
  if (!data) return null;
  const others = data.sessions.filter((s) => !s.current);
  return (
    <section className="card p-5" aria-labelledby="aparelhos-titulo" data-testid="sessions">
      <h2 id="aparelhos-titulo" className="display text-xl">Aparelhos conectados</h2>
      <p className="text-sm text-muted">Não reconhece algum? Encerre a sessão e troque a senha.</p>
      <ul className="mt-4 divide-y divide-line">
        {data.sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand"><Icon name="phone" size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{s.device}{s.current && <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-2 py-0.5 text-xs text-brand">este aparelho</span>}</span>
              <span className="block text-xs text-muted">Entrou em {dateTime(s.createdAt)} · último uso {dateTime(s.lastSeenAt)}</span>
            </span>
            {!s.current && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(async () => { await api("/api/account/sessions", { body: { id: s.id } }); reload(); })}>Encerrar</button>}
          </li>
        ))}
      </ul>
      <ErrorNote>{error}</ErrorNote>
      {others.length > 0 && <button type="button" className="btn btn-soft btn-sm mt-2" disabled={busy} onClick={() => run(async () => { await api("/api/account/sessions", { body: { others: true } }); reload(); })}>Sair de todos os outros aparelhos</button>}
    </section>
  );
}

/** Segurança da conta: senha, verificação em duas etapas e aparelhos conectados. */
export function SecurityPanel() {
  return (
    <div className="space-y-4" id="seguranca">
      <MfaSetup />
      <PasswordChange />
      <Sessions />
    </div>
  );
}
