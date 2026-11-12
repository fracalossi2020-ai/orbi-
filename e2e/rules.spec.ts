import { expect, test } from "@playwright/test";
import { adminApi, apiClient, approvedDriverApi, BASE, DRIVER_ADDRESS, DRIVER_REG, VEHICLE_REG, lastCode, login, makeCnh, makeCpf, passengerApi, RIDE_BODY, unique, uniquePhone } from "./helpers";

test.describe.configure({ mode: "serial" });

test("controle de acesso por perfil", async () => {
  const anon = await apiClient();
  expect((await anon.get("/api/admin/dashboard")).status()).toBe(401);
  expect((await anon.get("/api/driver/state")).status()).toBe(401);

  const p = await passengerApi();
  expect((await p.get("/api/admin/dashboard")).status()).toBe(403);
  expect((await p.get("/api/driver/state")).status()).toBe(403);
  expect((await p.get("/api/admin/r/tariffs")).status()).toBe(403);

  const admin = await adminApi();
  const email = `atendente${unique()}@e2e.prumo.test`;
  expect((await admin.post("/api/admin/staff", { data: { name: "Ana Atendente", email, password: "senha-atendente-1", role: "atendente" } })).ok()).toBeTruthy();
  const at = await apiClient();
  expect((await at.post("/api/auth/login", { data: { identifier: email, password: "senha-atendente-1" } })).ok()).toBeTruthy();
  expect((await at.get("/api/admin/tickets")).ok()).toBeTruthy();
  expect((await at.get("/api/admin/r/tariffs")).status()).toBe(403);
  const tariffs = await (await admin.get("/api/admin/r/tariffs")).json();
  expect((await at.patch(`/api/admin/r/tariffs/${tariffs.rows[0].id}`, { data: { commissionBps: 100 } })).status()).toBe(403);
  expect((await at.post("/api/admin/staff", { data: { name: "Invasor", email: `x${unique()}@e2e.prumo.test`, password: "senha-qualquer-1", role: "admin" } })).status()).toBe(403);
});

test("cadastro público não cria administrador", async () => {
  const c = await apiClient();
  const res = await c.post("/api/auth/register", { data: { name: "Falso Admin", email: `f${unique()}@e2e.prumo.test`, password: "senha-de-teste", role: "admin", acceptPrivacy: true } });
  expect(res.status()).toBe(400);
});

test("pagamento indisponível é recusado no servidor", async () => {
  const p = await passengerApi();
  const admin = await adminApi();
  const cats = await (await admin.get("/api/admin/r/categories")).json();
  const res = await p.post("/api/rides", { data: RIDE_BODY(cats.rows[0].id, { paymentMethod: "pix" }) });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toContain("forma de pagamento");
});

test("fora da área de atendimento é recusado", async () => {
  const p = await passengerApi();
  const res = await p.post("/api/rides?quote", { data: { origin: { lat: -23.55, lng: -46.63 }, dest: { lat: -19.47, lng: -42.54 } } });
  expect(res.status()).toBe(409);
});

test("recusa e falta de resposta passam a corrida ao próximo motorista", async () => {
  const admin = await adminApi();
  expect((await admin.post("/api/admin/settings", { data: { dispatch: { offerTimeoutS: 5, searchTimeoutS: 180 } } })).ok()).toBeTruthy();
  const d1 = await approvedDriverApi(admin, -19.4701, -42.5401);
  const d2 = await approvedDriverApi(admin, -19.4702, -42.5402);
  const d3 = await approvedDriverApi(admin, -19.4703, -42.5403);
  const p = await passengerApi();
  const ride = await (await p.post("/api/rides", { data: RIDE_BODY(d1.categoryId) })).json();
  expect(ride.status).toBe("searching");

  const offerOf = async (d: typeof d1) => (await (await d.c.get("/api/driver/state")).json()).offer;
  const findHolder = async () => { for (const d of [d1, d2, d3]) { const o = await offerOf(d); if (o) return { d, o }; } return null; };

  // Primeira oferta: recusa
  const first = await findHolder();
  expect(first).not.toBeNull();
  expect((await first!.d.c.post(`/api/driver/offers/${first!.o.id}`, { data: { accept: false } })).ok()).toBeTruthy();

  // Segunda oferta: outro motorista, e não responde
  const second = await findHolder();
  expect(second).not.toBeNull();
  expect(second!.d.userId).not.toBe(first!.d.userId);

  // Quem está com a oferta expira, e a corrida segue para o terceiro
  let third = null;
  for (let i = 0; i < 12 && !third; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const h = await findHolder();
    if (h && h.d.userId !== second!.d.userId && h.d.userId !== first!.d.userId) third = h;
  }
  expect(third).not.toBeNull();

  // Aceite tardio de quem já perdeu a oferta falha
  expect((await second!.d.c.post(`/api/driver/offers/${second!.o.id}`, { data: { accept: true } })).status()).toBe(409);
  expect((await third!.d.c.post(`/api/driver/offers/${third!.o.id}`, { data: { accept: true } })).ok()).toBeTruthy();

  // Passageiro não abre segunda corrida com uma em andamento
  expect((await p.post("/api/rides", { data: RIDE_BODY(d1.categoryId) })).status()).toBe(409);

  // Motorista desiste antes de chegar: volta à fila, sem deixar o passageiro na mão
  expect((await third!.d.c.post(`/api/rides/${ride.id}/cancel`, { data: { reason: "teste" } })).ok()).toBeTruthy();
  const after = await (await p.get("/api/rides")).json();
  expect(after.active.status).toBe("searching");
  expect((await p.post(`/api/rides/${ride.id}/cancel`, { data: { reason: "teste" } })).ok()).toBeTruthy();

  for (const d of [d1, d2, d3]) await d.c.post("/api/driver/status", { data: { online: false } });
  await admin.post("/api/admin/settings", { data: { dispatch: { offerTimeoutS: 20, searchTimeoutS: 180 } } });
});

