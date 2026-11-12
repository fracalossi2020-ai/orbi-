/** O que o sistema reconheceu ao buscar um endereço: o tipo orienta o ícone, o texto e os avisos da prévia. */
export type PlaceKind = "address" | "street" | "place" | "area";

export type Place = {
  label: string;
  detail?: string;
  lat: number;
  lng: number;
  kind?: PlaceKind;
  /** Número digitado numa rua que não tem esse número no mapa: o ponto fica na rua, não na porta. */
  approx?: boolean;
  /** Dentro de uma cidade atendida. Ausente quando ainda não foi conferido. */
  inArea?: boolean;
  /** Identificação no OpenStreetMap (N, W ou R + número): permite desenhar o contorno de um bairro na prévia. */
  osm?: string;
  /** Limites do lugar (oeste, sul, leste, norte), para enquadrar um bairro inteiro no mapa. */
  extent?: [number, number, number, number];
};

export const KIND_LABEL: Record<PlaceKind, string> = { address: "Endereço", street: "Rua", place: "Lugar", area: "Bairro ou cidade" };
export const KIND_ICON: Record<PlaceKind, string> = { address: "pin", street: "route", place: "store", area: "map" };
