import fs from "node:fs";
import path from "node:path";
import { expect, request, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const BASE = "http://localhost:3100";
export const IPATINGA = { latitude: -19.4683, longitude: -42.5367 };
export const ADMIN = { identifier: "admin@e2e.prumo.test", password: "e2e-admin-password" };

let seq = 0;
export const unique = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

/** Documentos com cálculo correto, gerados só para o banco descartável dos testes. */
export function makeCpf() {
  const base = digits(9);
  const dv = (s: string) => { let t = 0; for (let i = 0; i < s.length; i++) t += Number(s[i]) * (s.length + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  const a = base + dv(base);
  return a + dv(a);
}
export function makeCnh() {
  for (;;) {
    const b = digits(9);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < 9; i++) { s1 += Number(b[i]) * (9 - i); s2 += Number(b[i]) * (i + 1); }
    const d1 = s1 % 11, d2 = s2 % 11;
    if (d1 < 10 && d2 < 10) return `${b}${d1}${d2}`;
  }
}
export const DRIVER_ADDRESS = { cep: "35160039", number: "100" };
/** Regularização do motorista de teste: maior de idade, CNH B com EAR, válida, habilitado há anos. */
export const DRIVER_REG = { birthDate: "1990-05-10", cnhCategory: "B", cnhFirstLicenseAt: "2012-03-01", cnhExpiresAt: `${new Date().getFullYear() + 4}-12-31`, cnhEar: true, inss: true, acceptTerms: true };
export const VEHICLE_REG = { doors: 4, seats: 5, airConditioning: true, ownership: "proprio", noRedPlate: true };
/** Documentos exigidos pelo padrão do painel. */
export const REQUIRED_DOCS = ["cnh", "crlv", "selfie", "antecedentes", "residencia"];

let clientSeq = 0;
/** Cada cliente tem o próprio endereço: assim os limites por endereço valem por cenário, não para a suíte toda. */
export async function apiClient() { return request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": `10.0.${Math.floor(++clientSeq / 200)}.${clientSeq % 200}` } }); }

export async function adminApi() {
  const c = await apiClient();
  expect((await c.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  return c;
}

export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

/** Cria e aprova um motorista só com a API, para cenários que não testam o cadastro. */
export async function approvedDriverApi(admin: APIRequestContext, lat = IPATINGA.latitude, lng = IPATINGA.longitude) {
  const c = await apiClient();
  const id = unique();
  const reg = await c.post("/api/auth/register", { data: { name: `Motorista ${id}`, email: `m${id}@e2e.prumo.test`, password: "senha-de-teste", role: "driver", acceptPrivacy: true } });
  expect(reg.ok()).toBeTruthy();
  const userId = (await reg.json()).id as string;
  const state = await (await c.get("/api/driver/state")).json();
  const region = state.regions.find((r: { name: string }) => r.name === "Ipatinga");
  expect((await c.post("/api/driver/onboarding", { data: { cpf: makeCpf(), cnh: makeCnh(), regionId: region.id, ...DRIVER_ADDRESS, ...DRIVER_REG } })).ok()).toBeTruthy();
  for (const kind of REQUIRED_DOCS) {
    const up = await c.post("/api/driver/documents", { multipart: { kind, file: { name: "d.png", mimeType: "image/png", buffer: PNG } } });
    expect(up.ok()).toBeTruthy();
    expect((await admin.post(`/api/admin/documents/${(await up.json()).id}`, { data: { status: "approved" } })).ok()).toBeTruthy();
  }
  const cat = state.categories.find((x: { slug?: string; name: string }) => x.name === "Essencial");
  const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const plate = `${letter()}${letter()}${letter()}${digits(1)}${letter()}${digits(2)}`;
  const v = await c.post("/api/driver/vehicle", { data: { categoryId: cat.id, make: "Marca", model: "Modelo", color: "Prata", plate, year: 2022, ...VEHICLE_REG } });
  expect(v.ok()).toBeTruthy();
  expect((await admin.post(`/api/admin/vehicles/${(await v.json()).id}`, { data: { status: "approved" } })).ok()).toBeTruthy();
  expect((await admin.post(`/api/admin/drivers/${userId}`, { data: { status: "approved" } })).ok()).toBeTruthy();
  expect((await c.post("/api/driver/status", { data: { online: true, lat, lng } })).ok()).toBeTruthy();
  return { c, userId, categoryId: cat.id as string };
}

export async function passengerApi() {
  const c = await apiClient();
  const id = unique();
  const reg = await c.post("/api/auth/register", { data: { name: `Passageiro ${id}`, email: `p${id}@e2e.prumo.test`, password: "senha-de-teste", role: "passenger", acceptPrivacy: true } });
  expect(reg.ok()).toBeTruthy();
  return c;
}

export const RIDE_BODY = (categoryId: string, extra: object = {}) => ({
  origin: { label: "Origem de teste", lat: -19.47, lng: -42.54 }, dest: { label: "Destino de teste", lat: -19.5186, lng: -42.6289 },
  categoryId, paymentMethod: "cash", ...extra,
});

export async function gpsContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ geolocation: IPATINGA, permissions: ["geolocation"], baseURL: BASE, viewport: { width: 420, height: 860 } });
}

/** Cria a conta pela entrada única, passando por cada etapa. */
export async function signUp(page: Page, perfil: "motorista" | "passageiro", phone: string, name: string, goTo = true) {
  if (goTo) await page.goto(`/cadastro?perfil=${perfil}`);
  await page.getByLabel("Celular com DDD").fill(phone);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome completo").fill(name);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("E-mail de contato").fill(`c${phone}@e2e.prumo.test`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nova senha").fill("senha-de-teste");
  await page.locator('input[name="accept"]').check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(`**/${perfil}`);
}

/** Último código enviado para o endereço, lido da caixa de saída local dos testes. */
export function lastCode(email: string) {
  const dir = path.join(process.cwd(), ".data-e2e", "outbox");
  const file = fs.readdirSync(dir).filter((f) => f.includes(email)).sort().at(-1);
  if (!file) throw new Error(`Nenhum e-mail para ${email}`);
  return fs.readFileSync(path.join(dir, file), "utf8").match(/\b(\d{6})\b/)![1];
}

export const uniquePhone = () => `319${digits(8)}`;

export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/entrar");
  if (identifier.includes("@")) {
    await page.getByRole("button", { name: "Usar e-mail" }).click();
    await page.getByLabel("E-mail").fill(identifier);
  } else {
    await page.getByLabel("Celular com DDD").fill(identifier);
  }
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
