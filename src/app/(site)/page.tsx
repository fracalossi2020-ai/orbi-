import { eq } from "drizzle-orm";
import { Hero } from "@/components/site/Hero";
import { DriverBand, QuoteBar } from "@/components/site/HomeSections";
import { FinalCta } from "@/components/site/FinalCta";
import { ConceptStrip, HomeFaq } from "@/components/site/Landing";
import { homeFaq } from "@/lib/home-faq";
import { getDb, schema as s } from "@/db";
import { currentUser } from "@/server/auth";

/** Só cidades ativas no painel aparecem; o raio desenha a área atendida no mapa. */
async function cities() {
  try {
    const db = await getDb();
    return await db.select({ id: s.regions.id, slug: s.regions.slug, name: s.regions.name, state: s.regions.state, lat: s.regions.lat, lng: s.regions.lng, radiusKm: s.regions.radiusKm })
      .from(s.regions).where(eq(s.regions.active, true));
  } catch { return []; }
}

export default async function Home() {
  const [cityList, user] = await Promise.all([cities(), currentUser()]);
  const faq = homeFaq(cityList.map((c) => c.name));
  // Dados estruturados: o Google pode mostrar as respostas direto na busca.
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <>
      {/* 1. O que é: título, preço na hora e os três passos */}
      <Hero cities={cityList} signedIn={user?.role ?? null} />
      <ConceptStrip />
      {/* 2. No app: convite para passageiros e a parte de motoristas */}
      <FinalCta />
      <DriverBand />
      {/* 3. Dúvidas, redes sociais e contato */}
      <HomeFaq items={faq} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <QuoteBar />
    </>
  );
}
