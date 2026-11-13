import { and, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { Hero } from "@/components/site/Hero";
import { DriverBand, QuoteBar, Safety, Services } from "@/components/site/HomeSections";
import { StoryPhone } from "@/components/site/StoryPhone";
import { FinalCta } from "@/components/site/FinalCta";
import { OrbiStory } from "@/components/site/OrbiStory";
import { getDb, schema as s } from "@/db";
import { getSetting } from "@/db/seed";
import { identityById } from "@/lib/identities";
import { currentUser } from "@/server/auth";
import { STATIC } from "@/lib/site-mode";

async function identity() {
  if (STATIC) return "a";
  const preview = (await cookies()).get("prumo_identity_preview")?.value;
  if (preview && ["a", "b", "c", "d"].includes(preview)) return preview;
  try { return await getSetting(await getDb(), "identity", "a"); } catch { return "a"; }
}

/** Só cidades ativas no painel aparecem; o raio desenha a área atendida no mapa. */
async function cities() {
  try {
    const db = await getDb();
    return await db.select({ id: s.regions.id, slug: s.regions.slug, name: s.regions.name, state: s.regions.state, lat: s.regions.lat, lng: s.regions.lng, radiusKm: s.regions.radiusKm })
      .from(s.regions).where(eq(s.regions.active, true));
  } catch { return []; }
}

/**
 * Categorias de carro e de moto ativas, como cadastradas no painel.
 * `available`: a modalidade está ligada. A moto aparece mesmo desligada, marcada como "em breve" (depende de cada município).
 */
async function categories() {
  try {
    const db = await getDb();
    const rows = await db.select({ slug: s.categories.slug, name: s.categories.name, description: s.categories.description, seats: s.categories.seats, modalityId: s.categories.modalityId, available: s.modalities.active })
      .from(s.categories).innerJoin(s.modalities, eq(s.categories.modalityId, s.modalities.id))
      .where(and(eq(s.categories.active, true), inArray(s.categories.modalityId, ["corrida-carro", "corrida-moto"])));
    // Ordem fixa: carros do menor para o maior, a moto por último; categorias novas do painel entram antes da moto.
    const ORDER = ["essencial", "conforto", "familia"];
    const rank = (r: (typeof rows)[number]) => (r.modalityId === "corrida-moto" ? 100 : ORDER.includes(r.slug) ? ORDER.indexOf(r.slug) : 50);
    return rows.filter((r) => r.available || r.modalityId === "corrida-moto").sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .map((r) => ({ name: r.name, description: r.description, seats: r.seats, kind: r.modalityId === "corrida-moto" ? "moto" as const : "car" as const, available: r.available }));
  } catch { return []; }
}

export default async function Home() {
  const [id, cityList, categoryList, user] = await Promise.all([identity(), cities(), categories(), currentUser()]);
  return (
    <>
      <Hero cities={cityList} signedIn={user?.role ?? null} />
      <OrbiStory cities={cityList.filter((c) => c.slug).map((c) => ({ slug: c.slug!, name: c.name }))} />
      <StoryPhone />
      <Services categories={categoryList} />
      <Safety />
      <DriverBand car={identityById(id).car} />
      <FinalCta />
      <QuoteBar />
    </>
  );
}
