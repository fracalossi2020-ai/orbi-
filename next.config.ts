import type { NextConfig } from "next";

// HSTS só com HTTPS de verdade: o navegador passa a recusar a versão sem cadeado do site.
const https = (process.env.APP_URL ?? "").startsWith("https://");
const prod = process.env.NODE_ENV === "production";
// Versão vitrine (GitHub Pages): páginas prontas, sem servidor. Montada por scripts/build-pages.mjs.
const staticSite = process.env.NEXT_PUBLIC_STATIC === "1";

const config: NextConfig = {
  // Teste no celular pelo túnel da Cloudflare (npm run celular). Não liste IPs da rede local aqui:
  // isso fez o servidor de desenvolvimento recarregar a página sem parar.
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Não anuncia qual tecnologia o servidor usa.
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  transpilePackages: ["three"],
  ...(staticSite ? {
    output: "export" as const,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
    trailingSlash: true,
    images: { unoptimized: true },
    // Os tipos já são checados no npm run typecheck; aqui a checagem tropeçaria nos tipos gerados dos apps tirados do build.
    typescript: { ignoreBuildErrors: true },
  } : {}),
  // Páginas prontas não têm servidor para mandar cabeçalhos; o GitHub Pages usa os dele.
  ...(staticSite ? {} : { headers }),
};
export default config;

async function headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Isola a janela do site de abas abertas por outros sites. Só em produção: no servidor de desenvolvimento,
          // estes dois cabeçalhos fazem a atualização ao vivo recarregar a página sem parar.
          ...(prod ? [
            { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
            { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          ] : []),
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          // Só o que o app usa: localização e tela acesa (motorista). O resto fica desligado.
          { key: "Permissions-Policy", value: "geolocation=(self), screen-wake-lock=(self), camera=(), microphone=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), midi=(), display-capture=(), browsing-topics=()" },
          ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
      // A API nunca é aberta dentro de outro site nem guardada em cache compartilhado.
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }] },
      { source: "/models/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
}
