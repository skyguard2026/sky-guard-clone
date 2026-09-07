/**
 * Aplikace žije pod /hub vedle veřejného webu, který je statický v public/.
 * basePath v Next nejde použít — aplikoval by se i na public/ a rozbil
 * veřejné adresy. Prefix se proto skládá tady, na jednom místě.
 */
export const HUB = "/hub";

/** `/klienti` → `/hub/klienti`, `/` → `/hub`. */
export function hub(path: string = "/"): string {
  if (path === "/" || path === "") return HUB;
  return HUB + (path.startsWith("/") ? path : `/${path}`);
}