test("tarifa e cupom configurados no painel valem na corrida; cupom não reduz o líquido", async () => {
  const admin = await adminApi();
  const d = await approvedDriverApi(admin);
  const p = await passengerApi();
  const tariffs = (await (await admin.get("/api/admin/r/tariffs")).json()).rows;
  const regions = (await (await admin.get("/api/admin/r/regions")).json()).rows;
  const ipatinga = regions.find((r: { name: string }) => r.name === "Ipatinga");
  const t = tariffs.find((x: { regionId: string; categoryId: string }) => x.regionId === ipatinga.id && x.categoryId === d.categoryId);
  expect((await admin.patch(`/api/admin/r/tariffs/${t.id}`, { data: { commissionBps: 1000 } })).ok()).toBeTruthy();

  const code = `T${unique()}`.toUpperCase();
  expect((await admin.post("/api/admin/r/coupons", { data: { code, kind: "fixed", value: 200, active: true } })).ok()).toBeTruthy();

  const ride = await (await p.post("/api/rides", { data: RIDE_BODY(d.categoryId, { couponCode: code }) })).json();
  expect(ride.discountCents).toBe(200);
  const offer = (await (await d.c.get("/api/driver/state")).json()).offer;
  expect(offer.commissionBps).toBe(1000);
  expect(offer.driverNetCents).toBe(offer.grossCents - Math.round(offer.grossCents * 0.1));

  expect((await d.c.post(`/api/driver/offers/${offer.id}`, { data: { accept: true } })).ok()).toBeTruthy();
  for (const a of ["arrive", "start", "complete"]) expect((await d.c.post(`/api/rides/${ride.id}/${a}`, { data: {} })).ok()).toBeTruthy();

  // Encerrar de novo não duplica lançamento
  expect((await d.c.post(`/api/rides/${ride.id}/complete`, { data: {} })).status()).toBe(409);

  const fin = await (await d.c.get("/api/driver/finance?period=day")).json();
  expect(fin.entries).toHaveLength(1);
  expect(fin.balanceCents).toBe(offer.driverNetCents - ride.totalCents);
  expect(fin.summary.netCents).toBe(offer.driverNetCents);

  // Saque além do saldo é recusado
  expect((await d.c.post("/api/driver/withdrawals", { data: { amountCents: 5000, pixKey: "teste@e2e.prumo.test" } })).status()).toBe(409);

  // Avaliar duas vezes é recusado
  expect((await p.post(`/api/rides/${ride.id}/rate`, { data: { stars: 5 } })).ok()).toBeTruthy();
  expect((await p.post(`/api/rides/${ride.id}/rate`, { data: { stars: 1 } })).status()).toBe(409);

  await d.c.post("/api/driver/status", { data: { online: false } });
});

test("LGPD: exportar e excluir conta anonimiza os dados", async () => {
  const p = await passengerApi();
  const data = await (await p.get("/api/me/export")).json();
  expect(data.profile.email).toContain("@");
  expect(data.profile.passwordHash).toBeUndefined();
  expect((await p.delete("/api/me")).ok()).toBeTruthy();
  const after = await (await p.get("/api/me")).json();
  expect(after.user).toBeNull();
});

test("documento só é acessível à equipe", async () => {
  const admin = await adminApi();
  const d = await approvedDriverApi(admin);
  const docId = (await (await d.c.get("/api/driver/state")).json()).docs[0].id;
  expect((await admin.get(`/api/admin/documents/${docId}/file`)).ok()).toBeTruthy();
  expect((await d.c.get(`/api/admin/documents/${docId}/file`)).status()).toBe(403);
  await d.c.post("/api/driver/status", { data: { online: false } });
});

