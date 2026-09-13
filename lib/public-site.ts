/**
 * Adresa veřejného webu, na který se z Hubu odkazuje „zpět na web"
 * (odhlášení, přihlašovací stránka, stránka pro náhled bez databáze).
 *
 * Veřejný web běží na kořeni domény; /nova přesměrovává na stejnou stránku.
 */
export const PUBLIC_SITE = "/";

/** Odkaz na sekci veřejného webu, např. webUrl("kontakt") → /#kontakt. */
export function webUrl(section = ""): string {
  return section ? `${PUBLIC_SITE}#${section}` : PUBLIC_SITE;
}
