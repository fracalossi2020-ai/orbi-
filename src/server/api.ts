import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { currentUser, type SessionUser } from "./auth";
import { can, STAFF, type Resource, type Role } from "@/domain/permissions";
import { getDb, schema as s } from "@/db";
import { ensureSweeper, RideError } from "./rides";
import { clientIp, rateLimit } from "./security";

/** code: identificador estável para o app reagir (por exemplo, "mfa_setup" leva à tela de ativar as duas etapas). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

type Ctx<P> = { req: NextRequest; user: SessionUser; params: P };
type PublicCtx<P> = { req: NextRequest; user: SessionUser | null; params: P };

const trustProxy = () => process.env.TRUST_PROXY === "true" || process.env.NODE_ENV !== "production";

/**
 * Proteção contra ações disparadas por outros sites (CSRF). Ações só valem vindas do próprio site:
 * confere o Origin e, na falta dele, o Sec-Fetch-Site que o navegador envia. Por trás de um proxy
 * (hospedagem, túnel de teste), o endereço público vem em x-forwarded-host, aceito só com TRUST_PROXY.
 */
function sameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  if (!origin) return !site || site === "same-origin" || site === "none";
  let host: string;
  try { host = new URL(origin).host; } catch { return false; }
  if (host === req.headers.get("host")) return true;
  if (trustProxy() && host === req.headers.get("x-forwarded-host")) return true;
  try { if (process.env.APP_URL && host === new URL(process.env.APP_URL).host) return true; } catch { /* APP_URL inválida */ }
  // Teste no celular pelo túnel da Cloudflare (npm run celular): só fora de produção.
  return process.env.NODE_ENV !== "production" && host.endsWith(".trycloudflare.com");
}

// Respostas da API têm dados pessoais: nada de cache no navegador ou em proxies, salvo quando a rota diz o contrário.
const noStore = (res: Response) => {
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
  return res;
};

function respond(e: unknown) {
  if (e instanceof ApiError) return noStore(NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e.status }));
  if (e instanceof RideError) return noStore(NextResponse.json({ error: e.message }, { status: e.status }));
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return noStore(NextResponse.json({ error: first?.message ?? "Dados inválidos.", field: first?.path.join(".") }, { status: 400 }));
  }
  console.error("[api]", e);
  return noStore(NextResponse.json({ error: "Erro interno. Tente de novo em instantes." }, { status: 500 }));
}

type RouteCtx = { params: Promise<Record<string, string | string[]>> };

/** Teto geral por IP para ações (POST, PATCH, DELETE): segura robôs sem atrapalhar uso normal. */
const WRITE_LIMIT = Number(process.env.PRUMO_WRITE_LIMIT) || 300;

export function publicRoute<P = Record<string, string>>(fn: (ctx: PublicCtx<P>) => Promise<unknown>) {
  return async (req: NextRequest, rc: RouteCtx) => {
    try {
      if (!sameOrigin(req)) throw new ApiError(403, "Origem não permitida.");
      if (req.method !== "GET" && req.method !== "HEAD" && !rateLimit(`write:${clientIp(req)}`, WRITE_LIMIT, 5 * 60_000)) {
        throw new ApiError(429, "Muitas ações em pouco tempo. Aguarde alguns minutos.");
      }
      ensureSweeper();
      const out = await fn({ req, user: await currentUser(), params: (await rc.params) as P });
      return noStore(out instanceof Response ? out : NextResponse.json(out ?? { ok: true }));
    } catch (e) { return respond(e); }
  };
}

/** Equipe sem verificação em duas etapas não usa o painel (exceto se desligado de propósito em ambiente de teste). */
const staffMfaRequired = () => process.env.PRUMO_REQUIRE_STAFF_MFA !== "false";

export function route<P = Record<string, string>>(fn: (ctx: Ctx<P>) => Promise<unknown>, opts: { roles?: Role[] } = {}) {
  return publicRoute<P>(async ({ req, user, params }) => {
    if (!user) throw new ApiError(401, "Entre na sua conta para continuar.");
    if (opts.roles && !opts.roles.includes(user.role)) throw new ApiError(403, "Sua conta não tem acesso a este recurso.");
    if (STAFF.includes(user.role) && staffMfaRequired() && !user.totpEnabledAt && req.nextUrl.pathname.startsWith("/api/admin")) {
      throw new ApiError(403, "Para usar o painel, ative a verificação em duas etapas na sua conta.", "mfa_setup");
    }
    return fn({ req, user, params });
  });
}

export function assertCan(user: SessionUser, resource: Resource, mode: "read" | "write") {
  if (!can(user.role, resource, mode)) throw new ApiError(403, "Seu nível de acesso não permite esta ação.");
}

/** Tamanho máximo de um corpo JSON. */
const MAX_JSON = 64 * 1024;

/** Lê o corpo como JSON. Exige o tipo JSON: formulários de outros sites não conseguem enviar esse tipo sem permissão. */
export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) throw new ApiError(415, "Envie os dados em JSON.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_JSON) throw new ApiError(413, "Dados grandes demais.");
  let json: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_JSON) throw new Error("grande");
    json = JSON.parse(text);
  } catch { throw new ApiError(400, "Corpo do pedido inválido."); }
  return schema.parse(json);
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string | null, meta?: Record<string, unknown>) {
  const db = await getDb();
  await db.insert(s.auditLog).values({ actorId, action, entity, entityId: entityId ?? null, meta });
}
