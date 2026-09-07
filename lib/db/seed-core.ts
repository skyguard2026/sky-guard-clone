/**
 * Naplnění výchozích dat. Idempotentní.
 *
 * Katalog se naplní jen tehdy, když je tabulka prázdná. Jinak by každý další
 * deploy přepsal ceny, které mezitím někdo ručně upravil — a to je nejcennější
 * obsah celé aplikace. Přepsání do výchozího stavu je výhradně vědomá akce
 * z Nastavení (viz resetCatalog v app/actions/settings.ts).
 */
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../defaults";
import { catalogItems, settings } from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyPgDatabase = PgDatabase<PgQueryResultHKT, any, any>;

export interface SeedReport {
  catalogSeeded: boolean;
  catalogCount: number;
  settingsSeeded: boolean;
}

/** Řádky katalogu ve tvaru pro vložení do databáze. */
export function catalogRows() {
  return SEED_CATALOG.map((i, idx) => ({
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
    sort: i.sort ?? idx * 10,
  }));
}

/** Naplní katalog jen nad prázdnou tabulkou. Nikdy nepřepisuje existující ceny. */
export async function seedIfEmpty(db: AnyPgDatabase): Promise<SeedReport> {
  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(catalogItems);
  const count = existing[0]?.n ?? 0;

  let catalogSeeded = false;
  if (count === 0) {
    await db.insert(catalogItems).values(catalogRows());
    catalogSeeded = true;
  }

  const s = await db.select({ id: settings.id }).from(settings).limit(1);
  let settingsSeeded = false;
  if (s.length === 0) {
    await db.insert(settings).values({ id: 1, ...DEFAULT_SETTINGS });
    settingsSeeded = true;
  }

  const after = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(catalogItems);

  return {
    catalogSeeded,
    catalogCount: after[0]?.n ?? 0,
    settingsSeeded,
  };
}

/**
 * Vědomé přepsání katalogu do výchozího stavu — jen z Nastavení.
 * Odkazy v off/over/qty u lokalit zůstávají; jádro osiřelé odkazy ignoruje.
 */
export async function resetCatalogRows(db: AnyPgDatabase): Promise<void> {
  await db.delete(catalogItems);
  await db.insert(catalogItems).values(catalogRows());
}
