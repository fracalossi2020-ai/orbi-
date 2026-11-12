import { expect, test } from "@playwright/test";
import { adminApi, apiClient, approvedDriverApi, gpsContext, passengerApi, RIDE_BODY, signUp, unique, uniquePhone } from "./helpers";

test.describe.configure({ mode: "serial" });

const OIDC = "http://localhost:3102";
const nextGoogleUser = async (user: { sub: string; email: string; name: string }) => {
  const c = await apiClient();
  expect((await c.post(`${OIDC}/next-user`, { data: user })).ok()).toBeTruthy();
};

test("parada no caminho e corrida agendada pela interface", async ({ browser }) => {
  const ctx = await gpsContext(browser);
  const page = await ctx.newPage();
  // Endereços fixos: este cenário testa o pedido, não o serviço público de endereços.
  await page.route("**/api/geo/search*", (r) => {
    const q = new URL(r.request().url()).searchParams.get("q") ?? "";
    return r.fulfill({ json: { places: q.includes("Parada")
      ? [{ label: "Parada Teste Centro", detail: "Centro · Ipatinga", lat: -19.49, lng: -42.56, kind: "place", inArea: true }]
      : [{ label: "Coronel Fabriciano", detail: "Minas Gerais", lat: -19.52, lng: -42.628, kind: "area", inArea: true }] } });
  });
  await signUp(page, "passageiro", uniquePhone(), "Teresa Teste Agenda");
  await expect(page.getByRole("combobox", { name: "Partida" })).not.toHaveValue("", { timeout: 20000 });
  // Aviso de motoristas por perto (dado real: pode ser zero)
  await expect(page.getByRole("status").filter({ hasText: "por perto" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("combobox", { name: "Destino final" }).fill("Coronel");
  await expect(page.getByRole("option", { name: /Coronel Fabriciano/ })).toBeVisible();
  // Prévia: antes de escolher, o mapa já mostra onde fica a sugestão
  await expect(page.locator(".map-tag")).toContainText("Coronel Fabriciano", { timeout: 30000 });
  await page.getByRole("option", { name: /Coronel Fabriciano/ }).click();
  await expect(page.locator(".map-tag")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Essencial/ })).toBeVisible({ timeout: 20000 });
  const withoutStop = await page.getByRole("radio", { name: /Essencial/ }).textContent();

  // Parada entre a partida e o destino
  await page.getByRole("button", { name: "Alterar partida ou destino" }).click();
  await page.getByRole("button", { name: "Adicionar parada" }).click();
  await page.getByRole("combobox", { name: "Parada 1" }).fill("Parada");
  await page.getByRole("option", { name: /Parada Teste Centro/ }).click();
  await expect(page.getByTestId("trip-summary")).toContainText("Parada Teste Centro", { timeout: 20000 });
  await expect(page.locator(".prumo-mk--stop")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("radio", { name: /Essencial/ })).not.toHaveText(withoutStop!);

  // Agendar
  await page.getByRole("radio", { name: "Agendar" }).click();
  await expect(page.getByLabel("Dia e hora da partida")).not.toHaveValue("");
  await page.getByRole("button", { name: /^Agendar Essencial/ }).click();
  // O pedido recalcula a rota no serviço público: pode levar alguns segundos.
  await expect(page.getByTestId("booked")).toContainText("Parada Teste Centro", { timeout: 30000 });

  await page.goto("/passageiro/viagens");
  const card = page.getByTestId("scheduled-ride");
  await expect(card).toContainText("Parada Teste Centro");
  await expect(card).toContainText("Coronel Fabriciano");
  await card.getByRole("button", { name: "Cancelar agendamento" }).click();
  await expect(page.getByTestId("scheduled-ride")).toHaveCount(0);
  await expect(page.getByText("Cancelada").first()).toBeVisible();
});

test("site: tocar num bairro da Linha do Vale preenche o destino do pedido", async ({ page }) => {
  // Endereço fixo: o teste é da página, não do serviço público de endereços.
  await page.route("**/api/geo/search*", (r) => r.fulfill({ json: { places: [{ label: "Cariru", detail: "Ipatinga · Minas Gerais", lat: -19.488, lng: -42.537, kind: "area", inArea: true }] } }));
  // Os bairros ficam na página de cada cidade
  await page.goto("/cidades/ipatinga");
  await page.getByRole("button", { name: "Ir para Cariru, Ipatinga" }).click();
  await expect(page.getByRole("combobox", { name: "Local de chegada" })).toHaveValue("Cariru");
  // Com endereço escolhido, o título recolhe; "Limpar" volta ao início
  await page.getByRole("button", { name: "Limpar" }).click();
  await expect(page.getByRole("combobox", { name: "Local de chegada" })).toHaveValue("");
  // Na inicial: a cidade escolhida orienta a busca de endereços; com endereço, os botões saem do caminho
  await page.goto("/");
  await page.getByRole("button", { name: "Timóteo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Timóteo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("combobox", { name: "Local de chegada" }).fill("Cariru");
  await page.getByRole("option").first().click();
  await expect(page.getByRole("button", { name: "Timóteo", exact: true })).toHaveCount(0);
});

test("site: preço estimado sem cadastro, motoristas online, página da cidade, ajuda e simulador", async ({ page }) => {
  const admin = await adminApi();
  const driver = await approvedDriverApi(admin);
  // Fica offline no fim, para não receber ofertas de outros testes.
  test.info().annotations.push({ type: "limpeza", description: "motorista offline no fim" });
  page.on("close", () => { void driver.c.post("/api/driver/status", { data: { online: false } }); });
  // Endereços e rota fixos: o teste é do site, não dos serviços públicos.
  await page.route("**/api/geo/search*", (r) => {
    const q = new URL(r.request().url()).searchParams.get("q") ?? "";
    return r.fulfill({ json: { places: q.startsWith("Origem") ? [{ label: "Origem Teste", detail: "Centro · Ipatinga", lat: -19.468, lng: -42.537, kind: "place", inArea: true }]
      : [{ label: "Destino Teste", detail: "Cariru · Ipatinga", lat: -19.488, lng: -42.537, kind: "place", inArea: true }] } });
  });
  await page.route("**/api/geo/route*", (r) => r.fulfill({ json: { distanceM: 5000, durationS: 600, geometry: [[-42.537, -19.468], [-42.537, -19.488]], source: "osrm", originInArea: true, destInArea: true } }));
  await page.goto("/");
  await expect(page.getByTestId("pulse")).toContainText(/motoristas? online agora em Ipatinga/, { timeout: 20000 });
  await page.getByRole("combobox", { name: "Local de partida" }).fill("Origem");
  await page.getByRole("option", { name: /Origem Teste/ }).click();
  await page.getByRole("combobox", { name: "Local de chegada" }).fill("Destino");
  await page.getByRole("option", { name: /Destino Teste/ }).click();
  const est = page.getByTestId("estimates");
  await expect(est).toContainText("Essencial");
  await expect(est).toContainText("R$");

  // Página da cidade: tarifa aberta e destinos
  await page.goto("/cidades/ipatinga");
  await expect(page.getByRole("heading", { name: "Cada centavo, à vista." })).toBeVisible();
  await expect(page.getByText("Bandeirada").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Shopping do Vale do Aço/ })).toBeVisible();

  // Central de ajuda com busca
  await page.goto("/ajuda");
  await page.getByRole("searchbox").fill("cancelo");
  await expect(page.getByText("Como cancelo?")).toBeVisible();
  await expect(page.getByText("Posso pedir uma viagem para outra pessoa?")).toHaveCount(0);

  // Simulador usa a comissão do painel
  await page.goto("/motoristas");
  await expect(page.locator("#ganhos")).toContainText("definida no painel", { timeout: 20000 });
  expect((await driver.c.post("/api/driver/status", { data: { online: false } })).ok()).toBeTruthy();
});

test("pagamentos direto ao motorista: Pix na chave dele e maquininha", async () => {
  const admin = await adminApi();
  const d = await approvedDriverApi(admin);
  try {
    const p = await passengerApi();
    // Sem chave Pix, o motorista não recebe corrida paga por Pix; chave que não confere com o tipo é recusada.
    expect((await d.c.post("/api/driver/payment-prefs", { data: { pixKeyType: "cpf", pixKey: "31999998888", cardMachine: false } })).status()).toBe(400);
    expect((await d.c.post("/api/driver/payment-prefs", { data: { pixKeyType: "phone", pixKey: "(31) 99999-8888", cardMachine: false } })).ok()).toBeTruthy();

    // Ninguém online tem maquininha: a corrida fica procurando e não chega a este motorista.
    const card = await (await p.post("/api/rides", { data: RIDE_BODY(d.categoryId, { paymentMethod: "card_machine" }) })).json();
    expect(card.status).toBe("searching");
    expect((await (await d.c.get("/api/driver/state")).json()).offer).toBeNull();
    expect((await p.post(`/api/rides/${card.id}/cancel`, { data: { reason: "teste" } })).ok()).toBeTruthy();

    // Pix na chave do motorista: o passageiro recebe o "copia e cola" com o valor ao começar a viagem.
    const ride = await (await p.post("/api/rides", { data: RIDE_BODY(d.categoryId, { paymentMethod: "pix_driver" }) })).json();
    const offer = (await (await d.c.get("/api/driver/state")).json()).offer;
    expect(offer.paymentMethod).toBe("pix_driver");
    expect((await d.c.post(`/api/driver/offers/${offer.id}`, { data: { accept: true } })).ok()).toBeTruthy();
    for (const a of ["arrive", "start"]) expect((await d.c.post(`/api/rides/${ride.id}/${a}`, { data: {} })).ok()).toBeTruthy();
    const view = (await (await p.get("/api/rides")).json()).active;
    expect(view.driverPix.key).toBe("+5531999998888");
    expect(view.driverPix.payload).toContain("br.gov.bcb.pix");
    expect(view.driverPix.payload).toContain(`54${String((view.totalCents / 100).toFixed(2).length).padStart(2, "0")}${(view.totalCents / 100).toFixed(2)}`);
    expect((await d.c.post(`/api/rides/${ride.id}/complete`, { data: {} })).ok()).toBeTruthy();
    // No extrato, entra como o dinheiro: o motorista recebeu tudo e deve a comissão.
    const earnings = await (await d.c.get("/api/driver/finance")).json();
    expect(JSON.stringify(earnings)).toContain("Corrida com Pix na sua chave");
  } finally {
    await d.c.post("/api/driver/status", { data: { online: false } });
  }
});

test("agendada entra na fila de motoristas no horário; regras recusam horários inválidos", async () => {
  const admin = await adminApi();
  const cats = await (await admin.get("/api/admin/r/categories")).json();
  const categoryId = cats.rows[0].id as string;
  const p = await passengerApi();
  const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
  const stops = [{ label: "Parada de teste", lat: -19.49, lng: -42.56 }];

  // Padrão: pelo menos 30 minutos de antecedência
  const early = await p.post("/api/rides", { data: RIDE_BODY(categoryId, { scheduledFor: at(10) }) });
  expect(early.status()).toBe(409);
  expect((await early.json()).error).toContain("30 minutos");
  expect((await p.post("/api/rides", { data: RIDE_BODY(categoryId, { stops: [...stops, ...stops, ...stops] }) })).status()).toBe(400);

  // Agendada não ocupa a conta: a pessoa ainda pode pedir outra para agora
  const later = await (await p.post("/api/rides", { data: RIDE_BODY(categoryId, { scheduledFor: at(120), stops }) })).json();
  expect(later.status).toBe("scheduled");
  expect(later.stops).toHaveLength(1);
  expect((await (await p.get("/api/rides")).json()).active).toBeNull();
  expect((await p.post(`/api/rides/${later.id}/cancel`, { data: { reason: "teste" } })).ok()).toBeTruthy();

  // Com a antecedência configurada em zero, o horário chega logo e a busca começa sozinha
  expect((await admin.post("/api/admin/settings", { data: { schedule: { minLeadMin: 0, maxDays: 7, searchLeadMin: 10, maxPerPassenger: 3 } } })).ok()).toBeTruthy();
  try {
    const soon = await (await p.post("/api/rides", { data: RIDE_BODY(categoryId, { scheduledFor: at(5), stops }) })).json();
    expect(soon.status).toBe("scheduled");
    await expect.poll(async () => (await (await p.get("/api/rides")).json()).active?.status, { timeout: 20000 }).toBe("searching");
    const active = (await (await p.get("/api/rides")).json()).active;
    expect(active.id).toBe(soon.id);
    expect(active.stops[0].label).toBe("Parada de teste");
    expect((await p.post(`/api/rides/${soon.id}/cancel`, { data: { reason: "teste" } })).ok()).toBeTruthy();
  } finally {
    await admin.post("/api/admin/settings", { data: { schedule: { minLeadMin: 30, maxDays: 7, searchLeadMin: 10, maxPerPassenger: 3 } } });
  }
});

test("entrar com Google: conta nova, volta direto, vincula conta existente e recusa equipe", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const id = unique();

  // Conta nova: o Google confirma o e-mail; falta só aceitar os termos
  await nextGoogleUser({ sub: `g-${id}`, email: `g${id}@e2e.prumo.test`, name: "Gabriela Teste Google" });
  await page.goto("/entrar?perfil=passageiro");
  await page.getByRole("link", { name: "Continuar com Google" }).click();
  await page.waitForURL(/google=novo/);
  await expect(page.getByRole("heading", { name: "Falta pouco" })).toBeVisible();
  await expect(page.getByText(`g${id}@e2e.prumo.test`)).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toHaveValue("Gabriela Teste Google");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText(/Aceite os termos/)).toBeVisible();
  await page.locator('input[name="accept"]').check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/passageiro");
  const me = await (await page.request.get("/api/me")).json();
  expect(me.user).toMatchObject({ email: `g${id}@e2e.prumo.test`, emailVerified: true, role: "passenger" });

  // Saiu e voltou: o Google reconhece a conta e entra direto
  await ctx.clearCookies();
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Continuar com Google" }).click();
  await page.waitForURL("**/passageiro");

  // Conta criada com senha e mesmo e-mail: o Google vincula em vez de duplicar
  await ctx.clearCookies();
  const existing = await apiClient();
  const email = `vinc${id}@e2e.prumo.test`;
  expect((await existing.post("/api/auth/register", { data: { name: "Vera Teste Vinculo", email, password: "senha-de-teste", role: "passenger", acceptPrivacy: true } })).ok()).toBeTruthy();
  await nextGoogleUser({ sub: `g2-${id}`, email, name: "Vera" });
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Continuar com Google" }).click();
  await page.waitForURL("**/passageiro");
  expect((await (await page.request.get("/api/me")).json()).user).toMatchObject({ email, name: "Vera Teste Vinculo", emailVerified: true });

  // Conta da equipe não entra pelo Google
  await ctx.clearCookies();
  await nextGoogleUser({ sub: `g3-${id}`, email: "admin@e2e.prumo.test", name: "Admin" });
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Continuar com Google" }).click();
  await page.waitForURL(/google=equipe/);
  await expect(page.getByText("Contas da equipe entram com e-mail e senha.")).toBeVisible();
});
