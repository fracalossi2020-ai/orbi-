import { devices, expect, test, type Page } from "@playwright/test";
import { adminApi, approvedDriverApi, BASE, IPATINGA, signUp, uniquePhone } from "./helpers";

/** Telas no celular: nada passa da largura da tela, e o botão de pedir nunca fica atrás da barra de baixo. */
const PHONES = {
  iPhone: { ...devices["iPhone 13"], defaultBrowserType: undefined },
  Android: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices["Pixel 5"].userAgent },
};

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [name, dev] of Object.entries(PHONES)) {
  test(`celular ${name}: telas cabem na largura e o pedido fica à mão`, async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await browser.newContext({ ...dev, geolocation: IPATINGA, permissions: ["geolocation"], baseURL: BASE, reducedMotion: "reduce" });
    await ctx.addInitScript(() => { try { localStorage.setItem("prumo-cookies-ok", "1"); } catch { /* sem armazenamento */ } });
    const page = await ctx.newPage();
    for (const p of ["/", "/cidades/ipatinga", "/ajuda", "/motoristas", "/passageiros", "/contato", "/entrar"]) {
      await page.goto(p);
      expect(await overflow(page), `${p} passa da largura`).toBeLessThanOrEqual(0);
    }

    const admin = await adminApi();
    const d = await approvedDriverApi(admin);
    try {
      await signUp(page, "passageiro", uniquePhone(), "Bruna Teste Celular");
      await expect(page.getByRole("combobox", { name: "Partida" })).not.toHaveValue("", { timeout: 20000 });
      await page.route("**/api/geo/search*", (r) => r.fulfill({ json: { places: [{ label: "Shopping do Vale do Aço", detail: "Avenida Amazonas · Industrial · Ipatinga", lat: -19.4818, lng: -42.5262, kind: "place", inArea: true }] } }));
      await page.getByRole("combobox", { name: "Destino final" }).fill("Shopping");
      await page.getByRole("option").first().click();
      const pedir = page.getByRole("button", { name: /^Pedir / });
      await expect(pedir).toBeInViewport({ ratio: 1, timeout: 20000 });
      const b = await pedir.boundingBox();
      const nav = await page.getByRole("navigation", { name: "Passageiro" }).last().boundingBox();
      expect(b!.y + b!.height).toBeLessThanOrEqual(nav!.y + 1);
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      const dctx = await browser.newContext({ ...dev, geolocation: IPATINGA, permissions: ["geolocation"], baseURL: BASE, reducedMotion: "reduce", storageState: await d.c.storageState() });
      const dpage = await dctx.newPage();
      for (const p of ["/motorista", "/motorista/ganhos", "/motorista/conta"]) {
        await dpage.goto(p);
        expect(await overflow(dpage), `${p} passa da largura`).toBeLessThanOrEqual(0);
      }
      await expect(dpage.getByRole("heading", { name: "Como você recebe" })).toBeVisible();
      const actx = await browser.newContext({ ...dev, baseURL: BASE, storageState: await admin.storageState() });
      const apage = await actx.newPage();
      for (const p of ["/admin", "/admin/configuracoes"]) {
        await apage.goto(p);
        expect(await overflow(apage), `${p} passa da largura`).toBeLessThanOrEqual(0);
      }
    } finally {
      await d.c.post("/api/driver/status", { data: { online: false } });
    }
  });
}
