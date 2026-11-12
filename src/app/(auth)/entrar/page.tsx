"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { api, ErrorNote, Note, useAction } from "@/components/ui";
import { isFullName, isValidEmailFormat } from "@/domain/validation";

type Role = "passenger" | "driver";
type Step = "identifier" | "password" | "reset" | "role" | "name" | "email" | "create" | "google" | "mfa";

// Por que o login com Google voltou para esta tela.
const GOOGLE_REASON: Record<string, string> = {
  cancelado: "Você cancelou a entrada com Google.",
  expirado: "A entrada com Google demorou demais. Tente de novo.",
  falhou: "O Google não confirmou sua conta. Tente de novo ou use celular e senha.",
  equipe: "Contas da equipe entram com e-mail e senha.",
  "conta-inativa": "Esta conta está suspensa ou foi excluída. Fale com o suporte.",
  indisponivel: "A entrada com Google ainda não está ativada.",
  limite: "Muitas tentativas. Aguarde alguns minutos.",
};

/** O "G" do Google, como pedem as regras de marca deles para o botão de entrada. */
function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const HOME: Record<string, string> = { passenger: "/passageiro", driver: "/motorista", admin: "/admin", gestor: "/admin", atendente: "/admin" };

/** Aceita 031, +55 e colagens com pontuação; guarda só DDD e número. */
function phoneDigits(value: string) {
  let d = value.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

function maskPhone(d: string) {
  if (d.length <= 2) return d && `(${d}`;
  const split = d.length === 11 ? 7 : 6;
  return d.length <= split ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
}

function Flow() {
  const params = useSearchParams();
  const perfil = params.get("perfil");
  const presetRole: Role | null = perfil === "motorista" ? "driver" : perfil === "passageiro" ? "passenger" : null;

  // Vindo do Google com verificação em duas etapas ativa: abre direto no código.
  const [step, setStep] = useState<Step>(params.get("etapa") === "codigo" ? "mfa" : "identifier");
  const [mfaCode, setMfaCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [useEmail, setUseEmail] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | null>(presetRole);
  const [accept, setAccept] = useState(false);
  const [google, setGoogle] = useState<{ enabled: boolean; pending: { name: string; email: string } | null } | null>(null);
  const googleReason = params.get("google");
  const { busy, error, run, setError } = useAction();

  // O botão do Google só aparece se a credencial estiver configurada; conta nova volta aqui para concluir.
  useEffect(() => {
    fetch("/api/auth/google/status").then((r) => r.json()).then((g) => {
      setGoogle(g);
      if (googleReason === "novo" && g.pending) { setName(g.pending.name); setStep("google"); }
    }).catch(() => setGoogle({ enabled: false, pending: null }));
  }, [googleReason]);

  const submitGoogle = () => run(async () => {
    if (!role) throw new Error("Escolha como você vai usar a Orbi.");
    const u = await api<{ role: string }>("/api/auth/google/complete", { body: { name, role, acceptPrivacy: accept || undefined } });
    finish(u.role);
  });

  const identifier = useEmail ? email.trim() : phone;
  const shownIdentifier = useEmail ? email.trim() : maskPhone(phone);

  // O botão voltar do aparelho precisa voltar uma etapa, não sair da tela.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => { setError(null); setStep((e.state?.prumoStep as Step) ?? "identifier"); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setError]);

  const go = (next: Step) => {
    setError(null);
    setPassword("");
    window.history.pushState({ ...window.history.state, prumoStep: next }, "");
    setStep(next);
  };

  const finish = (userRole: string) => { window.location.href = HOME[userRole]; };

  const submitIdentifier = () => {
    if (!useEmail && phone.length < 10) { setError("Digite o celular com DDD."); return; }
    run(async () => {
      const { exists } = await api<{ exists: boolean }>("/api/auth/lookup", { body: { identifier } });
      go(exists ? "password" : presetRole ? "name" : "role");
    });
  };

  const submitLogin = () => run(async () => {
    const u = await api<{ role?: string; mfaRequired?: boolean }>("/api/auth/login", { body: { identifier, password } });
    if (u.mfaRequired) { setMfaCode(""); go("mfa"); return; }
    finish(u.role!);
  });

  const submitMfa = () => run(async () => {
    const u = await api<{ role: string }>("/api/auth/mfa", { body: { code: mfaCode } });
    finish(u.role);
  });

  const requestReset = () => run(async () => {
    const r = await api<{ sentTo: string }>("/api/auth/reset-request", { body: { identifier } });
    setSentTo(r.sentTo);
    setCode("");
    if (step !== "reset") go("reset");
  });

  const submitReset = () => run(async () => {
    const u = await api<{ role?: string; mfaRequired?: boolean }>("/api/auth/reset-confirm", { body: { identifier, code, password } });
    if (u.mfaRequired) { setMfaCode(""); go("mfa"); return; }
    finish(u.role!);
  });

  // O e-mail de contato não pode estar em outra conta: a consulta já confere isso e o domínio.
  const submitContactEmail = () => {
    if (!isValidEmailFormat(contactEmail)) { setError("Digite um e-mail válido."); return; }
    run(async () => {
      const { exists } = await api<{ exists: boolean }>("/api/auth/lookup", { body: { identifier: contactEmail.trim() } });
      if (exists) throw new Error("Este e-mail já está em outra conta. Use outro ou entre com ele.");
      go("create");
    });
  };

  const submitRegister = () => run(async () => {
    const u = await api<{ role: string }>("/api/auth/register", {
      body: { name, password, role, acceptPrivacy: accept || undefined, ...(useEmail ? { email: identifier } : { phone: identifier, email: contactEmail.trim() }) },
    });
    finish(u.role);
  });

  const back = step !== "identifier" && (
    <button type="button" onClick={() => window.history.back()} aria-label="Voltar" className="-ml-3 mb-4 grid size-11 place-items-center rounded-full hover:bg-surface-2"><Icon name="back" size={22} /></button>
  );

  if (step === "identifier") {
    return (
      <form key={String(useEmail)} className="anim-rise" onSubmit={(e) => { e.preventDefault(); submitIdentifier(); }}>
        <h1 className="display text-4xl">{useEmail ? "Qual é o seu e-mail?" : "Qual é o seu celular?"}</h1>
        <p className="mt-2 text-muted">Serve para entrar na sua conta ou criar uma nova.</p>
        <label className="mt-6 block">
          <span className="sr-only">{useEmail ? "E-mail" : "Celular com DDD"}</span>
          {useEmail
            ? <input className="input text-lg" name="email" type="email" autoComplete="username" autoFocus required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            : <input className="input num text-lg" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" autoFocus required placeholder="(31) 99999-9999" value={maskPhone(phone)} onChange={(e) => setPhone(phoneDigits(e.target.value))} />}
        </label>
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
        <button className="btn btn-primary btn-lg mt-3 w-full" disabled={busy}>{busy ? "Verificando…" : "Continuar"}</button>
        <button type="button" className="mt-4 w-full py-2 text-sm font-semibold underline" onClick={() => { setError(null); setUseEmail(!useEmail); }}>{useEmail ? "Usar celular" : "Usar e-mail"}</button>
        {googleReason && GOOGLE_REASON[googleReason] && <div className="mt-3"><Note tone="warn">{GOOGLE_REASON[googleReason]}</Note></div>}
        {google?.enabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
            <a href={`/api/auth/google/start${perfil ? `?perfil=${encodeURIComponent(perfil)}` : ""}`} className="btn btn-soft btn-lg w-full"><GoogleG />Continuar com Google</a>
          </>
        )}
        {/* Cadastro de motorista é um caminho próprio: requisitos e termo antes de começar. */}
        {presetRole !== "driver" ? (
          <a href="/motoristas/requisitos" className="mt-6 flex items-center gap-3 rounded-2xl p-3 text-left shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-2">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary"><Icon name="steering" size={22} /></span>
            <span className="flex-1"><span className="block font-semibold">Quero ser motorista parceiro</span><span className="block text-sm text-muted">Veja os requisitos e cadastre-se para dirigir.</span></span>
            <Icon name="arrow" size={18} />
          </a>
        ) : (
          <p className="mt-6 text-sm text-muted">Cadastro de motorista: antes, confira os <a className="font-semibold underline" href="/motoristas/requisitos">requisitos</a> e o <a className="font-semibold underline" href="/termos-motorista">termo de adesão</a>.</p>
        )}
      </form>
    );
  }

  if (step === "mfa") {
    return (
      <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); submitMfa(); }}>
        <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-brand"><Icon name="lock" /></span>
        <h1 className="display mt-4 text-4xl">{useRecovery ? "Código de recuperação" : "Código do aplicativo"}</h1>
        <p className="mt-2 text-muted">{useRecovery ? "Digite um dos códigos de recuperação que você guardou. Cada um vale uma vez." : "Abra o aplicativo autenticador no seu celular e digite os 6 números da Orbi."}</p>
        <label className="mt-6 block">
          <span className="sr-only">{useRecovery ? "Código de recuperação" : "Código de 6 números"}</span>
          {useRecovery
            ? <input className="input num text-lg uppercase" name="recovery" autoComplete="off" autoFocus required placeholder="ABCDE-12345" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.toUpperCase().slice(0, 11))} />
            : <input className="input num text-center text-2xl tracking-[.5em]" name="otp" inputMode="numeric" autoComplete="one-time-code" autoFocus required placeholder="000000" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />}
        </label>
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
        <button className="btn btn-primary btn-lg mt-3 w-full" disabled={busy || (useRecovery ? mfaCode.length < 10 : mfaCode.length !== 6)}>{busy ? "Conferindo…" : "Entrar"}</button>
        <button type="button" className="mt-4 w-full py-2 text-sm font-semibold underline" onClick={() => { setError(null); setMfaCode(""); setUseRecovery(!useRecovery); }}>{useRecovery ? "Usar o código do aplicativo" : "Perdi o celular: usar código de recuperação"}</button>
      </form>
    );
  }

  if (step === "password") {
    return (
      <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); submitLogin(); }}>
        {back}
        <h1 className="display text-4xl">Digite sua senha</h1>
        <p className="num mt-2 text-muted">{shownIdentifier}</p>
        <label className="mt-6 block">
          <span className="sr-only">Senha</span>
          <input className="input text-lg" name="password" type="password" autoComplete="current-password" autoFocus required placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
        <button className="btn btn-primary btn-lg mt-3 w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        <button type="button" className="mt-4 w-full py-2 text-sm font-semibold underline" disabled={busy} onClick={requestReset}>Esqueci minha senha</button>
      </form>
    );
  }

  if (step === "reset") {
    return (
      <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); submitReset(); }}>
        {back}
        <h1 className="display text-4xl">Crie uma nova senha</h1>
        <p className="mt-2 text-muted">Enviamos um código de 6 dígitos para <strong className="text-ink">{sentTo}</strong>. Ele vale por 15 minutos.</p>
        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-semibold">Código</span>
          <input className="input num text-lg tracking-[.3em]" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold">Nova senha</span>
          <input className="input text-lg" name="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">Pelo menos 8 caracteres.</span>
        </label>
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
        <button className="btn btn-primary btn-lg mt-3 w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
        <button type="button" className="mt-4 w-full py-2 text-sm font-semibold underline" disabled={busy} onClick={requestReset}>Enviar outro código</button>
      </form>
    );
  }

  if (step === "google" && google?.pending) {
    return (
      <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); submitGoogle(); }}>
        <h1 className="display text-4xl">Falta pouco</h1>
        <p className="mt-2 text-muted">Conta Google confirmada: <strong className="text-ink">{google.pending.email}</strong></p>
        {!presetRole && (
          <div className="mt-6 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como você vai usar a Orbi">
            {([["passenger", "Quero viajar", "car"], ["driver", "Quero dirigir", "steering"]] as const).map(([value, label, icon]) => (
              <button key={value} type="button" role="radio" aria-checked={role === value} onClick={() => setRole(value)}
                className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold ${role === value ? "bg-primary text-on-primary" : "bg-surface-2"}`}><Icon name={icon} size={24} />{label}</button>
            ))}
          </div>
        )}
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-semibold">Nome completo</span>
          <input className="input text-lg" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          {role === "driver" && <span className="mt-1 block text-xs text-muted">Use o mesmo nome da sua CNH.</span>}
        </label>
        <label className="mt-5 flex items-start gap-3 text-sm">
          <input type="checkbox" name="accept" className="mt-0.5 size-5 accent-[var(--primary)]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>Li e aceito os <Link href="/termos" target="_blank" className="underline">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="underline">política de privacidade</Link>.</span>
        </label>
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
        <button className="btn btn-primary btn-lg mt-3 w-full" disabled={busy}>{busy ? "Criando conta…" : "Criar conta"}</button>
      </form>
    );
  }

  if (step === "role") {
    return (
      <div className="anim-rise">
        {back}
        <h1 className="display text-4xl">Como você vai usar a Orbi?</h1>
        <div className="mt-6 space-y-2">
          {([["passenger", "Quero viajar", "car"], ["driver", "Quero dirigir", "route"]] as const).map(([value, label, icon]) => (
            <button key={value} type="button" className="btn btn-soft btn-lg w-full !justify-between" onClick={() => { setRole(value); go("name"); }}>
              <span className="flex items-center gap-3"><Icon name={icon} size={22} />{label}</span><Icon name="arrow" size={20} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "name") {
    return (
      <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); if (!isFullName(name)) { setError("Digite nome e sobrenome."); return; } go(useEmail ? "create" : "email"); }}>
        {back}
        <h1 className="display text-4xl">Qual é o seu nome completo?</h1>
        <p className="mt-2 text-muted">{role === "driver" ? "Use o mesmo nome da sua CNH." : "Quem dirige verá seu nome ao aceitar a corrida."}</p>
        <label className="mt-6 block">
          <span className="sr-only">Nome completo</span>
          <input className="input text-lg" name="name" autoComplete="name" autoCapitalize="words" autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
        <button className="btn btn-primary btn-lg mt-3 w-full">Continuar</button>
      </form>
    );
  }

  if (step === "email") {
    return (
      <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); submitContactEmail(); }}>
        {back}
        <h1 className="display text-4xl">Qual é o seu e-mail?</h1>
        <p className="mt-2 text-muted">É por ele que você recupera a conta se esquecer a senha. Vamos mandar um código para confirmar.</p>
        <label className="mt-6 block">
          <span className="sr-only">E-mail de contato</span>
          <input className="input text-lg" name="contact-email" type="email" autoComplete="email" autoFocus required placeholder="voce@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </label>
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
        <button className="btn btn-primary btn-lg mt-3 w-full" disabled={busy}>{busy ? "Verificando…" : "Continuar"}</button>
      </form>
    );
  }

  return (
    <form className="anim-rise" onSubmit={(e) => { e.preventDefault(); submitRegister(); }}>
      {back}
      <h1 className="display text-4xl">Crie uma senha</h1>
      <p className="mt-2 text-muted">Pelo menos 8 caracteres.</p>
      <label className="mt-6 block">
        <span className="sr-only">Nova senha</span>
        <input className="input text-lg" name="password" type="password" autoComplete="new-password" autoFocus required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="mt-5 flex items-start gap-3 text-sm">
        <input type="checkbox" name="accept" className="mt-0.5 size-5 accent-[var(--primary)]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>Li e aceito os <Link href="/termos" target="_blank" className="underline">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="underline">política de privacidade</Link>.</span>
      </label>
      <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
      <button className="btn btn-primary btn-lg mt-3 w-full" disabled={busy}>{busy ? "Criando conta…" : "Criar conta"}</button>
    </form>
  );
}

export default function Entrar() {
  return <Suspense><Flow /></Suspense>;
}
