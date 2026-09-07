/**
 * Operace nad nabídkami.
 *
 * Nabídka je neměnný snímek. Po vložení se mění výhradně `status` — čísla,
 * konfigurace ani katalog se v ní už nikdy nepřepisují, aby odeslaná nabídka
 * zůstala přesně taková, jakou klient dostal.
 */
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { buildSnapshot } from "../offer";
import type { Offer, OfferStatus } from "../offer-types";
import { formatOfferNumber } from "../offer";
import { uid } from "../id";
import { DEFAULT_SETTINGS } from "../defaults";
import { catalogItems, clients, locations, offers, settings } from "./schema";
import type { AnyPgDatabase } from "./seed-core";
import type { CatalogItem, Settings } from "../types";

export interface CreateOfferInput {
  locationId: string;
  scope: string;
  note: string;
  commitmentMonths: number;
  validUntil: Date;
  /**
   * Nová verze existující nabídky. Přebírá se jen číslo — ekonomika se
   * počítá znovu z aktuálního stavu lokality a katalogu, jinak by vznikla
   * nabídka se starými čísly a novým datem.
   */
  baseNumber?: string;
}

export type CreateOfferResult =
  | { ok: true; offer: Offer }
  | { ok: false; error: string };

function rowToOffer(r: typeof offers.$inferSelect): Offer {
  return {
    id: r.id,
    locationId: r.locationId,
    number: r.number,
    version: r.version,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    validUntil: r.validUntil.toISOString(),
    monthlyPrice: r.monthlyPrice,
    setupFee: r.setupFee,
    commitmentMonths: r.commitmentMonths,
    scope: r.scope,
    note: r.note,
    snapshot: r.snapshot,
  };
}

export async function createOffer(
  db: AnyPgDatabase,
  input: CreateOfferInput,
  now: Date,
): Promise<CreateOfferResult> {
  const locRows = await db
    .select()
    .from(locations)
    .where(eq(locations.id, input.locationId))
    .limit(1);
  const loc = locRows[0];
  if (!loc) return { ok: false, error: "Lokalita neexistuje." };

  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, loc.clientId))
    .limit(1);
  const client = clientRows[0];

  const catRows = await db
    .select()
    .from(catalogItems)
    .orderBy(asc(catalogItems.sort));
  const setRows = await db.select().from(settings).limit(1);
  const countRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(locations);

  const catalog: CatalogItem[] = catRows.map((r) => ({ ...r }));
  const st: Settings = setRows[0]
    ? {
        share: setRows[0].share,
        prepay: setRows[0].prepay,
        renew: setRows[0].renew,
        tax: setRows[0].tax,
        horizon: setRows[0].horizon,
        inflation: setRows[0].inflation,
        residualRate: setRows[0].residualRate,
        transferDelay: setRows[0].transferDelay,
      }
    : { ...DEFAULT_SETTINGS };

  // Ekonomika vždy z aktuálního stavu, i u nové verze.
  const snapshot = buildSnapshot({
    clientName: client?.name ?? "",
    locationName: loc.name,
    location: {
      product: loc.product,
      cameras: loc.cameras,
      camerasTlBig: loc.camerasTlBig,
      camerasTlSmall: loc.camerasTlSmall,
      poles: loc.poles,
      docks: loc.docks,
      km: loc.km,
      hours: loc.hours,
      trips1: loc.trips1,
      trips2: loc.trips2,
      price: loc.price,
      setupFee: loc.setupFee,
      commitmentMonths: loc.commitmentMonths,
      off: loc.off ?? {},
      over: loc.over ?? {},
      qty: loc.qty ?? {},
    },
    catalog,
    settings: st,
    locationCount: countRows[0]?.n ?? 1,
    takenAt: now,
  });

  const commitment = Math.max(
    0,
    Math.round(Number(input.commitmentMonths) || 0),
  );

  // Unikátní index na (číslo, verze) zajistí, že souběžný zápis neprojde.
  // Kdyby se dva pokusy potkaly, zkusíme to znovu s dalším pořadím.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { number, version } = input.baseNumber
      ? {
          number: input.baseNumber,
          version: (await maxVersion(db, input.baseNumber)) + 1 + attempt,
        }
      : await nextNumber(db, now.getFullYear(), attempt);

    try {
      const row = {
        id: uid(),
        locationId: loc.id,
        number,
        version,
        status: "draft" as const,
        createdAt: now,
        validUntil: input.validUntil,
        monthlyPrice: loc.price,
        setupFee: loc.setupFee,
        commitmentMonths: commitment,
        scope: input.scope.trim(),
        note: input.note.trim(),
        snapshot,
      };
      const [inserted] = await db.insert(offers).values(row).returning();
      return { ok: true, offer: rowToOffer(inserted) };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // někdo byl rychlejší, zkusíme další číslo
    }
  }
  return {
    ok: false,
    error: "Nepodařilo se přidělit číslo nabídky, zkus to znovu.",
  };
}

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } })?.code
    ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

async function maxVersion(db: AnyPgDatabase, number: string): Promise<number> {
  const rows = await db
    .select({ m: sql<number>`coalesce(max(${offers.version}), 0)::int` })
    .from(offers)
    .where(eq(offers.number, number));
  return rows[0]?.m ?? 0;
}

async function nextNumber(
  db: AnyPgDatabase,
  year: number,
  offset: number,
): Promise<{ number: string; version: number }> {
  const rows = await db
    .select({ number: offers.number })
    .from(offers)
    .where(like(offers.number, `${year}-%`))
    .orderBy(desc(offers.number))
    .limit(1);
  const last = rows[0]?.number;
  const seq = last ? Number(last.split("-")[1]) || 0 : 0;
  return { number: formatOfferNumber(year, seq + 1 + offset), version: 1 };
}

export async function listOffers(
  db: AnyPgDatabase,
  locationId: string,
): Promise<Offer[]> {
  const rows = await db
    .select()
    .from(offers)
    .where(eq(offers.locationId, locationId))
    .orderBy(desc(offers.createdAt), desc(offers.version));
  return rows.map(rowToOffer);
}

export async function getOffer(
  db: AnyPgDatabase,
  id: string,
): Promise<Offer | null> {
  const rows = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  return rows[0] ? rowToOffer(rows[0]) : null;
}

/** Jediná povolená změna už vzniklé nabídky. */
export async function setOfferStatus(
  db: AnyPgDatabase,
  id: string,
  status: OfferStatus,
): Promise<void> {
  await db.update(offers).set({ status }).where(eq(offers.id, id));
}

/** Smazat jde jen rozpracovaná. Odeslaná nabídka je záznam, ten se neruší. */
export async function deleteDraftOffer(
  db: AnyPgDatabase,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await db
    .delete(offers)
    .where(and(eq(offers.id, id), eq(offers.status, "draft")))
    .returning({ id: offers.id });
  if (!res.length) {
    return {
      ok: false,
      error: "Smazat jde jen rozpracovaná nabídka. Odeslanou lze jen odmítnout.",
    };
  }
  return { ok: true };
}
