import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCHEDULE, scheduleProblem, searchStartsAt } from "@/domain/schedule";
import { getRoute, searchPlaces } from "@/server/geo";

const now = new Date("2026-11-06T12:00:00-03:00");
const plus = (min: number) => new Date(now.getTime() + min * 60_000);

describe("agendamento", () => {
  it("aceita dentro da janela", () => {
    expect(scheduleProblem(plus(45), now, DEFAULT_SCHEDULE)).toBeNull();
    expect(scheduleProblem(plus(6 * 24 * 60), now, DEFAULT_SCHEDULE)).toBeNull();
  });
  it("recusa com pouca antecedência, no passado ou longe demais", () => {
    expect(scheduleProblem(plus(10), now, DEFAULT_SCHEDULE)).toContain("30 minutos");
    expect(scheduleProblem(plus(-5), now, DEFAULT_SCHEDULE)).toContain("antecedência");
    expect(scheduleProblem(plus(8 * 24 * 60), now, DEFAULT_SCHEDULE)).toContain("7 dias");
    expect(scheduleProblem(new Date("x"), now, DEFAULT_SCHEDULE)).toBe("Horário inválido.");
  });
  it("respeita a configuração do painel", () => {
    expect(scheduleProblem(plus(10), now, { ...DEFAULT_SCHEDULE, minLeadMin: 5 })).toBeNull();
  });
  it("a busca começa antes do horário", () => {
    expect(searchStartsAt(plus(60), DEFAULT_SCHEDULE).getTime()).toBe(plus(50).getTime());
  });
});

describe("rota com paradas", () => {
  afterEach(() => vi.unstubAllGlobals());
  const a = { lat: -19.47, lng: -42.54 }, stop = { lat: -19.49, lng: -42.58 }, b = { lat: -19.52, lng: -42.63 };

  it("pede ao serviço de rotas passando pela parada, na ordem", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ routes: [{ distance: 9000, duration: 900, geometry: { coordinates: [[a.lng, a.lat], [b.lng, b.lat]] } }] }) }));
    vi.stubGlobal("fetch", fetch);
    await getRoute(a, b, [stop]);
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain(`${a.lng},${a.lat};${stop.lng},${stop.lat};${b.lng},${b.lat}`);
  });

  it("busca: com o serviço principal fora do ar, usa a segunda fonte e classifica bairro, rua e lugar", async () => {
    const hits = [
      { lat: "-19.49", lon: "-42.53", name: "Cariru", osm_type: "relation", osm_id: 5543230, addresstype: "suburb", category: "boundary", boundingbox: ["-19.50", "-19.48", "-42.54", "-42.52"], address: { city: "Ipatinga", state: "Minas Gerais" } },
      { lat: "-19.55", lon: "-42.64", name: "Avenida Monsenhor Rafael", osm_type: "way", osm_id: 1, addresstype: "road", category: "highway", address: { suburb: "Timirim", city: "Timóteo" } },
      { lat: "-19.47", lon: "-42.54", name: "Shopping do Vale do Aço", osm_type: "way", osm_id: 2, addresstype: "shop", category: "shop", address: { road: "Avenida Amazonas", suburb: "Industrial", city: "Ipatinga" } },
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("photon")) throw new Error("fora do ar");
      return { ok: true, json: async () => hits };
    }));
    const places = await searchPlaces("teste", a);
    expect(places.map((p) => [p.kind, p.label])).toEqual([["area", "Cariru"], ["street", "Avenida Monsenhor Rafael"], ["place", "Shopping do Vale do Aço"]]);
    expect(places[0]).toMatchObject({ osm: "R5543230", extent: [-42.54, -19.5, -42.52, -19.48] });
  });

  it("sem serviço, a estimativa soma os trechos e não corta pela linha reta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fora do ar"); }));
    const direct = await getRoute(a, b);
    const via = await getRoute(a, b, [stop]);
    expect(via.source).toBe("estimate");
    expect(via.distanceM).toBeGreaterThanOrEqual(direct.distanceM);
    expect(via.geometry).toHaveLength(3);
  });
});
