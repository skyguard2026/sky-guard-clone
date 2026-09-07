import { cookies } from "next/headers";
import { ACTIVE_LOCATION_COOKIE } from "./auth/constants";

/**
 * Aktivní lokalita je uložená v cookie prohlížeče, ne v databázi.
 * „Společná pro celou aplikaci" znamená společná napříč stránkami, ne napříč
 * lidmi — jinak by přepnutí u jednoho jednatele přehodilo obrazovku druhému
 * uprostřed práce.
 */
export async function getActiveLocationId(
  locations: { id: string }[],
): Promise<string | null> {
  const jar = await cookies();
  const id = jar.get(ACTIVE_LOCATION_COOKIE)?.value;
  if (id && locations.some((l) => l.id === id)) return id;
  return locations[0]?.id ?? null;
}
