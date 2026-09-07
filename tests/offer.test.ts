/**
 * Nabídka jako neměnný snímek.
 *
 * Nejdůležitější je scénář ze zadání: vytvořit nabídku, změnit cenu doku
 * v katalogu, ověřit, že čísla v nabídce zůstala. Vedle toho nová verze,
 * která naopak musí odrážet nový výpočet.
 */
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recalcFromSnapshot, toOfferDocument } from "../lib/offer";
import {
  createOffer,
  deleteDraftOffer,
  listOffers,
  setOfferStatus,
} from "../lib/db/offer-ops";
import {
  catalogItems,
  clients,
  locations,
  offers,
  schema,
} from "../lib/db/schema";
import { seedIfEmpty } from "../lib/db/seed-core";
import { containsAmount, findForbiddenTerms } from "../lib/pdf/forbidden-terms";

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

const NOW = new Date("2026-03-01T10:00:00.000Z");
const VALID = new Date("2026-03-31T10:00:00.000Z");

const input = (over: Partial<Parameters<typeof createOffer>[1]> = {}) => ({
  locationId: "l1",
  scope: "Autonomní vzdušný dohled lokality.",
  note: "",
  commitmentMonths: 36,
  validUntil: VALID,
  ...over,
});

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedIfEmpty(db);
  await db.insert(clients).values({ id: "c1", name: "Klient" });
  await db.insert(locations).values({
    id: "l1",
    clientId: "c1",
    name: "Areál Pelhřimov",
    product: "drone",
    price: 50000,
    setupFee: 120000,
    commitmentMonths: 36,
    cameras: 0,
    poles: 0,
    docks: 1,
    km: 260,
    hours: 8,
    trips1: 10,
    trips2: 8,
    off: {},
    over: {},
    qty: {},
  });
});

afterEach(async () => {
  await pg.close();
});

