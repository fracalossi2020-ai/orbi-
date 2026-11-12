import type { MetadataRoute } from "next";

/** Buscadores leem o site público; aplicativos, painel e API ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/passageiro", "/motorista", "/v/", "/identidade"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
