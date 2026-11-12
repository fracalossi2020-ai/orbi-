import type { MetadataRoute } from "next";

/**
 * Manifesto do app: no Android, "Instalar app"; no iPhone, Compartilhar › "Adicionar à Tela de Início".
 * Abre em tela cheia, sem a barra do navegador, direto na tela de viagem.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orbi — Sua direção, nosso compromisso.",
    short_name: "Orbi",
    description: "Mobilidade no Vale do Aço: preço antes de pedir, motorista identificado e viagem compartilhada.",
    lang: "pt-BR",
    start_url: "/passageiro",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#02060E",
    theme_color: "#02060E",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512m", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pedir viagem", url: "/passageiro" },
      { name: "Dirigir", url: "/motorista" },
    ],
  };
}
