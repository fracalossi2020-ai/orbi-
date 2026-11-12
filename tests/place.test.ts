import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPlaces, toPlace } from "@/server/geo";

const feature = (props: Record<string, string>, coords: [number, number] = [-42.53, -19.47]) => ({ geometry: { coordinates: coords }, properties: props });

describe("reconhecimento de endereços", () => {
  it("rua", () => {
    const p = toPlace(feature({ type: "street", osm_key: "highway", name: "Rua Caxambu", district: "Centro", city: "Ipatinga", state: "Minas Gerais" }));
    expect(p).toMatchObject({ kind: "street", label: "Rua Caxambu", detail: "Centro · Ipatinga" });
  });
  it("endereço com número", () => {
    const p = toPlace(feature({ type: "house", osm_key: "building", street: "Rua Tuparis", housenumber: "100", district: "Jardim Panorama", city: "Ipatinga" }));
    expect(p).toMatchObject({ kind: "address", label: "Rua Tuparis, 100", detail: "Jardim Panorama · Ipatinga" });
  });
  it("lugar com nome próprio mostra a rua no detalhe", () => {
    const p = toPlace(feature({ type: "house", osm_key: "amenity", name: "Hospital Márcio Cunha", street: "Avenida Kiyoshi Tsunawaki", housenumber: "41", city: "Ipatinga" }));
    expect(p).toMatchObject({ kind: "place", label: "Hospital Márcio Cunha" });
    expect(p.detail).toBe("Avenida Kiyoshi Tsunawaki, 41 · Ipatinga");
  });
  it("bairro e cidade", () => {
    expect(toPlace(feature({ type: "district", osm_key: "place", name: "Centro Norte", city: "Timóteo", state: "Minas Gerais" }))).toMatchObject({ kind: "area", label: "Centro Norte", detail: "Timóteo · Minas Gerais" });
  });
  it("não repete bairro e cidade iguais", () => {
    expect(toPlace(feature({ type: "street", name: "Rua A", district: "Ipatinga", city: "Ipatinga" })).detail).toBe("Ipatinga");
  });
});

describe("busca", () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (batches: object[][]) => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ features: batches[Math.min(n++, batches.length - 1)] }) })));
  };

  it("rua com número que o mapa não tem vira endereço aproximado, com o número digitado", async () => {
    const street = feature({ type: "street", osm_key: "highway", name: "Rua Caxambu", district: "Centro", city: "Ipatinga" });
    reply([[feature({ type: "house", osm_key: "shop", name: "Loja", street: "Rua Tuparis", housenumber: "100", city: "Ipatinga" })], [street]]);
    const [first] = await searchPlaces("Rua Caxambu 100", { lat: -19.5, lng: -42.58 });
    expect(first).toMatchObject({ kind: "address", label: "Rua Caxambu, 100", approx: true });
  });

  it("número que existe no mapa não é marcado como aproximado", async () => {
    reply([[feature({ type: "house", osm_key: "building", street: "Rua Tuparis", housenumber: "100", district: "Jardim Panorama", city: "Ipatinga" })]]);
    const places = await searchPlaces("Rua Tuparis 100", { lat: -19.5, lng: -42.58 });
    expect(places[0]).toMatchObject({ label: "Rua Tuparis, 100" });
    expect(places[0].approx).toBeUndefined();
  });

  it("junta ruas repetidas do mapa em uma só", async () => {
    const seg = feature({ type: "street", name: "Avenida Pedro Linhares Gomes", city: "Ipatinga" });
    reply([[seg, seg, seg, feature({ type: "street", name: "Avenida Pedro Linhares Gomes", city: "Ipatinga" }, [-42.5, -19.46])]]);
    expect(await searchPlaces("Avenida Pedro Linhares Gomes", { lat: -19.5, lng: -42.58 })).toHaveLength(1);
  });
});
