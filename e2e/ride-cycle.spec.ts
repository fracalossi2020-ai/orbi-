import { expect, test } from "@playwright/test";
import { ADMIN, gpsContext, login, makeCnh, makeCpf, PNG, REQUIRED_DOCS, signUp, uniquePhone } from "./helpers";

test("corrida completa entre passageiro, motorista e administração", async ({ browser }) => {
  // O ciclo inteiro (cadastro, documentos, aprovação, corrida, ganhos) é longo: mais folga que o padrão.
  test.setTimeout(360_000);
  const driverPhone = uniquePhone();
  const plate = `TST${(Date.now() % 10)}A${String(Date.now() % 100).padStart(2, "0")}`;

  // Motorista: cadastro pela interface
  const driverCtx = await gpsContext(browser);
  const driver = await driverCtx.newPage();
  await signUp(driver, "motorista", driverPhone, "Rita Teste Motorista");

  await driver.getByLabel("CPF").fill(makeCpf());
  await driver.getByLabel("Data de nascimento").fill("1990-05-10");
  await driver.getByLabel("Número da CNH").fill(makeCnh());
  await driver.getByLabel("Primeira habilitação").fill("2012-03-01");
  await driver.getByLabel("Validade da CNH").fill(`${new Date().getFullYear() + 4}-12-31`);
  await driver.locator('input[name="cnhEar"]').check();
  await driver.locator('input[name="inss"]').check();
  await driver.locator('input[name="acceptTerms"]').check();
  await driver.getByLabel("CEP").fill("35160-039");
  await expect(driver.getByLabel("Rua")).toHaveValue("Rua de Teste");
  await expect(driver.getByLabel("Cidade", { exact: true })).toHaveValue("Ipatinga");
  await driver.getByLabel("Número", { exact: true }).fill("100");
  await driver.getByLabel("Cidade onde vai rodar").selectOption({ label: "Ipatinga" });
  await driver.getByRole("button", { name: "Continuar" }).click();
  await expect(driver.getByRole("heading", { name: "Complete seu cadastro" })).toBeVisible();

  for (const kind of REQUIRED_DOCS) {
    await driver.locator(`input[data-doc="${kind}"]`).setInputFiles({ name: `${kind}.png`, mimeType: "image/png", buffer: PNG });
    await expect(driver.locator(`input[data-doc="${kind}"]`).locator("xpath=ancestor::li").getByText("Em análise")).toBeVisible();
  }
  await driver.locator('input[name="make"]').fill("Marca");
  await driver.locator('input[name="model"]').fill("Modelo");
  await driver.locator('input[name="color"]').fill("Prata");
  await driver.locator('input[name="plate"]').fill(plate);
  await driver.locator('input[name="year"]').fill("2022");
  await driver.locator('input[name="noRedPlate"]').check();
  await driver.getByRole("button", { name: "Cadastrar veículo" }).click();
  await expect(driver.getByText(plate)).toBeVisible();

  // Sem aprovação, o motorista não recebe a tela de ficar online
  await expect(driver.getByRole("button", { name: "Ficar online" })).toHaveCount(0);

  // Administração: documentos antes do cadastro, nunca ao contrário
  const adminCtx = await browser.newContext({ baseURL: "http://localhost:3100", viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN.identifier, ADMIN.password);
  await admin.waitForURL("**/admin");
  await expect(admin.getByRole("heading", { name: "Indicadores" })).toBeVisible();
  await admin.goto("/admin/motoristas");
  const row = admin.getByTestId("driver-row").filter({ hasText: "Rita Teste Motorista" });
  await row.getByRole("button", { name: "Aprovar cadastro" }).click();
  await expect(admin.getByText(/Aprove primeiro: .*Certidão de antecedentes criminais/)).toBeVisible();
  // Os dados de regularização aparecem para quem analisa
  await expect(row.getByText(/EAR declarada · INSS declarado · Termo aceito/)).toBeVisible();

  // Cinco documentos e o veículo
  const pending = REQUIRED_DOCS.length + 1;
  for (let i = 0; i < pending; i++) {
    await row.getByRole("button", { name: "Aprovar", exact: true }).first().click();
    await expect(row.getByRole("button", { name: "Aprovar", exact: true })).toHaveCount(pending - 1 - i);
  }
  await row.getByRole("button", { name: "Aprovar cadastro" }).click();
  await expect(row.getByText("Aprovado").first()).toBeVisible();

  // Motorista online com o GPS do aparelho
  await driver.reload();
  await driver.getByRole("button", { name: "Ficar online" }).click();
  await expect(driver.getByTestId("online-state")).toHaveText("Você está online");

  // Passageiro: pedido pela interface
  const passengerCtx = await gpsContext(browser);
  const passenger = await passengerCtx.newPage();
  const pageErrors: string[] = [];
  passenger.on("pageerror", (e) => pageErrors.push(e.message));
  await signUp(passenger, "passageiro", uniquePhone(), "Caio Teste Passageiro");
  await expect(passenger.getByRole("heading", { name: "Para onde vamos?" })).toBeVisible();
  await expect(passenger.getByRole("combobox", { name: "Partida" })).not.toHaveValue("", { timeout: 20000 });

  await passenger.getByRole("combobox", { name: "Destino final" }).fill("Coronel Fabriciano");
  await passenger.getByRole("option", { name: /Coronel Fabriciano/ }).first().click();

  const essencial = passenger.getByRole("radio", { name: /Essencial/ });
  await expect(essencial).toBeVisible({ timeout: 20000 });
  await expect(essencial).toContainText("Motorista a ~");
  await expect(essencial).toContainText("você chega ~");
  // Rota traçada com o tempo de viagem por cima
  await expect(passenger.locator(".map-eta")).toContainText("min", { timeout: 30000 });
  // Marcadores só entram depois de o mapa carregar: sem worker, este passo falha.
  await expect(passenger.locator(".maplibregl-canvas")).toBeVisible();
  // A partida veio do GPS: vira o prumo que pulsa; o destino é o outro prumo.
  await expect(passenger.locator(".prumo-mk")).toHaveCount(2, { timeout: 30000 });
  await expect(passenger.locator(".prumo-mk--me")).toBeVisible();
  await expect(passenger.locator(".prumo-mk--dest")).toBeVisible();
  const mapBox = await passenger.locator(".maplibregl-canvas").boundingBox();
  expect(mapBox!.height).toBeGreaterThan(150);
  expect(mapBox!.width).toBeGreaterThan(300);
  // Formas pagas direto ao motorista aparecem; as que dependem do provedor, não.
  const pay = passenger.getByRole("radiogroup", { name: "Forma de pagamento" });
  await expect(pay.getByRole("radio", { name: /Dinheiro/ })).toBeVisible();
  await expect(pay.getByRole("radio", { name: /Pix para o motorista/ })).toBeVisible();
  await expect(pay.getByRole("radio", { name: /Cartão na maquininha/ })).toBeVisible();
  await expect(pay.getByRole("radio", { name: /Pix pelo app/ })).toHaveCount(0);
  await pay.getByRole("radio", { name: /Dinheiro/ }).click();
  // Destino salvo como casa vira atalho
  await passenger.getByRole("button", { name: "Alterar partida ou destino" }).click();
  await passenger.getByRole("button", { name: "Casa", exact: true }).click();
  await expect(passenger.getByText("Salvo como Casa")).toBeVisible();
  await passenger.getByRole("button", { name: "Ver preços" }).click();
  // Corrida para outra pessoa: sem nome e celular não dá para pedir
  await passenger.getByRole("radio", { name: "Outra pessoa" }).click();
  await expect(passenger.getByRole("button", { name: /^Pedir / })).toBeDisabled();
  await passenger.getByLabel("Nome de quem embarca").fill("Joana Teste Convidada");
  await passenger.getByLabel("Celular dessa pessoa").fill("31988887777");
  await expect(passenger.getByRole("button", { name: /^Pedir .* para Joana/ })).toBeEnabled();
  await passenger.getByRole("button", { name: /^Pedir / }).click();
  await expect(passenger.getByRole("heading", { name: "Procurando motorista" })).toBeVisible();

  // Motorista vê bruto, comissão e líquido antes de aceitar
  const offer = driver.getByTestId("offer");
  await expect(offer).toBeVisible({ timeout: 15000 });
  await expect(offer.getByText("Valor bruto")).toBeVisible();
  // Num celular, aceitar não pode exigir rolagem: a oferta dura poucos segundos.
  await expect(offer.getByRole("button", { name: "Aceitar" })).toBeInViewport({ ratio: 1 });
  await expect(offer.getByText(/Comissão Orbi \(15%\)/)).toBeVisible();
  await expect(offer.getByTestId("net")).toContainText("R$");
  await offer.getByRole("button", { name: "Aceitar" }).click();

  // Passageiro identifica o motorista
  await expect(passenger.getByRole("heading", { name: "Motorista a caminho" })).toBeVisible({ timeout: 15000 });
  await expect(passenger.getByText("Corrida para Joana Teste Convidada")).toBeVisible();
  // Motorista sabe quem procurar e pode ligar
  await expect(driver.getByTestId("rider")).toContainText("Joana Teste Convidada");
  await expect(driver.getByTestId("rider").getByRole("link", { name: "Ligar" })).toHaveAttribute("href", "tel:+5531988887777");
  await expect(passenger.getByText("Rita")).toBeVisible();
  await expect(passenger.getByLabel(`Placa ${plate}`)).toBeVisible();
  await expect(passenger.getByAltText("Foto de Rita")).toBeVisible();

  // Mensagem entre os dois
  await passenger.getByRole("button", { name: /Mensagens/ }).click();
  await passenger.getByLabel("Mensagem").fill("Estou na portaria");
  await passenger.getByRole("button", { name: "Enviar" }).click();
  await driver.getByRole("button", { name: /Mensagens/ }).click();
  await expect(driver.getByText("Estou na portaria")).toBeVisible({ timeout: 15000 });

  // Link compartilhado funciona sem conta
  const share = await passenger.evaluate(async () => (await (await fetch("/api/rides")).json()).active.shareToken);
  const visitorCtx = await browser.newContext({ baseURL: "http://localhost:3100" });
  const visitor = await visitorCtx.newPage();
  await visitor.goto(`/v/${share}`);
  await expect(visitor.getByRole("heading", { name: "Motorista a caminho" })).toBeVisible();

  // Andamento
  await driver.getByRole("button", { name: "Cheguei ao passageiro" }).click();
  await expect(passenger.getByRole("heading", { name: "Motorista chegou" })).toBeVisible({ timeout: 15000 });
  await driver.getByRole("button", { name: "Iniciar viagem" }).click();
  await expect(passenger.getByRole("heading", { name: "Em viagem" })).toBeVisible({ timeout: 15000 });
  await driver.getByRole("button", { name: "Encerrar viagem" }).click();

  // Avaliação nos dois sentidos
  await expect(passenger.getByRole("heading", { name: "Você chegou" })).toBeVisible({ timeout: 15000 });
  await passenger.getByRole("radio", { name: "5 estrelas" }).click();
  await passenger.getByRole("button", { name: "Enviar avaliação" }).click();
  await expect(driver.getByText(/Como foi a viagem com Caio/)).toBeVisible({ timeout: 15000 });
  await driver.getByRole("radio", { name: "4 estrelas" }).click();
  await driver.getByRole("button", { name: "Enviar avaliação" }).click();

  // Depois da corrida, o link deixa de expor dados
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: /Esta viagem terminou/ }).or(visitor.getByText("Esta viagem terminou"))).toBeVisible();

  // Saldo: corrida em dinheiro registra a parte da Orbi como débito
  await driver.goto("/motorista/ganhos");
  await expect(driver.getByText("Corrida em dinheiro")).toBeVisible();
  await expect(driver.getByTestId("balance")).toContainText("-");

  // Painel reflete a corrida real
  await admin.goto("/admin");
  await expect(admin.getByTestId("tile-Corridas realizadas")).toHaveText(/[1-9]/);
  await admin.goto("/admin/viagens");
  await expect(admin.getByText("Concluída").first()).toBeVisible();
  await admin.goto("/admin/atividades");
  await expect(admin.getByText("ride.complete").first()).toBeVisible();

  expect(pageErrors).toEqual([]);

  await Promise.all([driverCtx.close(), adminCtx.close(), passengerCtx.close(), visitorCtx.close()]);
});

