/**
 * Světlý a tmavý režim Hubu.
 *
 * Volba se drží v cookie (server ji přečte a nastaví data-theme dřív, než
 * se stránka vykreslí, takže nic neproblikne) a pro jistotu i v localStorage.
 * Výchozí je tmavý — to je vzhled značky.
 */
export type Theme = "dark" | "light";

export const THEME_COOKIE = "sg_theme";
export const DEFAULT_THEME: Theme = "dark";

export function parseTheme(v: string | null | undefined): Theme {
  return v === "light" ? "light" : DEFAULT_THEME;
}