test("formulário público de interesse exige consentimento", async () => {
  const c = await apiClient();
  expect((await c.post("/api/public/leads", { data: { kind: "contato", name: "Teste", email: "t@e2e.prumo.test", consent: false } })).status()).toBe(400);
  expect((await c.post("/api/public/leads", { data: { kind: "contato", name: "Teste", email: "t@e2e.prumo.test", consent: true } })).ok()).toBeTruthy();
});

test("origem externa é bloqueada em ações", async () => {
  const c = await apiClient();
  const res = await c.post("/api/auth/login", { data: { identifier: "x", password: "y" }, headers: { Origin: "https://site-malicioso.example" } });
  expect(res.status()).toBe(403);
});

test("entrada única: mesma tela cria conta, reconhece quem voltou e o botão voltar retorna uma etapa", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const phone = uniquePhone();

  await page.goto("/entrar");
  await page.getByLabel("Celular com DDD").fill(`0${phone}`);
  await expect(page.getByLabel("Celular com DDD")).toHaveValue(`(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Como você vai usar a Orbi?" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Qual é o seu celular?" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Quero viajar" }).click();
  await page.getByLabel("Nome completo").fill("Pessoa de Teste");
  await page.getByRole("button", { name: "Continuar" }).click();
  const contact = `c${phone}@e2e.prumo.test`;
  await page.getByLabel("E-mail de contato").fill(contact);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nova senha").fill("senha-de-teste");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Aceite os termos e a política")).toBeVisible();
  await page.locator('input[name="accept"]').check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/passageiro");

  // Sem permissão ainda: explica o motivo antes do pedido do sistema
  await expect(page.getByRole("heading", { name: "Use sua localização" })).toBeVisible();
  await page.getByRole("button", { name: "Digitar endereço" }).click();
  await expect(page.getByRole("combobox", { name: "Partida" })).toBeVisible();

  // Sessão ativa pula a entrada
  await page.goto("/entrar");
  await page.waitForURL("**/passageiro");

  // E-mail: o código enviado no cadastro confirma o endereço
  await page.goto("/passageiro/conta");
  await expect(page.getByText("Não confirmado")).toBeVisible();
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByText(/Enviamos um código/)).toBeVisible();
  await page.getByLabel("Código de confirmação").fill(lastCode(contact));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();

  // Esqueci a senha: código no e-mail da conta, nova senha e entrada direta
  await ctx.clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("Celular com DDD").fill(phone);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await expect(page.getByText(/Enviamos um código/)).toContainText("@e2e.prumo.test");
  await page.getByLabel("Código").fill("000000");
  await page.getByLabel("Nova senha").fill("nova-senha-123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Código incorreto")).toBeVisible();
  await page.getByLabel("Código").fill(lastCode(contact));
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await page.waitForURL("**/passageiro");

  // A senha antiga deixa de valer; a nova entra
  await ctx.clearCookies();
  const old = await (await apiClient()).post("/api/auth/login", { data: { identifier: phone, password: "senha-de-teste" } });
  expect(old.status()).toBe(401);
  await login(page, phone, "nova-senha-123");
  await page.waitForURL("**/passageiro");
  await ctx.close();
});

test("dados inválidos ou duplicados são recusados no servidor", async () => {
  const c = await apiClient();
  const signup = (data: object) => c.post("/api/auth/register", { data: { name: "Pessoa de Teste", password: "senha-de-teste", role: "driver", acceptPrivacy: true, ...data } });
  expect((await signup({ phone: "31888887777" })).status()).toBe(400); // sem o 9
  expect((await signup({ phone: "20999998888" })).status()).toBe(400); // DDD inexistente
  expect((await signup({ phone: "31999999999" })).status()).toBe(400); // sequência repetida
  expect((await signup({ phone: uniquePhone(), name: "Pessoa" })).status()).toBe(400); // sem sobrenome
  expect((await c.post("/api/auth/lookup", { data: { identifier: "12345" } })).status()).toBe(400);

  const phone = uniquePhone();
  expect((await signup({ phone })).ok()).toBeTruthy();
  expect((await signup({ phone })).status()).toBe(409);
  const { regions } = await (await c.get("/api/driver/state")).json();
  const good = { cpf: makeCpf(), cnh: makeCnh(), regionId: regions[0].id, ...DRIVER_ADDRESS, ...DRIVER_REG };
  const onboard = (over: object) => c.post("/api/driver/onboarding", { data: { ...good, ...over } });
  expect((await onboard({ cpf: "00000000000" })).status()).toBe(400);
  expect((await onboard({ cpf: "12345678900" })).status()).toBe(400);
  expect((await onboard({ cnh: "11111111111" })).status()).toBe(400);
  expect((await onboard({ cep: "99999999" })).status()).toBe(400);
  // Regularização: menor que a idade mínima, CNH sem EAR, vencida ou de categoria inválida, e termo não aceito são recusados.
  // (Categoria A sozinha é aceita: serve para moto. O carro é que exige B, conferido no cadastro do veículo.)
  const young = `${new Date().getFullYear() - 19}-01-01`;
  expect((await (await onboard({ birthDate: young })).json()).error).toContain("anos");
  expect((await onboard({ cnhEar: false })).status()).toBe(400);
  expect((await (await onboard({ cnhExpiresAt: "2020-01-01" })).json()).error).toContain("vencida");
  expect((await (await onboard({ cnhCategory: "ACC" })).json()).error).toContain("categoria A");
  expect((await onboard({ acceptTerms: false })).status()).toBe(400);
  expect((await onboard({ inss: false })).status()).toBe(400);
  // Só com CNH A: o cadastro passa, mas carro é recusado.
  expect((await onboard({ cnhCategory: "A" })).ok()).toBeTruthy();
  const catsA = (await (await c.get("/api/driver/state")).json()).categories;
  const carA = { categoryId: catsA.find((x: { modalityId: string }) => x.modalityId === "corrida-carro").id, make: "Marca", model: "Modelo", color: "Prata", plate: "ABC1D23", year: 2022, ...VEHICLE_REG };
  expect((await (await c.post("/api/driver/vehicle", { data: carA })).json()).error).toContain("categoria B");
  expect((await onboard({})).ok()).toBeTruthy();

  const other = await apiClient();
  expect((await other.post("/api/auth/register", { data: { name: "Outra Pessoa", phone: uniquePhone(), password: "senha-de-teste", role: "driver", acceptPrivacy: true } })).ok()).toBeTruthy();
  const dup = await other.post("/api/driver/onboarding", { data: { ...good, cnh: makeCnh() } });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).error).toContain("CPF");
  // Carro: sem ar-condicionado, velho demais ou de 2 portas é recusado.
  const cats = (await (await c.get("/api/driver/state")).json()).categories;
  const car = { categoryId: cats[0].id, make: "Marca", model: "Modelo", color: "Prata", plate: "ABC1D23", year: 2022, ...VEHICLE_REG };
  expect((await (await c.post("/api/driver/vehicle", { data: { ...car, airConditioning: false } })).json()).error).toContain("ar-condicionado");
  expect((await (await c.post("/api/driver/vehicle", { data: { ...car, year: 1995 } })).json()).error).toContain("mais novo");
  expect((await (await c.post("/api/driver/vehicle", { data: { ...car, doors: 2 } })).json()).error).toContain("portas");
});

test("tema: o servidor entrega a escolha pronta, o aparelho vale sem escolha e o botão guarda a preferência", async ({ browser }) => {
  // Sem script na página: a escolha vem num cookie e o servidor já escreve data-theme no <html>.
  const c = await apiClient();
  const html = async (cookie?: string) => (await (await c.get("/", { headers: cookie ? { cookie } : {} })).text());
  expect(await html("prumo-theme=dark")).toMatch(/<html[^>]*data-theme="dark"/);
  expect(await html("prumo-theme=light")).toMatch(/<html[^>]*data-theme="light"/);
  const none = await html();
  expect(none).not.toMatch(/<html[^>]*data-theme=/);
  expect(none).not.toContain("localStorage.getItem(\"prumo-theme\")");

  const bg = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const LIGHT = "rgb(245, 247, 250)"; // #F5F7FA, fundo claro da identidade Orbi

  // Sem escolha salva, o tema do aparelho decide
  const dark = await browser.newContext({ baseURL: BASE, colorScheme: "dark" });
  const pd = await dark.newPage();
  await pd.goto("/status");
  expect(await bg(pd)).not.toBe(LIGHT);
  // O botão grava a escolha em cookie e ela sobrevive a recarregar, mesmo contra o tema do aparelho
  await pd.getByRole("button", { name: "Usar modo claro" }).first().click();
  expect(await bg(pd)).toBe(LIGHT);
  expect((await dark.cookies()).find((k) => k.name === "prumo-theme")?.value).toBe("light");
  await pd.reload();
  expect(await bg(pd)).toBe(LIGHT);
  await dark.close();

  const light = await browser.newContext({ baseURL: BASE, colorScheme: "light" });
  const pl = await light.newPage();
  await pl.goto("/status");
  expect(await bg(pl)).toBe(LIGHT);
  await pl.getByRole("button", { name: "Usar modo escuro" }).first().click();
  expect(await bg(pl)).not.toBe(LIGHT);
  await pl.reload();
  expect(await bg(pl)).not.toBe(LIGHT);
  await light.close();
});
