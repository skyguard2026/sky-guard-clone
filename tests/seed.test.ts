/**
 * Seed proti skutečné lokální databázi.
 *
 * PGlite je opravdový Postgres běžící v procesu, takže se testuje reálné
 * chování migrací i vkládání, ne atrapa. Ověřuje se hlavně to, že opakované
 * spuštění seedu nepřepíše ceny, které mezitím někdo ručně upravil.
 */
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED_CATALOG } from "../lib/defaults";
import { deleteCatalogItemWithRefs } from "../lib/db/catalog-ops";
import {
  catalogItems,
  clients,
  locations,
  schema,
  settings,
} from "../lib/db/schema";
import { resetCatalogRows, seedIfEmpty } from "../lib/db/seed-core";

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterEach(async () => {
  await pg.close();
});

describe("seed je idempotentní", () => {
  it("naplní prázdnou tabulku 42 položkami", async () => {
    const r = await seedIfEmpty(db);
    expect(r.catalogSeeded).toBe(true);
    expect(r.catalogCount).toBe(42);
    expect(r.settingsSeeded).toBe(true);
  });

  it("druhé spuštění nepřepíše ručně upravenou cenu", async () => {
    await seedIfEmpty(db);

    // jednatel upraví cenu po nové nabídce od dodavatele
    await db
      .update(catalogItems)
      .set({ price: 299000 })
      .where(eq(catalogItems.id, "dr_dock"));

    // další deploy spustí seed znovu
    const r = await seedIfEmpty(db);

    expect(r.catalogSeeded).toBe(false);
    expect(r.catalogCount).toBe(42);

    const dock = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "dr_dock"),
    });
    expect(dock?.price).toBe(299000);
  });

  it("nepřidá duplicity ani po třetím spuštění", async () => {
    await seedIfEmpty(db);
    await seedIfEmpty(db);
    const r = await seedIfEmpty(db);
    expect(r.catalogCount).toBe(42);
  });

  it("nepřepíše ani vypnutou položku, kterou někdo zapnul", async () => {
    await seedIfEmpty(db);
    await db
      .update(catalogItems)
      .set({ enabled: true })
      .where(eq(catalogItems.id, "dr_flighthub"));
    await seedIfEmpty(db);
    const fh = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "dr_flighthub"),
    });
    expect(fh?.enabled).toBe(true);
  });

  it("nepřepíše upravené nastavení", async () => {
    await seedIfEmpty(db);
    await db.update(settings).set({ horizon: 60, tax: 19 });
    const r = await seedIfEmpty(db);
    expect(r.settingsSeeded).toBe(false);
    const s = await db.query.settings.findFirst();
    expect(s?.horizon).toBe(60);
    expect(s?.tax).toBe(19);
  });

  it("vědomý reset z Nastavení cenu naopak vrátí do výchozího stavu", async () => {
    await seedIfEmpty(db);
    await db
      .update(catalogItems)
      .set({ price: 299000 })
      .where(eq(catalogItems.id, "dr_dock"));
    await resetCatalogRows(db);
    const dock = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "dr_dock"),
    });
    expect(dock?.price).toBe(268587);
  });
});

describe("uložená čísla se vracejí jako čísla, ne jako string", () => {
  it("desetinná sazba přežije průchod databází bez odchylky", async () => {
    await seedIfEmpty(db);
    const km = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "cam_install_km"),
    });
    expect(typeof km?.price).toBe("number");
    expect(km?.price).toBe(10.33);
  });

  it("záporná cena se uloží i načte se znaménkem", async () => {
    await seedIfEmpty(db);
    const d = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "dr_discount"),
    });
    expect(d?.price).toBe(-22808);
  });

  it("celý katalog z databáze sedí na zdrojový soubor položku po položce", async () => {
    await seedIfEmpty(db);
    const rows = await db.query.catalogItems.findMany();
    expect(rows).toHaveLength(SEED_CATALOG.length);
    for (const src of SEED_CATALOG) {
      const row = rows.find((r) => r.id === src.id);
      expect(row, `chybí položka ${src.id}`).toBeDefined();
      expect(row!.price).toBe(src.price);
      expect(row!.life).toBe(src.life ?? null);
      expect(row!.billing).toBe(src.billing);
      expect(row!.driver).toBe(src.driver);
      expect(row!.group).toBe(src.group);
      expect(row!.cat).toBe(src.cat);
      expect(row!.shared).toBe(!!src.shared);
      expect(row!.prepay).toBe(src.prepay !== false);
      expect(row!.enabled).toBe(src.enabled !== false);
    }
  });
});

describe("mazání položky uklidí odkazy u všech lokalit", () => {
  async function twoLocations() {
    await seedIfEmpty(db);
    await db.insert(clients).values({ id: "c1", name: "Klient" });
    await db.insert(locations).values([
      {
        id: "l1",
        clientId: "c1",
        name: "První",
        product: "drone",
        price: 50000,
        docks: 1,
        off: { dr_rtk: true, dr_care: true },
        over: { dr_rtk: 12000, dr_dock: 300000 },
        qty: { dr_sensors: 4 },
      },
      {
        id: "l2",
        clientId: "c1",
        name: "Druhá",
        product: "drone",
        price: 40000,
        docks: 1,
        off: { dr_rtk: true },
        over: { dr_rtk: 9000 },
        qty: {},
      },
    ]);
  }

  it("odkazy na smazanou položku zmizí, ostatní zůstanou", async () => {
    await twoLocations();
    await deleteCatalogItemWithRefs(db, "dr_rtk");

    const gone = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "dr_rtk"),
    });
    expect(gone).toBeUndefined();

    const rows = await db.query.locations.findMany();
    for (const l of rows) {
      expect(l.off).not.toHaveProperty("dr_rtk");
      expect(l.over).not.toHaveProperty("dr_rtk");
    }
    const l1 = rows.find((r) => r.id === "l1")!;
    // co se smazané položky netýkalo, zůstalo nedotčené
    expect(l1.off).toEqual({ dr_care: true });
    expect(l1.over).toEqual({ dr_dock: 300000 });
    expect(l1.qty).toEqual({ dr_sensors: 4 });
  });

  it("smaže i odkaz v qty", async () => {
    await twoLocations();
    await deleteCatalogItemWithRefs(db, "dr_sensors");
    const l1 = await db.query.locations.findFirst({
      where: eq(locations.id, "l1"),
    });
    expect(l1!.qty).toEqual({});
    expect(l1!.off).toEqual({ dr_rtk: true, dr_care: true });
  });

  it("mazání položky, na kterou nikdo neodkazuje, nic nerozbije", async () => {
    await twoLocations();
    await deleteCatalogItemWithRefs(db, "cam_socket");
    const rows = await db.query.locations.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === "l1")!.over).toEqual({
      dr_rtk: 12000,
      dr_dock: 300000,
    });
    const cnt = await db.query.catalogItems.findMany();
    expect(cnt).toHaveLength(41);
  });

  it("smazání klienta vezme jeho lokality s sebou", async () => {
    await twoLocations();
    await db.delete(clients).where(eq(clients.id, "c1"));
    const rows = await db.query.locations.findMany();
    expect(rows).toHaveLength(0);
  });
});
