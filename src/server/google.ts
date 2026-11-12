import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

/**
 * Entrar com Google (OpenID Connect, fluxo de código com PKCE). Gratuito: basta criar a credencial
 * "ID do cliente OAuth" no Google Cloud e definir GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
 * Os endereços do Google podem ser trocados por variáveis só para os testes automáticos.
 */
const env = (k: string, d: string) => process.env[k] || d;
export const googleUrls = () => ({
  auth: env("GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth"),
  token: env("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token"),
  jwks: env("GOOGLE_JWKS_URL", "https://www.googleapis.com/oauth2/v3/certs"),
  issuers: env("GOOGLE_ISSUER", "https://accounts.google.com,accounts.google.com").split(","),
});

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** Endereço de retorno: APP_URL em produção (atrás de proxy), senão o próprio endereço do pedido. */
export const callbackUrl = (reqUrl: string) => `${process.env.APP_URL || new URL(reqUrl).origin}/api/auth/google/callback`;

const b64url = (b: Buffer) => b.toString("base64url");

export function startParams(reqUrl: string) {
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL(googleUrls().auth);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: callbackUrl(reqUrl), response_type: "code", scope: "openid email profile",
    state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, nonce, verifier };
}

export type GoogleProfile = { sub: string; email: string; name: string };

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksUrl = "";

/** Troca o código pelo token e confere a assinatura, o emissor, o destinatário e o nonce. */
export async function finishLogin(reqUrl: string, code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
  const urls = googleUrls();
  const res = await fetch(urls.token, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({
      code, code_verifier: verifier, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(reqUrl), grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new Error("sem id_token");
  if (!jwks || jwksUrl !== urls.jwks) { jwks = createRemoteJWKSet(new URL(urls.jwks)); jwksUrl = urls.jwks; }
  const { payload } = await jwtVerify(idToken, jwks, { issuer: urls.issuers, audience: process.env.GOOGLE_CLIENT_ID! });
  if (payload.nonce !== nonce) throw new Error("nonce");
  if (!payload.sub || typeof payload.email !== "string" || payload.email_verified !== true) throw new Error("e-mail não verificado");
  return { sub: payload.sub, email: payload.email.toLowerCase(), name: typeof payload.name === "string" ? payload.name : "" };
}

/** Dados temporários em cookie assinado: o estado do login e, para conta nova, o perfil até a pessoa confirmar. */
export async function seal(data: Record<string, unknown>, secret: Uint8Array, minutes: number) {
  return new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${minutes}m`).sign(secret);
}
export async function unseal<T>(token: string | undefined, secret: Uint8Array): Promise<T | null> {
  if (!token) return null;
  try { return (await jwtVerify(token, secret)).payload as T; } catch { return null; }
}
