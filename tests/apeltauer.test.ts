/**
 * Aktualizace katalogu a naplnění produkce, proti skutečné databázi.
 *
 * Obojí musí být idempotentní — pouští se to na ostrá data, kde už někdo
 * mohl ručně upravit ceny nebo konfiguraci.
 */
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calc } from "../lib/calc";
import {
  APELTAUER_CLIENTS,
  APELTAUER_LOCATIONS,
  loadApeltauerData,
} from "../lib/db/apeltauer-data";
import { catalogItems, clients, locations, schema } from "../lib/db/schema";
import { seedIfEmpty } from "../lib/db/seed-core";
import {
  updateModemPrice,
  upgradeCatalogForTimelapse,
  verifyTimelapseCatalog,
} from "../lib/db/upgrade-timelapse";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

/**
 * Katalog před časosběrnými kamerami — položky, které v ceníku jsou dodnes.
 * Simuluje produkci, do které se nová aktualizace teprve pouští.
 */
async function starýKatalog() {
  const zaklad = SEED_CATALOG.filter(
    (i) =>
      ![
        "cam_tl_big",
        "cam_tl_small",
        "cam_solar",
        "cam_sim_tmobile",
        "cam_modem",
        "sh_trip_work",
        "sh_trip_km",
      ].includes(i.id),
  ).map((i) => ({
    id: i.id,
    label: i.label,
    group: i.group,
    cat: i.cat,
    price: i.price,
    life: i.life ?? null,
    billing: i.billing,
    // tři položky měly původně driver camera
    driver: ["cam_backplate", "cam_material", "cam_card"].includes(i.id)
      ? ("camera" as const)
      : i.driver,
    shared: !!i.shared,
    prepay: i.prepay !== false,
    enabled: i.enabled !== false,
    note: i.note ?? "",
    sort: i.sort ?? 0,
  }));

  await db.insert(catalogItems).values(zaklad);
}

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterEach(async () => {
  await pg.close();
});

describe("aktualizace katalogu je idempotentní", () => {
  it("ze starého katalogu udělá nový", async () => {
    await starýKatalog();
    expect(await db.select().from(catalogItems)).toHaveLength(35);

    const r = await upgradeCatalogForTimelapse(db);
    expect(r.driversUpdated).toBe(3);
    expect(r.itemsAdded.sort()).toEqual([
      "cam_modem",
      "cam_sim_tmobile",
      "cam_solar",
      "cam_tl_big",
      "cam_tl_small",
      "sh_trip_km",
      "sh_trip_work",
    ]);
    const v = await verifyTimelapseCatalog(db);
    expect(v.problems).toEqual([]);
    expect(v.count).toBe(42);
  });

  it("druhé spuštění nic nezdvojí ani nepřepíše", async () => {
    await starýKatalog();
    await upgradeCatalogForTimelapse(db);
    const r = await upgradeCatalogForTimelapse(db);
    expect(r.driversUpdated).toBe(0);
    expect(r.itemsAdded).toEqual([]);
    expect(await db.select().from(catalogItems)).toHaveLength(42);
  });

  it("nepřepíše ručně upravenou cenu", async () => {
    await starýKatalog();
    await db
      .update(catalogItems)
      .set({ price: 7777 })
      .where(eq(catalogItems.id, "cam_backplate"));
    await upgradeCatalogForTimelapse(db);
    const bp = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "cam_backplate"),
    });
    // driver se změnil, cena zůstala
    expect(bp!.driver).toBe("cameraAll");
    expect(bp!.price).toBe(7777);
  });

  it("nad už aktuálním katalogem neudělá nic", async () => {
    await seedIfEmpty(db);
    const r = await upgradeCatalogForTimelapse(db);
    expect(r.driversUpdated).toBe(0);
    expect(r.itemsAdded).toEqual([]);
  });
});

