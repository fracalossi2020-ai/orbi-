import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { preconnect } from "react-dom";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { asset, STATIC } from "@/lib/site-mode";

// Inter é a fonte do manual da marca (Regular, Medium, Semibold e Bold). A mono fica só para números de painel.
const inter = Inter({ display: "swap", subsets: ["latin"], variable: "--f-inter", preload: true });
// Títulos: Inter Tight, a versão compacta da própria Inter, para manchetes grandes com desenho mais firme.
const interTight = Inter_Tight({ display: "swap", subsets: ["latin"], variable: "--f-inter-tight", preload: true, weight: ["600", "700", "800"] });
const mono = Geist_Mono({ display: "swap", subsets: ["latin"], preload: false, variable: "--f-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  // Endereço público do site: links e imagens de compartilhamento saem completos (APP_URL no .env).
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Orbi — Sua direção, nosso compromisso.", template: "%s · Orbi" },
  description: "Uma nova forma de fazer mobilidade. Mais respeito para quem dirige. Mais confiança para quem chega.",
  icons: { icon: asset("/icon.svg"), ...(STATIC ? {} : { apple: "/app-icon/180" }) },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Orbi" },
  // iPhone: aberto pela tela de início, vira app em tela cheia (sem a barra do Safari).
  appleWebApp: { capable: true, title: "Orbi", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#02060E" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A identidade da Orbi está definida (manual da marca): as propostas antigas não se aplicam mais.
  const identity = "a";
  // Versão vitrine (páginas prontas): sem cookies; o tema segue o do aparelho.
  const theme = STATIC ? parseTheme(undefined) : parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const fonts = [inter, interTight, mono].map((f) => f.variable).join(" ");
  // Abre a conexão com o servidor de mapas já no carregamento da página, antes de o mapa pedir algo.
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  return (
    <html lang="pt-BR" data-identity={identity} data-theme={theme} className={fonts} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
