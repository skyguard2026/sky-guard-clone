/**
 * Zdroj výchozích dat.
 *
 * Katalog se načítá přímo z `reference/catalog-seed.json` — z jednoho jediného
 * fyzického souboru. Plnicí skript i testy sahají sem, ne na vlastní kopii.
 * Kdyby si každý odnesl svou kopii, rozejdou se a testy začnou zeleně lhát.
 */
import seed from "../reference/catalog-seed.json";
import type { CatalogItem, Settings } from "./types";

/** Výchozí katalog 37 nákladových položek — SPEC.md §2. */
export const SEED_CATALOG: CatalogItem[] = seed as CatalogItem[];

/** Výchozí nastavení — SPEC.md §2, tabulka nastavení. */
export const DEFAULT_SETTINGS: Settings = {
  share: true,
  prepay: true,
  renew: true,
  tax: 21,
  horizon: 36,
  inflation: 0,
  // Odhad, ne měřená hodnota. Upraví se, až bude první stanice reálně
  // odstavená a bude se vědět, co se z ní dá dostat zpátky.
  residualRate: 40,
  transferDelay: 6,
};

/** Vstupy nové lokality. */
export const DEFAULT_LOCATION_INPUTS = {
  cameras: 0,
  camerasTlBig: 0,
  camerasTlSmall: 0,
  poles: 0,
  docks: 1,
  km: 0,
  hours: 8,
  trips1: 10,
  trips2: 8,
  price: 50000,
  setupFee: 0,
  commitmentMonths: 24,
};

/** Výchozí platnost nabídky ve dnech od vystavení. */
export const OFFER_VALID_DAYS = 30;