describe("naplnění klientů a lokalit", () => {
  beforeEach(async () => {
    await seedIfEmpty(db);
  });

  it("založí dva klienty a čtyři lokality", async () => {
    const r = await loadApeltauerData(db);
    expect(r.clientsAdded).toEqual(["cl_apeltauer", "cl_kerosin"]);
    const jmena = (await db.select().from(clients)).map((c) => c.name).sort();
    expect(jmena).toEqual(["Apeltauer", "Kerosin"]);
    expect(r.locationsAdded).toHaveLength(4);
    expect(await db.select().from(clients)).toHaveLength(2);
    expect(await db.select().from(locations)).toHaveLength(4);
  });

  it("druhé spuštění nic nezdvojí", async () => {
    await loadApeltauerData(db);
    const r = await loadApeltauerData(db);
    expect(r.clientsAdded).toEqual([]);
    expect(r.locationsAdded).toEqual([]);
    expect(await db.select().from(locations)).toHaveLength(4);
  });

  it("nepřepíše lokalitu, kterou jsi mezitím upravil", async () => {
    await loadApeltauerData(db);
    await db
      .update(locations)
      .set({ price: 25000, km: 42 })
      .where(eq(locations.id, "loc_klanecna"));
    await loadApeltauerData(db);
    const l = await db.query.locations.findFirst({
      where: eq(locations.id, "loc_klanecna"),
    });
    expect(l!.price).toBe(25000);
    expect(l!.km).toBe(42);
  });

  it("smaže testovací záznamy, když se o to řekne", async () => {
    await db.insert(clients).values({ id: "t1", name: "Zemědělské družstvo Vysočina" });
    await db.insert(locations).values({
      id: "tl1",
      clientId: "t1",
      name: "Areál Pelhřimov",
      product: "drone",
    });
    const r = await loadApeltauerData(db, { removeTestData: true });
    expect(r.testDataRemoved).toContain("Zemědělské družstvo Vysočina");
    expect(await db.select().from(clients)).toHaveLength(2);
    // lokalita testovacího klienta odešla s ním
    expect(await db.select().from(locations)).toHaveLength(4);
  });

  it("bez vyžádání testovací data nemaže", async () => {
    await db.insert(clients).values({ id: "t1", name: "Zemědělské družstvo Vysočina" });
    const r = await loadApeltauerData(db);
    expect(r.testDataRemoved).toEqual([]);
    expect(await db.select().from(clients)).toHaveLength(3);
  });
});

describe("lokality vycházejí jak mají", () => {
  beforeEach(async () => {
    await seedIfEmpty(db);
    await loadApeltauerData(db);
  });

  const spocitej = async (id: string) => {
    const l = (await db.query.locations.findFirst({
      where: eq(locations.id, id),
    }))!;
    const cat = await db.query.catalogItems.findMany();
    const pocet = (await db.select().from(locations)).length;
    return { l, r: calc(l, cat, DEFAULT_SETTINGS, pocet) };
  };

  it("Mírovka BESS: 5 kamer celkem, Starlink vypnutý", async () => {
    const { l, r } = await spocitej("loc_mirovka_bess");
    expect(l.cameras).toBe(3);
    expect(l.camerasTlBig).toBe(2);
    expect(l.poles).toBe(3);
    expect(r.lines.find((x) => x.it.id === "cam_card")!.q).toBe(5);
    expect(r.lines.find((x) => x.it.id === "cam_mezikus")!.q).toBe(3);
    expect(r.lines.some((x) => x.it.id === "cam_starlink")).toBe(false);
    expect(r.lines.find((x) => x.it.id === "cam_tl_big")!.q).toBe(2);
    expect(r.lines.find((x) => x.it.id === "cam_sim_tmobile")!.q).toBe(1);
    expect(r.lines.some((x) => x.it.id === "cam_solar")).toBe(false);
    expect(l.qty).not.toHaveProperty("cam_solar");
    // centrální rozvaděč je zapnutý, modem má nulovou cenu, takže v rozpadu není
    expect(r.lines.find((x) => x.it.id === "cam_box")!.q).toBe(1);
    expect(l.trips2).toBe(12);
  });

  it("Klanečná: 7 kamer, Starlink zapnutý", async () => {
    const { l, r } = await spocitej("loc_klanecna");
    expect(l.cameras).toBe(6);
    expect(l.camerasTlSmall).toBe(1);
    expect(r.lines.find((x) => x.it.id === "cam_card")!.q).toBe(7);
    expect(r.lines.find((x) => x.it.id === "cam_mezikus")!.q).toBe(6);
    expect(r.lines.find((x) => x.it.id === "cam_starlink")!.amount).toBe(745);
    expect(r.lines.find((x) => x.it.id === "cam_solar")!.q).toBe(1);
  });

  it("Jasmínová: jedna kamera, žádný rozvaděč", async () => {
    const { l, r } = await spocitej("loc_jasminova");
    expect(l.poles).toBe(0);
    expect(l.camerasTlSmall).toBe(1);
    for (const id of [
      "cam_box",
      "cam_switch",
      "cam_socket",
      "cam_modem",
      "cam_starlink",
      "cam_pole",
    ]) {
      expect(r.lines.some((x) => x.it.id === id), id).toBe(false);
    }
    expect(r.lines.find((x) => x.it.id === "cam_tl_small")!.amount).toBe(20000);
    expect(r.lines.find((x) => x.it.id === "cam_solar")!.q).toBe(1);
    expect(l.trips2).toBe(5);
  });

  it("Ostrov: dvě kamery u druhého klienta", async () => {
    const { l, r } = await spocitej("loc_ostrov");
    expect(l.clientId).toBe("cl_kerosin");
    expect(l.camerasTlSmall).toBe(2);
    expect(r.lines.find((x) => x.it.id === "cam_tl_small")!.amount).toBe(40000);
    expect(r.lines.find((x) => x.it.id === "cam_solar")!.q).toBe(2);
    expect(r.lines.find((x) => x.it.id === "cam_sim_tmobile")!.q).toBe(2);
    expect(r.lines.some((x) => x.it.id === "cam_box")).toBe(false);
  });

  it("všechny čtyři jsou Sky Cam a mají konečná čísla", async () => {
    for (const l of APELTAUER_LOCATIONS) {
      const { r, l: row } = await spocitej(l.id);
      expect(row.product).toBe("cam");
      expect(Number.isFinite(r.fullMonthly)).toBe(true);
      expect(r.day0).toBeGreaterThan(0);
      // cena zatím není, takže marže musí být nula, ne NaN
      expect(row.price).toBe(0);
      expect(r.margin).toBe(0);
    }
  });

  it("chybějící hodnoty jsou nula, ne odhad", async () => {
    for (const l of APELTAUER_LOCATIONS) {
      const row = (await db.query.locations.findFirst({
        where: eq(locations.id, l.id),
      }))!;
      expect(row.km).toBe(0);
      expect(row.price).toBe(0);
      expect(row.setupFee).toBe(0);
    }
    const ostrov = (await db.query.locations.findFirst({
      where: eq(locations.id, "loc_ostrov"),
    }))!;
    expect(ostrov.trips1).toBe(0);
    expect(ostrov.trips2).toBe(0);
  });
});