describe("vznik nabídky", () => {
  it("zmrazí spočítaný výsledek i konfiguraci", async () => {
    const res = await createOffer(db, input(), NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const s = res.offer.snapshot;
    // čísla se berou z aktuálního ceníku, ne ze SPEC — nabídka má zmrazit
    // to, co platilo v okamžiku vzniku
    expect(Math.round(s.result.day0)).toBe(521565);
    expect(s.result.fullMonthly).toBeGreaterThan(25378.35);
    // poplatek 120 000 posune start hotovosti na −401 565
    expect(Math.round(s.result.flowStart)).toBe(-401565);
    expect(s.result.payback).toBeGreaterThan(0);
    expect(Math.round(s.result.flowStart)).toBe(-401565);
    expect(s.location.docks).toBe(1);
    expect(s.location.setupFee).toBe(120000);
    expect(s.clientName).toBe("Klient");
    expect(s.locationName).toBe("Areál Pelhřimov");
    expect(s.catalog).toHaveLength(42);
    expect(s.takenAt).toBe(NOW.toISOString());
  });

  it("cenu, poplatek i číslo bere z lokality a z pořadí", async () => {
    const res = await createOffer(db, input(), NOW);
    if (!res.ok) throw new Error(res.error);
    expect(res.offer.number).toBe("2026-001");
    expect(res.offer.version).toBe(1);
    expect(res.offer.status).toBe("draft");
    expect(res.offer.monthlyPrice).toBe(50000);
    expect(res.offer.setupFee).toBe(120000);
    expect(res.offer.commitmentMonths).toBe(36);
  });

  it("přepočet ze snímku dá stejná čísla", async () => {
    const res = await createOffer(db, input(), NOW);
    if (!res.ok) throw new Error(res.error);
    const r = recalcFromSnapshot(res.offer.snapshot);
    expect(r.day0).toBe(res.offer.snapshot.result.day0);
    expect(r.fullMonthly).toBe(res.offer.snapshot.result.fullMonthly);
    expect(r.payback).toBe(res.offer.snapshot.result.payback);
    expect(r.flow[0]).toBe(res.offer.snapshot.result.flowStart);
  });

  it("nabídka na neexistující lokalitu se odmítne", async () => {
    const res = await createOffer(db, input({ locationId: "nic" }), NOW);
    expect(res).toEqual({ ok: false, error: "Lokalita neexistuje." });
  });
});

describe("nabídka je neměnný snímek", () => {
  it("změna ceny doku v katalogu s hotovou nabídkou nehne", async () => {
    const res = await createOffer(db, input(), NOW);
    if (!res.ok) throw new Error(res.error);
    const puvodni = { ...res.offer.snapshot.result };

    await db
      .update(catalogItems)
      .set({ price: 400000 })
      .where(eq(catalogItems.id, "dr_dock"));

    const [ulozena] = await listOffers(db, "l1");
    expect(ulozena.snapshot.result).toEqual(puvodni);
    expect(Math.round(ulozena.snapshot.result.day0)).toBe(521565);
    expect(
      ulozena.snapshot.catalog.find((i) => i.id === "dr_dock")!.price,
    ).toBe(268587);
    expect(ulozena.monthlyPrice).toBe(50000);
    expect(recalcFromSnapshot(ulozena.snapshot).day0).toBe(puvodni.day0);
  });

  it("změna konfigurace lokality s hotovou nabídkou nehne", async () => {
    const res = await createOffer(db, input(), NOW);
    if (!res.ok) throw new Error(res.error);

    await db
      .update(locations)
      .set({ docks: 3, price: 90000, setupFee: 0 })
      .where(eq(locations.id, "l1"));

    const [ulozena] = await listOffers(db, "l1");
    expect(ulozena.snapshot.location.docks).toBe(1);
    expect(ulozena.monthlyPrice).toBe(50000);
    expect(ulozena.setupFee).toBe(120000);
    expect(Math.round(ulozena.snapshot.result.day0)).toBe(521565);
  });

  it("smazání položky z katalogu snímek nepoškodí", async () => {
    const res = await createOffer(db, input(), NOW);
    if (!res.ok) throw new Error(res.error);
    await db.delete(catalogItems).where(eq(catalogItems.id, "dr_dock"));

    const [ulozena] = await listOffers(db, "l1");
    expect(ulozena.snapshot.catalog).toHaveLength(42);
    expect(recalcFromSnapshot(ulozena.snapshot).day0).toBe(
      ulozena.snapshot.result.day0,
    );
  });

  it("změna nastavení modelu s hotovou nabídkou nehne", async () => {
    const res = await createOffer(db, input(), NOW);
    if (!res.ok) throw new Error(res.error);
    await db.update(schema.settings).set({ horizon: 60, prepay: false });

    const [ulozena] = await listOffers(db, "l1");
    expect(ulozena.snapshot.settings.horizon).toBe(36);
    expect(ulozena.snapshot.settings.prepay).toBe(true);
  });
});

describe("nová verze bere ekonomiku čerstvou", () => {
  it("po zdražení doku má verze 2 jiná čísla než verze 1", async () => {
    const v1 = await createOffer(db, input(), NOW);
    if (!v1.ok) throw new Error(v1.error);

    await db
      .update(catalogItems)
      .set({ price: 400000 })
      .where(eq(catalogItems.id, "dr_dock"));
    await db
      .update(locations)
      .set({ price: 62000 })
      .where(eq(locations.id, "l1"));

    const v2 = await createOffer(
      db,
      input({ baseNumber: v1.offer.number }),
      new Date("2026-04-01T10:00:00.000Z"),
    );
    if (!v2.ok) throw new Error(v2.error);

    expect(v2.offer.number).toBe("2026-001");
    expect(v2.offer.version).toBe(2);
    // ekonomika je nová
    expect(v2.offer.monthlyPrice).toBe(62000);
    expect(Math.round(v2.offer.snapshot.result.day0)).toBe(
      521565 + (400000 - 268587),
    );
    expect(
      v2.offer.snapshot.catalog.find((i) => i.id === "dr_dock")!.price,
    ).toBe(400000);
    // a verze 1 se přitom nezměnila
    const vsechny = await listOffers(db, "l1");
    const stara = vsechny.find((o) => o.version === 1)!;
    expect(Math.round(stara.snapshot.result.day0)).toBe(521565);
    expect(stara.monthlyPrice).toBe(50000);
  });

  it("nová verze nedědí čísla po předchozí, ani když se nic nezměnilo", async () => {
    const v1 = await createOffer(db, input(), NOW);
    if (!v1.ok) throw new Error(v1.error);
    const v2 = await createOffer(
      db,
      input({ baseNumber: v1.offer.number }),
      new Date("2026-04-01T10:00:00.000Z"),
    );
    if (!v2.ok) throw new Error(v2.error);
    // stejný vstup, stejný výsledek — ale snímek je vlastní, ne sdílený
    expect(v2.offer.snapshot.result).toEqual(v1.offer.snapshot.result);
    expect(v2.offer.snapshot.takenAt).not.toBe(v1.offer.snapshot.takenAt);
    expect(v2.offer.id).not.toBe(v1.offer.id);
  });
});

describe("číslování", () => {
  it("jde po sobě v rámci roku", async () => {
    const a = await createOffer(db, input(), NOW);
    const b = await createOffer(db, input(), NOW);
    const c = await createOffer(db, input(), NOW);
    expect([a, b, c].every((r) => r.ok)).toBe(true);
    expect(
      [a, b, c].map((r) => (r.ok ? r.offer.number : "")),
    ).toEqual(["2026-001", "2026-002", "2026-003"]);
  });

  it("nový rok začíná od jedničky", async () => {
    await createOffer(db, input(), NOW);
    const r = await createOffer(db, input(), new Date("2027-01-05T09:00:00Z"));
    if (!r.ok) throw new Error(r.error);
    expect(r.offer.number).toBe("2027-001");
  });

  it("dvojice číslo a verze je v databázi unikátní", async () => {
    const a = await createOffer(db, input(), NOW);
    if (!a.ok) throw new Error(a.error);
    await expect(
      db.insert(offers).values({
        id: "duplicita",
        locationId: "l1",
        number: a.offer.number,
        version: a.offer.version,
        validUntil: VALID,
        snapshot: a.offer.snapshot,
      }),
    ).rejects.toThrow();
  });

  it("souběžné vytvoření nepřidělí stejné číslo dvakrát", async () => {
    const vysledky = await Promise.all(
      Array.from({ length: 5 }, () => createOffer(db, input(), NOW)),
    );
    const cisla = vysledky
      .filter((r) => r.ok)
      .map((r) => (r.ok ? `${r.offer.number}/${r.offer.version}` : ""));
    expect(cisla.length).toBe(5);
    expect(new Set(cisla).size).toBe(5);
  });
});

describe("stav a mazání", () => {
  it("stav se dá změnit, čísla zůstanou", async () => {
    const r = await createOffer(db, input(), NOW);
    if (!r.ok) throw new Error(r.error);
    await setOfferStatus(db, r.offer.id, "odeslana");
    const [o] = await listOffers(db, "l1");
    expect(o.status).toBe("odeslana");
    expect(o.snapshot.result).toEqual(r.offer.snapshot.result);
  });

  it("smazat jde jen rozpracovaná", async () => {
    const r = await createOffer(db, input(), NOW);
    if (!r.ok) throw new Error(r.error);
    await setOfferStatus(db, r.offer.id, "odeslana");
    const zamitnuto = await deleteDraftOffer(db, r.offer.id);
    expect(zamitnuto.ok).toBe(false);
    expect(await listOffers(db, "l1")).toHaveLength(1);

    await setOfferStatus(db, r.offer.id, "draft");
    expect((await deleteDraftOffer(db, r.offer.id)).ok).toBe(true);
    expect(await listOffers(db, "l1")).toHaveLength(0);
  });

  it("smazání lokality vezme nabídky s sebou", async () => {
    await createOffer(db, input(), NOW);
    await db.delete(locations).where(eq(locations.id, "l1"));
    expect(await db.select().from(offers)).toHaveLength(0);
  });
});

describe("dokument z uložené nabídky je čistý", () => {
  it("v katalogu snímku ceny jsou, v dokumentu ne", async () => {
    const r = await createOffer(db, input(), NOW);
    if (!r.ok) throw new Error(r.error);
    const [ulozena] = await listOffers(db, "l1");

    expect(JSON.stringify(ulozena.snapshot)).toContain("268587");

    const doc = toOfferDocument(ulozena);
    const json = JSON.stringify(doc);
    expect(containsAmount(json, 268587)).toBe(false);
    expect(findForbiddenTerms(json)).toEqual([]);
    expect(doc.monthlyPrice).toBe(50000);
    expect(doc.setupFee).toBe(120000);
  });
});
