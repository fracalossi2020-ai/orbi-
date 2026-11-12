import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { ApiError, audit, body, publicRoute } from "@/server/api";
import { authSecret, checkRateLimit, hashPassword, publicUser, startSession } from "@/server/auth";
import { clientIp } from "@/server/security";
import { finishLogin, googleEnabled, seal, startParams, unseal, type GoogleProfile } from "@/server/google";
import { isFullName } from "@/domain/validation";

const FLOW = "prumo_google_flow";
const PENDING = "prumo_google_new";
const HOME: Record<string, string> = { passenger: "/passageiro", driver: "/motorista", admin: "/admin", gestor: "/admin", atendente: "/admin" };
const STAFF = new Set(["admin", "gestor", "atendente"]);
const cookieOpts = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" && !process.env.PRUMO_ALLOW_EMBEDDED_DB, path: "/", maxAge });

type Flow = { state: string; nonce: string; verifier: string; perfil?: string };

const completeSchema = z.object({
  name: z.string().trim().refine(isFullName, "Informe nome e sobrenome."),
  role: z.enum(["passenger", "driver"]),
  acceptPrivacy: z.literal(true, { error: "Aceite os termos e a política de privacidade para continuar." }),
});

/** Volta para a tela de entrada com um motivo que ela sabe explicar. */
const back = (req: Request, reason: string) => NextResponse.redirect(new URL(`/entrar?google=${reason}`, req.url), 303);

export const GET = publicRoute<{ step: string }>(async ({ req, params }) => {
  const jar = await cookies();

  if (params.step === "status") {
    const pending = await unseal<GoogleProfile>(jar.get(PENDING)?.value, authSecret());
    return { enabled: googleEnabled(), pending: pending ? { name: pending.name, email: pending.email } : null };
  }
  if (!googleEnabled()) return back(req, "indisponivel");

  if (params.step === "start") {
    if (!checkRateLimit(`google:${clientIp(req)}`, 30)) return back(req, "limite");
    const p = startParams(req.url);
    const perfil = new URL(req.url).searchParams.get("perfil") ?? undefined;
    jar.set(FLOW, await seal({ state: p.state, nonce: p.nonce, verifier: p.verifier, perfil }, authSecret(), 10), cookieOpts(600));
    return NextResponse.redirect(p.url, 303);
  }

  if (params.step === "callback") {
    const url = new URL(req.url);
    const flow = await unseal<Flow>(jar.get(FLOW)?.value, authSecret());
    jar.delete(FLOW);
    if (url.searchParams.get("error")) return back(req, "cancelado");
    const code = url.searchParams.get("code");
    if (!flow || !code || url.searchParams.get("state") !== flow.state) return back(req, "expirado");
    let profile: GoogleProfile;
    try { profile = await finishLogin(req.url, code, flow.verifier, flow.nonce); }
    catch (e) { console.error("[google]", e); return back(req, "falhou"); }

    const db = await getDb();
    let [user] = await db.select().from(s.users).where(eq(s.users.googleSub, profile.sub));
    if (!user) {
      // Mesmo e-mail de uma conta existente: o Google confirmou que a pessoa é dona dele, então a conta é vinculada.
      const [byEmail] = await db.select().from(s.users).where(eq(s.users.email, profile.email));
      if (byEmail) {
        // Contas da equipe entram só com senha: o painel não fica a um clique de uma conta Google.
        if (STAFF.has(byEmail.role)) return back(req, "equipe");
        if (byEmail.status !== "active") return back(req, "conta-inativa");
        [user] = await db.update(s.users).set({ googleSub: profile.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() }).where(eq(s.users.id, byEmail.id)).returning();
        await audit(user.id, "google.link", "user", user.id);
      }
    }
    if (user) {
      if (user.status !== "active") return back(req, "conta-inativa");
      if (STAFF.has(user.role)) return back(req, "equipe");
      await startSession(user.id);
      await audit(user.id, "google.login", "user", user.id);
      // Com verificação em duas etapas, o Google não basta: falta o código do aplicativo autenticador.
      if (user.totpEnabledAt) return NextResponse.redirect(new URL("/entrar?etapa=codigo", req.url), 303);
      return NextResponse.redirect(new URL(HOME[user.role], req.url), 303);
    }
    // Conta nova: falta escolher o perfil e aceitar os termos. O perfil do Google espera num cookie assinado.
    jar.set(PENDING, await seal(profile, authSecret(), 15), cookieOpts(900));
    return NextResponse.redirect(new URL(`/entrar?google=novo${flow.perfil ? `&perfil=${encodeURIComponent(flow.perfil)}` : ""}`, req.url), 303);
  }
  throw new ApiError(404, "Recurso não encontrado.");
});

export const POST = publicRoute<{ step: string }>(async ({ req, params }) => {
  if (params.step !== "complete") throw new ApiError(404, "Recurso não encontrado.");
  const jar = await cookies();
  const profile = await unseal<GoogleProfile>(jar.get(PENDING)?.value, authSecret());
  if (!profile) throw new ApiError(400, "O tempo para concluir passou. Toque em Continuar com Google de novo.");
  const v = await body(req, completeSchema);
  const db = await getDb();
  const [clash] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, profile.email));
  if (clash) throw new ApiError(409, "Já existe uma conta com este e-mail. Entre por ela.");
  const [user] = await db.insert(s.users).values({
    name: v.name, email: profile.email, googleSub: profile.sub, emailVerifiedAt: new Date(), role: v.role, privacyAcceptedAt: new Date(),
    // Sem senha escolhida: um valor aleatório. Se quiser entrar com senha, a pessoa cria pelo "Esqueci minha senha".
    passwordHash: await hashPassword(randomBytes(32).toString("hex")),
  }).returning();
  jar.delete(PENDING);
  await audit(user.id, "register", "user", user.id, { role: v.role, via: "google" });
  await startSession(user.id);
  return publicUser(user);
});
