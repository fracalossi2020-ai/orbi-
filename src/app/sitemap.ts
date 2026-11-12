import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";

/** Mapa do site para buscadores: páginas públicas e uma página por cidade ativa. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const pages = ["", "/como-funciona", "/passageiros", "/motoristas", "/clube", "/empresa", "/ajuda", "/motoristas/requisitos", "/termos-motorista", "/parceiros", "/contato", "/privacidade", "/termos", "/status"];
  let cities: { slug: string }[] = [];
  try { cities = await (await getDb()).select({ slug: s.regions.slug }).from(s.regions).where(eq(s.regions.active, true)); } catch { /* sem banco: só as fixas */ }
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...cities.map((c) => ({ url: `${base}/cidades/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.9 })),
  ];
}
