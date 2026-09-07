/**
 * Adresa veřejného webu, na který se z Hubu odkazuje „zpět na web"
 * (odhlášení, přihlašovací stránka, stránka pro náhled bez databáze).
 *
 * Dnes je nový web na /nova a na kořeni běží starý. Až nový web přejde
 * na kořen, změní se jen tahle konstanta.
 */
export const PUBLIC_SITE = "/nova";

/** Odkaz na sekci veřejného webu, např. webUrl("kontakt") → /nova#kontakt. */
export function webUrl(section = ""): string {
  return section ? `${PUBLIC_SITE}#${section}` : PUBLIC_SITE;
}