test("trajeto digitado no site chega à tela de preços depois de criar a conta", async ({ browser }) => {
  const ctx = await gpsContext(browser);
  const page = await ctx.newPage();
  // Sem o 3D na home: em renderização por software ele ocupa o processador e este cenário testa o formulário.
  await page.addInitScript(() => {
    if (location.pathname !== "/") return;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type.startsWith("webgl") ? null : (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  // Resposta fixa: este cenário testa o formulário, não o serviço público de endereços.
  await page.route("**/api/geo/search*", (r) => r.fulfill({ json: { places: [{ label: "Coronel Fabriciano", detail: "Minas Gerais", lat: -19.52, lng: -42.628 }] } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sua órbita.");
  await page.getByRole("button", { name: "Ver preços" }).click();
  await expect(page.getByText("Escolha o local de chegada")).toBeVisible();

  await page.getByRole("combobox", { name: "Local de chegada" }).fill("Coronel Fabriciano");
  await page.getByRole("listbox", { name: /chegada/ }).getByRole("option").first().click();
  await page.getByRole("button", { name: "Ver preços" }).click();
  await page.waitForURL("**/entrar?perfil=passageiro");
  await signUp(page, "passageiro", uniquePhone(), "Pessoa de Teste", false);
  await expect(page.getByRole("radio", { name: /Essencial/ })).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("trip-summary")).toContainText("Coronel Fabriciano");

  // Site e app ligados: o logo volta à tela inicial, que reconhece a conta e leva direto aos preços
  await page.getByRole("link", { name: "Orbi, tela inicial" }).first().click();
  await page.waitForURL(/\/$/);
  await expect(page.getByRole("link", { name: "Minha conta" }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Local de chegada" }).fill("Coronel Fabriciano");
  await page.getByRole("listbox", { name: /chegada/ }).getByRole("option").first().click();
  await page.getByRole("button", { name: "Ver preços" }).click();
  await page.waitForURL("**/passageiro");
  await expect(page.getByRole("radio", { name: /Essencial/ })).toBeVisible({ timeout: 30000 });
  await ctx.close();
});
