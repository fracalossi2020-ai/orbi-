/** Sobe a versão de produção com um banco descartável, usado só pelos testes de ponta a ponta. */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// CEP de teste fixo: os testes não dependem de um serviço externo.
const cepServer = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(req.url?.includes("35160039") ? { logradouro: "Rua de Teste", bairro: "Centro", localidade: "Ipatinga", uf: "MG" } : { erro: "true" }));
}).listen(3101);

/**
 * Provedor OpenID de teste, no lugar do Google: mesmo protocolo (código + PKCE + id_token RS256 assinado).
 * O teste escolhe quem "entra" com POST /next-user antes de clicar no botão.
 */
const keys = generateKeyPair("RS256");
const OIDC = "http://localhost:3102";
let nextUser = { sub: "e2e-sub", email: "google@e2e.prumo.test", name: "Pessoa Google", email_verified: true };
const codes = new Map<string, { nonce: string; user: typeof nextUser }>();
const oidcServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", OIDC);
  const readBody = () => new Promise<string>((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); });
  if (url.pathname === "/next-user" && req.method === "POST") { nextUser = { email_verified: true, ...JSON.parse(await readBody()) }; res.end("ok"); return; }
  if (url.pathname === "/auth") {
    const code = Math.random().toString(36).slice(2);
    codes.set(code, { nonce: url.searchParams.get("nonce") ?? "", user: nextUser });
    const back = new URL(url.searchParams.get("redirect_uri")!);
    back.searchParams.set("code", code);
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { Location: back.toString() }).end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/jwks") { const jwk = { ...(await exportJWK((await keys).publicKey)), kid: "e2e", alg: "RS256", use: "sig" }; res.end(JSON.stringify({ keys: [jwk] })); return; }
  if (url.pathname === "/token" && req.method === "POST") {
    const form = new URLSearchParams(await readBody());
    const entry = codes.get(form.get("code") ?? "");
    codes.delete(form.get("code") ?? "");
    if (!entry || form.get("client_id") !== "e2e-client" || !form.get("code_verifier")) { res.writeHead(400).end(JSON.stringify({ error: "invalid_grant" })); return; }
    const { sub, ...claims } = entry.user;
    const idToken = await new SignJWT({ ...claims, nonce: entry.nonce }).setProtectedHeader({ alg: "RS256", kid: "e2e" })
      .setIssuer(OIDC).setAudience("e2e-client").setSubject(sub).setIssuedAt().setExpirationTime("5m").sign((await keys).privateKey);
    res.end(JSON.stringify({ id_token: idToken, access_token: "x", token_type: "Bearer" }));
    return;
  }
  res.writeHead(404).end("{}");
}).listen(3102);

const dir = path.join(process.cwd(), ".data-e2e");
fs.rmSync(dir, { recursive: true, force: true });

const env = {
  ...process.env, PRUMO_DATA_DIR: dir, PRUMO_ALLOW_EMBEDDED_DB: "true", ALLOW_MANUAL_LOCATION: "true", AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only",
  PRUMO_ADMIN_PASSWORD: "e2e-admin-password", CEP_URL: "http://localhost:3101", PRUMO_SKIP_EMAIL_DNS: "true", PRUMO_MAIL_OUTBOX: "true",
  GOOGLE_CLIENT_ID: "e2e-client", GOOGLE_CLIENT_SECRET: "e2e-secret", GOOGLE_AUTH_URL: `${OIDC}/auth`, GOOGLE_TOKEN_URL: `${OIDC}/token`,
  GOOGLE_JWKS_URL: `${OIDC}/jwks`, GOOGLE_ISSUER: OIDC,
  // Os testes entram no painel muitas vezes seguidas (o mesmo código do autenticador não vale duas vezes em 30 s)
  // e fazem centenas de ações do mesmo computador. A verificação em duas etapas tem teste próprio, com passageiro.
  PRUMO_REQUIRE_STAFF_MFA: process.env.PRUMO_REQUIRE_STAFF_MFA ?? "false", PRUMO_WRITE_LIMIT: "100000",
};
execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/create-admin.ts", "Admin de teste", "admin@e2e.prumo.test", "admin"], { env, stdio: "inherit" });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100"], { env: { ...env, NODE_ENV: "production" }, stdio: "inherit" });
process.on("exit", () => { cepServer.close(); oidcServer.close(); });
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());
server.on("exit", (code) => process.exit(code ?? 0));
