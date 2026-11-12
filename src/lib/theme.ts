/**
 * Tema claro/escuro sem script na página:
 * - Escolha da pessoa: cookie "prumo-theme" (dark | light). O servidor lê o cookie e já entrega
 *   o <html data-theme="..."> pronto, então não há clarão nem script para executar antes da pintura.
 * - Sem escolha: o CSS segue o tema do aparelho (prefers-color-scheme).
 */
export const THEME_COOKIE = "prumo-theme";
export type ThemeChoice = "dark" | "light";

export const parseTheme = (value: string | undefined): ThemeChoice | undefined => (value === "dark" || value === "light" ? value : undefined);

/** Tema que está valendo agora na tela, com ou sem escolha salva. */
export function isDarkNow() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set === "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

export function saveTheme(mode: ThemeChoice) {
  document.documentElement.setAttribute("data-theme", mode);
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}
