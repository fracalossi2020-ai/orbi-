import { expect, test } from "@playwright/test";
import { apiClient, BASE, passengerApi, PNG, signUp, uniquePhone } from "./helpers";
import { totpAt, totpStep } from "../src/server/security";

test.describe.configure({ mode: "serial" });

test("cabeçalhos de segurança: CSP com nonce, sem moldura, sem farejar tipo", async ({ page }) => {
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  expect(h["x-powered-by"]).toBeUndefined();
  // Cada página tem um nonce novo
  const again = await page.request.get("/");
  expect(again.headers()["content-security-policy"]).not.toBe(h["content-security-policy"]);
  // A página funciona com a política: o mapa carrega e não há violação no console.
  // (No topo, o mapa abre quando a pessoa escolhe um endereço; o endereço é fixo, o teste é da política.)
  const violations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|CSP/i.test(m.text())) violations.push(m.text().slice(0, 200)); });
  await page.route("**/api/geo/search*", (r) => r.fulfill({ json: { places: [{ label: "Centro", detail: "Ipatinga", lat: -19.468, lng: -42.537, kind: "area", inArea: true }] } }));
  await page.goto("/");
  await page.getByRole("combobox", { name: "Local de chegada" }).fill("Centro");
  await page.getByRole("option").first().click();
  await expect(page.locator(".maplibregl-canvas").first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);
  expect(violations).toEqual([]);
  // Respostas da API não ficam em cache
  const api = await page.request.get("/api/me");
  expect(api.headers()["cache-control"]).toBe("no-store");
});

test("ações vindas de outro site são recusadas; corpo precisa ser JSON", async () => {
  const c = await apiClient();
  const cross = await c.post("/api/auth/login", { data: { identifier: "x@y.com", password: "x" }, headers: { Origin: "https://site-malicioso.example" } });
  expect(cross.status()).toBe(403);
  const site = await c.post("/api/auth/login", { data: { identifier: "x@y.com", password: "x" }, headers: { "Sec-Fetch-Site": "cross-site" } });
  expect(site.status()).toBe(403);
  const form = await c.post("/api/auth/login", { form: { identifier: "x@y.com", password: "x" } });
  expect(form.status()).toBe(415);
});

test("login: trava por conta mesmo trocando de IP; senha fraca é recusada", async () => {
  const p = await passengerApi();
  const me = (await (await p.get("/api/me")).json()).user;
  let last = 0;
  for (let i = 0; i < 10; i++) {
    const c = await apiClient(); // cada tentativa de um "IP" diferente
    last = (await c.post("/api/auth/login", { data: { identifier: me.email, password: `errada-${i}` } })).status();
  }
  expect(last).toBe(429);
  const weak = await (await apiClient()).post("/api/auth/register", { data: { name: "Sara Teste Fraca", email: `fraca${Date.now()}@e2e.prumo.test`, password: "12345678", role: "passenger", acceptPrivacy: true } });
  expect(weak.status()).toBe(400);
  expect((await weak.json()).error).toContain("fácil de adivinhar");
});

test("sair encerra a sessão de verdade; trocar a senha desconecta os outros aparelhos", async ({ browser }) => {
  const a = await browser.newContext({ baseURL: BASE });
  const pa = await a.newPage();
  const phone = uniquePhone();
  await signUp(pa, "passageiro", phone, "Olga Teste Sessao");
  // Cópia do cookie (como se tivesse sido roubado)
  const stolen = (await a.cookies()).find((c) => c.name === "prumo_session")!;
  const b = await browser.newContext({ baseURL: BASE });
  await b.addCookies([stolen]);
  expect((await (await b.request.get("/api/me")).json()).user?.phone).toBe(phone);
  // Login num segundo aparelho
  const c = await browser.newContext({ baseURL: BASE });
  const login = await c.request.post("/api/auth/login", { data: { identifier: phone, password: "senha-de-teste" } });
  expect(login.ok()).toBeTruthy();
  await pa.goto("/passageiro/conta");
  await expect(pa.getByTestId("sessions").getByText("este aparelho")).toBeVisible({ timeout: 15000 });
  // Troca de senha no aparelho A: o outro aparelho (C) sai; o A continua.
  // (O cookie copiado em B é a própria sessão de A: ele só deixa de valer quando A sai, conferido no fim.)
  expect((await pa.request.post("/api/auth/password-change", { data: { current: "senha-de-teste", password: "nova-senha-forte-9" } })).ok()).toBeTruthy();
  expect((await (await c.request.get("/api/me")).json()).user).toBeNull();
  expect((await (await pa.request.get("/api/me")).json()).user?.phone).toBe(phone);
  // Sair: o cookie antigo deixa de valer mesmo se alguém tiver guardado.
  const before = (await a.cookies()).find((x) => x.name === "prumo_session")!;
  await pa.request.post("/api/auth/logout", { data: {} });
  const d = await browser.newContext({ baseURL: BASE });
  await d.addCookies([before]);
  expect((await (await d.request.get("/api/me")).json()).user).toBeNull();
});

