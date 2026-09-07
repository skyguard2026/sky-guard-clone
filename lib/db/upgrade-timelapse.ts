/**
 * Jednorázová aktualizace katalogu na časosběrné kamery.
 *
 * Seed plní jen prázdnou tabulku, takže existující produkci se nedotkne —
 * tohle je vědomý krok navíc. Je idempotentní: opakované spuštění nic
 * nezdvojí a nepřepíše ceny, které někdo mezitím upravil ručně.
 */
import { eq, sql } from "drizzle-orm";
import { SEED_CATALOG } from "../defaults";
import { catalogItems } from "./schema";
import type { AnyPgDatabase } from "./seed-core";

/** Položky, které mají všechny typy kamer, ne jen bezpečnostní. */
export const CAMERA_ALL_ITEMS = [
  "cam_backplate",
  "cam_material",
  "cam_card",
] as const;

/** Položky, které přibyly s časosběrnými kamerami. */
export const TIMELAPSE_ITEMS = [
  "cam_tl_big",
  "cam_tl_small",
  "cam_solar",
  "cam_sim_tmobile",
  "cam_modem",
] as const;

export interface UpgradeReport {
  driversUpdated: number;
  itemsAdded: string[];
  itemsAlreadyPresent: string[];
}

export async function upgradeCatalogForTimelapse(
  db: AnyPgDatabase,
): Promise<UpgradeReport> {
  // 1. Tři položky přejdou na driver cameraAll. Ostatní sloupce se nechávají,
  //    aby se nepřepsala ručně upravená cena.
  const updated = await db
    .update(catalogItems)
    .set({ driver: "cameraAll" })
    .where(
      sql`${catalogItems.id} in ${CAMERA_ALL_ITEMS} and ${catalogItems.driver} <> 'cameraAll'`,
    )
    .returning({ id: catalogItems.id });

  // 2. Doplní se všechny položky z výchozího katalogu, které v databázi
  //    ještě nejsou. Pevný seznam by se musel udržovat při každé další
  //    položce a dřív nebo později by se zapomněl.
  const existing = await db.select({ id: catalogItems.id }).from(catalogItems);
  const have = new Set(existing.map((r) => r.id));

  const toAdd = SEED_CATALOG.filter((i) => !have.has(i.id)).map((i) => ({
    id: i.id,
    label: i.label,
    group: i.group,
    cat: i.cat,
    price: i.price,
    life: i.life ?? null,
    billing: i.billing,
    driver: i.driver,
    shared: !!i.shared,
    prepay: i.prepay !== false,
    enabled: i.enabled !== false,
    note: i.note ?? "",
    sort: i.sort ?? 0,
  }));

  if (toAdd.length) await db.insert(catalogItems).values(toAdd);

  return {
    driversUpdated: updated.length,
    itemsAdded: toAdd.map((i) => i.id),
    itemsAlreadyPresent: [...have].filter((id) =>
      (TIMELAPSE_ITEMS as readonly string[]).includes(id),
    ),
  };
}

/** Kontrola, že katalog po aktualizaci odpovídá očekávání. */
export async function verifyTimelapseCatalog(db: AnyPgDatabase) {
  const rows = await db.select().from(catalogItems);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const problems: string[] = [];

  for (const id of CAMERA_ALL_ITEMS) {
    if (byId.get(id)?.driver !== "cameraAll")
      problems.push(`${id} nemá driver cameraAll`);
  }
  for (const id of ["cam_mezikus", "cam_pruchodka"]) {
    if (byId.get(id)?.driver !== "camera")
      problems.push(`${id} má mít driver camera`);
  }
  for (const i of SEED_CATALOG) {
    if (!byId.has(i.id)) problems.push(`chybí položka ${i.id}`);
  }
  return { count: rows.length, problems };
}

/**
 * Doplnění ceny modemu.
 *
 * Ceny se tu přepisují schválně, na rozdíl od zbytku aktualizace: je to
 * vědomá změna ceníku. Jména klientů ani konfigurace lokalit tenhle modul
 * nemění — patří uživateli, ne skriptu.
 */
export async function updateModemPrice(
  db: AnyPgDatabase,
): Promise<{ changed: string[] }> {
  const r = await db
    .update(catalogItems)
    .set({ price: 2500, note: "Cena ověřená." })
    .where(eq(catalogItems.id, "cam_modem"))
    .returning({ id: catalogItems.id });
  return { changed: r.length ? ["cam_modem"] : [] };
}

/** Vypnutí položky na lokalitě přes mapu off. */
export const offMap = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, true])) as Record<string, boolean>;

export { eq };