describe("úprava ceníku", () => {
  beforeEach(async () => {
    await seedIfEmpty(db);
    await loadApeltauerData(db);
  });

  it("modem dostane cenu", async () => {
    await db
      .update(catalogItems)
      .set({ price: 0 })
      .where(eq(catalogItems.id, "cam_modem"));
    const r = await updateModemPrice(db);
    expect(r.changed).toEqual(["cam_modem"]);
    const m = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "cam_modem"),
    });
    expect(m!.price).toBe(2500);
  });

  it("naplnění dat nikdy nepřejmenuje existujícího klienta", async () => {
    // Jméno klienta patří uživateli, ne skriptu. Jednorázové přejmenování
    // ve skriptu už jednou přepsalo správnou hodnotu na špatnou; tenhle test
    // hlídá, že se to nemůže opakovat.
    await db
      .update(clients)
      .set({ name: "Kerosin s.r.o. — přejmenováno ručně" })
      .where(eq(clients.id, "cl_kerosin"));

    await loadApeltauerData(db);
    await loadApeltauerData(db, { removeTestData: true });

    const c = await db.query.clients.findFirst({
      where: eq(clients.id, "cl_kerosin"),
    });
    expect(c!.name).toBe("Kerosin s.r.o. — přejmenováno ručně");
  });

  it("název druhého klienta ve výchozích datech je Kerosin", () => {
    const k = APELTAUER_CLIENTS.find((c) => c.id === "cl_kerosin")!;
    expect(k.name).toBe("Kerosin");
  });
});

describe("výjezdy po změně škálují s kilometry", () => {
  beforeEach(async () => {
    await seedIfEmpty(db);
    await loadApeltauerData(db);
  });

  it("8 výjezdů na 260 km dělá 40 686,40 Kč ročně", async () => {
    await db
      .update(locations)
      .set({ km: 260, trips1: 8, trips2: 8 })
      .where(eq(locations.id, "loc_klanecna"));
    const cat = await db.query.catalogItems.findMany();
    const l = (await db.query.locations.findFirst({
      where: eq(locations.id, "loc_klanecna"),
    }))!;
    const locs = await db.select().from(locations);
    const r = calc(l, cat, DEFAULT_SETTINGS, locs.length);
    const vyjezdy = r.lines
      .filter((x) => ["sh_trip_work", "sh_trip_km"].includes(x.it.id))
      .reduce((s, x) => s + x.amount, 0);
    expect(vyjezdy).toBeCloseTo(40686.4, 6);
  });
});