test("verificação em duas etapas: ativar, entrar com código, recuperação e código repetido", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  const phone = uniquePhone();
  await signUp(page, "passageiro", phone, "Vitor Teste Duas Etapas");
  await page.goto("/passageiro/conta");
  const mfa = page.getByTestId("mfa");
  await mfa.getByRole("button", { name: "Ativar a verificação em duas etapas" }).click();
  const secret = (await mfa.getByTestId("mfa-secret").textContent())!.replace(/\s/g, "");
  await mfa.getByLabel("Código de 6 números do aplicativo").fill("000000");
  await mfa.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(mfa.getByText(/Código incorreto/)).toBeVisible();
  await mfa.getByLabel("Código de 6 números do aplicativo").fill(totpAt(secret, totpStep()));
  await mfa.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(mfa.getByTestId("recovery-codes").locator("li")).toHaveCount(10, { timeout: 15000 });
  const codes = (await mfa.getByTestId("recovery-codes").locator("li").allTextContents()).map((x) => x.trim());
  expect(codes).toHaveLength(10);
  await mfa.getByRole("button", { name: "Já guardei" }).click();
  await expect(mfa.getByText(/Ativa\./)).toBeVisible();

  // Outro aparelho: senha certa não basta
  const other = await browser.newContext({ baseURL: BASE });
  const op = await other.newPage();
  const r = await op.request.post("/api/auth/login", { data: { identifier: phone, password: "senha-de-teste" } });
  expect(await r.json()).toEqual({ mfaRequired: true });
  expect((await (await op.request.get("/api/me")).json()).user).toBeNull();
  expect((await op.request.get("/api/rides")).status()).toBe(401);
  // Código errado, depois o certo (do próximo passo: o atual já foi usado na ativação)
  expect((await op.request.post("/api/auth/mfa", { data: { code: "123456" } })).status()).toBe(400);
  expect((await op.request.post("/api/auth/mfa", { data: { code: totpAt(secret, totpStep() + 1) } })).ok()).toBeTruthy();
  expect((await (await op.request.get("/api/me")).json()).user?.phone).toBe(phone);

  // Pela tela: código de recuperação, que vale uma vez só
  const third = await browser.newContext({ baseURL: BASE });
  const tp = await third.newPage();
  await tp.goto("/entrar");
  await tp.getByLabel("Celular com DDD").fill(phone);
  await tp.getByRole("button", { name: "Continuar" }).click();
  await tp.getByPlaceholder("Senha").fill("senha-de-teste");
  await tp.getByRole("button", { name: "Entrar" }).click();
  await expect(tp.getByRole("heading", { name: "Código do aplicativo" })).toBeVisible();
  await tp.getByRole("button", { name: /usar código de recuperação/ }).click();
  await tp.getByLabel("Código de recuperação").fill(codes[0]);
  await tp.getByRole("button", { name: "Entrar" }).click();
  await tp.waitForURL("**/passageiro");
  const fourth = await browser.newContext({ baseURL: BASE });
  await fourth.request.post("/api/auth/login", { data: { identifier: phone, password: "senha-de-teste" } });
  expect((await fourth.request.post("/api/auth/mfa", { data: { code: codes[0] } })).status()).toBe(400);
});

test("documento disfarçado de foto é recusado", async () => {
  const c = await apiClient();
  const id = Date.now().toString(36);
  expect((await c.post("/api/auth/register", { data: { name: "Davi Teste Arquivo", email: `arq${id}@e2e.prumo.test`, password: "senha-de-teste", role: "driver", acceptPrivacy: true } })).ok()).toBeTruthy();
  const fake = await c.post("/api/driver/documents", { multipart: { kind: "cnh", file: { name: "foto.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") } } });
  expect(fake.status()).toBe(400);
  const real = await c.post("/api/driver/documents", { multipart: { kind: "cnh", file: { name: "foto.png", mimeType: "image/png", buffer: PNG } } });
  expect(real.ok()).toBeTruthy();
});
