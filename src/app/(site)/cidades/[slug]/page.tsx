import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb, schema as s } from "@/db";
import { Hero } from "@/components/site/Hero";
import { ValleyLine } from "@/components/site/ValleyLine";
import { Destinations } from "@/components/site/Destinations";
import { Reveal } from "@/components/site/Fx";
import { Icon } from "@/components/Icon";
import { brl } from "@/domain/pricing";
import { currentUser } from "@/server/auth";
import { publicTariffs } from "@/server/public-data";
import { STATIC } from "@/lib/site-mode";

async function cityBySlug(slug: string) {
  try {
    const [r] = await (await getDb()).select().from(s.regions).where(and(eq(s.regions.slug, slug), eq(s.regions.active, true)));
    return r ?? null;
  } catch { return null; }
}

/** Versão vitrine (páginas prontas): uma página por cidade ativa, gerada no build. No servidor normal, nada muda. */
export async function generateStaticParams() {
  if (!STATIC) return [];
  return (await publicTariffs()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const city = await cityBySlug((await params).slug);
  if (!city) return { title: "Cidade não encontrada" };
  return {
    title: `Corridas em ${city.name}`,
    description: `Peça um carro em ${city.name}, ${city.state}, e veja o preço antes de confirmar. Motoristas da região, viagem compartilhada e botão de emergência.`,
    alternates: { canonical: `/cidades/${city.slug}` },
  };
}

const money = (c: number) => brl(c);

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const city = await cityBySlug((await params).slug);
  if (!city) notFound();
  const [user, all] = await Promise.all([currentUser(), publicTariffs().catch(() => [])]);
  const tariffs = all.find((c) => c.id === city.id)?.categories ?? [];
  const others = all.filter((c) => c.id !== city.id);
  const heroCity = { id: city.id, name: city.name, state: city.state, lat: city.lat, lng: city.lng, radiusKm: city.radiusKm };
  // JSON-LD: o Google entende que a Orbi atende esta cidade.
  const jsonLd = { "@context": "https://schema.org", "@type": "TaxiService", name: `Orbi em ${city.name}`, provider: { "@type": "Organization", name: "Orbi" }, areaServed: { "@type": "City", name: city.name, containedInPlace: { "@type": "State", name: "Minas Gerais" } } };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero cities={[heroCity]} signedIn={user?.role ?? null} eyebrow={`${city.name} · ${city.state} · atendida pela Orbi`}
        words={[`${city.name}.`, "Rua por rua,", "na Orbi."]} lead={`Peça um carro em ${city.name} e veja o preço antes de confirmar. A rota real aparece no mapa.`} />

      {/* Tarifa aberta: os números exatos do painel, para qualquer pessoa conferir. */}
      {tariffs.length > 0 && (
        <section aria-labelledby="tarifa" className="on-deep relative overflow-hidden bg-deep text-on-deep">
          <div aria-hidden="true" className="grid-lines absolute inset-0" />
          <div className="relative mx-auto max-w-[1280px] px-5 py-20 md:px-10 md:py-24">
            <Reveal className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-end">
              <div>
                <p className="mono-label text-on-deep-muted">Tarifa aberta · {city.name}</p>
                <h2 id="tarifa" className="display mt-3 text-[clamp(2.2rem,4.8vw,4.2rem)] leading-[.95]">Cada centavo, à vista.</h2>
              </div>
              <p className="max-w-[44ch] text-on-deep-muted md:justify-self-end">A tarifa que vale hoje em {city.name}, igual à que o app usa no seu pedido. O preço da viagem soma tudo e aparece antes de você confirmar.</p>
            </Reveal>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {tariffs.map((c, i) => (
                <Reveal key={c.slug} delay={i * .06} className="tariff-card relative overflow-hidden rounded-[26px] p-6 shadow-[0_0_0_1px_color-mix(in_srgb,var(--on-deep)_14%,transparent)_inset]">
                  <div className="flex items-baseline justify-between"><h3 className="display text-3xl">{c.name}</h3><span className="mono-label text-on-deep-muted">até {c.seats}</span></div>
                  <dl className="num mt-6 space-y-2.5 font-mono text-sm">
                    {[["Bandeirada", money(c.tariff.baseCents)], ["Por km", money(c.tariff.perKmCents)], ["Por minuto", money(c.tariff.perMinCents)], ["Corrida mínima", money(c.tariff.minCents)], ["Taxa de serviço", money(c.tariff.serviceFeeCents)]].map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-2"><dt className="text-on-deep-muted">{k}</dt><span aria-hidden="true" className="flex-1 border-b border-dotted border-[color-mix(in_srgb,var(--on-deep)_25%,transparent)]" /><dd className="font-semibold">{v}</dd></div>
                    ))}
                  </dl>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <Destinations city={city.name} />
      <ValleyLine activeCities={[city.name]} />

      {others.length > 0 && (
        <section className="on-deep bg-deep text-on-deep">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-5 px-5 py-14 md:px-10">
            <p className="display text-2xl md:text-3xl">A Orbi também roda em</p>
            <div className="flex flex-wrap gap-2">
              {others.map((o) => <Link key={o.id} href={`/cidades/${o.slug}`} className="btn btn-line-deep">{o.name} <Icon name="arrow" size={16} /></Link>)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
