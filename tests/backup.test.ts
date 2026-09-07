/**
 * Záloha a obnova proti skutečné lokální databázi.
 * Nejdůležitější je round-trip: co se vyexportuje, se musí naimportovat zpátky
 * do posledního detailu, včetně map off, over a qty.
 */
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calc } from "../lib/calc";
import { exportBackup, importBackup } from "../lib/db/backup";
import { catalogItems, clients, locations, schema } from "../lib/db/schema";
import { seedIfEmpty } from "../lib/db/seed-core";
import { readFileSync } from "node:fs";
import { parseStatement } from "../lib/bank/rb-csv";
import { importStatement, setTxCategory } from "../lib/db/finance-ops";
import { seedFinanceIfEmpty } from "../lib/db/finance-seed";
import { bankTransactions } from "../lib/db/schema";

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
const NOW = "2026-01-01T00:00:00.000Z";

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedIfEmpty(db);
  await db.insert(clients).values({ id: "c1", name: "Klient", contact: "a@b.cz" });
  await db.insert(locations).values({
    id: "l1",
    clientId: "c1",
    name: "Lokalita",
    product: "drone",
    price: 50000,
    cameras: 0,
    poles: 0,
    docks: 1,
    km: 260,
    hours: 8,
    trips1: 10,
    trips2: 8,
    off: { dr_care: true },
    over: { dr_dock: 300000 },
    qty: { dr_sensors: 3 },
  });
});

afterEach(async () => {
  await pg.close();
});

describe("round-trip zálohy", () => {
  it("po exportu a importu je databáze ve stejném stavu", async () => {
    const before = await exportBackup(db, NOW);
    const res = await importBackup(db, JSON.stringify(before));
    expect(res.ok).toBe(true);
    const after = await exportBackup(db, NOW);
    expect(after).toEqual(before);
  });

  it("mapy off, over a qty přežijí beze změny", async () => {
    const json = JSON.stringify(await exportBackup(db, NOW));
    await importBackup(db, json);
    const l = await db.query.locations.findFirst({
      where: eq(locations.id, "l1"),
    });
    expect(l!.off).toEqual({ dr_care: true });
    expect(l!.over).toEqual({ dr_dock: 300000 });
    expect(l!.qty).toEqual({ dr_sensors: 3 });
  });

  it("výsledek výpočtu je po round-tripu stejný do koruny", async () => {
    const set = (await db.query.settings.findFirst())!;
    const cfg = {
      share: set.share,
      prepay: set.prepay,
      renew: set.renew,
      tax: set.tax,
      horizon: set.horizon,
      inflation: set.inflation,
      residualRate: set.residualRate,
      transferDelay: set.transferDelay,
    };
    const read = async () => {
      const cat = await db.query.catalogItems.findMany();
      const l = (await db.query.locations.findFirst({
        where: eq(locations.id, "l1"),
      }))!;
      return calc(l, cat, cfg, 1);
    };
    const before = await read();
    await importBackup(db, JSON.stringify(await exportBackup(db, NOW)));
    const after = await read();
    expect(after.day0).toBe(before.day0);
    expect(after.fullMonthly).toBe(before.fullMonthly);
    expect(after.payback).toBe(before.payback);
    expect(after.flow).toEqual(before.flow);
  });

  it("desetinná sazba se nezaokrouhlí", async () => {
    await importBackup(db, JSON.stringify(await exportBackup(db, NOW)));
    const km = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, "cam_install_km"),
    });
    expect(km!.price).toBe(10.33);
  });
});

describe("import odmítne nesmysly a nepoškodí data", () => {
  it("nevalidní JSON", async () => {
    const res = await importBackup(db, "{tohle není json");
    expect(res).toEqual({ ok: false, error: "Soubor není platný JSON." });
    expect(await db.query.catalogItems.findMany()).toHaveLength(42);
  });

  it("cizí soubor bez katalogu a klientů", async () => {
    const res = await importBackup(db, JSON.stringify({ neco: 1 }));
    expect(res.ok).toBe(false);
    expect(await db.query.locations.findMany()).toHaveLength(1);
  });

  it("prázdná záloha smaže data, ale nechá platné nastavení", async () => {
    const res = await importBackup(
      db,
      JSON.stringify({ catalog: [], clients: [] }),
    );
    expect(res).toMatchObject({ ok: true, catalog: 0, clients: 0 });
    expect(await db.query.catalogItems.findMany()).toHaveLength(0);
    const s = await db.query.settings.findFirst();
    expect(s!.horizon).toBe(36);
  });
});

describe("import očistí poškozená data", () => {
  it("neznámé hodnoty spadnou na výchozí, nečíselné na nulu", async () => {
    const res = await importBackup(
      db,
      JSON.stringify({
        catalog: [
          {
            id: "divna",
            label: "Divná položka",
            group: "vymyslena",
            cat: "xxx",
            billing: "nikdy",
            driver: "telepaticky",
            price: "nic",
            life: -5,
          },
        ],
        clients: [
          {
            id: "c9",
            name: "Klient",
            locations: [
              {
                id: "l9",
                name: "Lokalita",
                product: "raketa",
                price: "hodně",
                cameras: -3,
                km: "daleko",
                off: "nesmysl",
                over: [1, 2, 3],
              },
            ],
          },
        ],
        settings: { horizon: 9999, tax: "moc" },
      }),
    );
    expect(res.ok).toBe(true);

    const it0 = (await db.query.catalogItems.findMany())[0];
    expect(it0.group).toBe("shared");
    expect(it0.cat).toBe("hw");
    expect(it0.billing).toBe("monthly");
    expect(it0.driver).toBe("site");
    expect(it0.price).toBe(0);
    expect(it0.life).toBe(1);

    const l = (await db.query.locations.findMany())[0];
    expect(l.product).toBe("drone");
    expect(l.price).toBe(0);
    expect(l.cameras).toBe(0);
    expect(l.km).toBe(0);
    expect(l.off).toEqual({});
    expect(l.over).toEqual({});

    const s = (await db.query.settings.findFirst())!;
    expect(s.horizon).toBe(120);
    expect(s.tax).toBe(21);
  });

  it("položky bez id nebo názvu se zahodí, zbytek projde", async () => {
    const res = await importBackup(
      db,
      JSON.stringify({
        catalog: [
          { id: "a", label: "Platná" },
          { label: "Bez id" },
          { id: "b" },
        ],
        clients: [{ id: "c", name: "Klient", locations: [{ id: "x" }] }],
      }),
    );
    expect(res).toMatchObject({ ok: true, catalog: 1, clients: 1, locations: 0 });
  });

  it("lokalita s odkazem na smazanou položku se uloží a spočítá", async () => {
    await importBackup(
      db,
      JSON.stringify({
        catalog: [],
        clients: [
          {
            id: "c",
            name: "K",
            locations: [
              {
                id: "l",
                name: "L",
                product: "drone",
                price: 1000,
                off: { uz_neexistuje: true },
                over: { uz_neexistuje: 5 },
                qty: { uz_neexistuje: 2 },
              },
            ],
          },
        ],
      }),
    );
    const l = (await db.query.locations.findMany())[0];
    const cat = await db.query.catalogItems.findMany();
    const set = (await db.query.settings.findFirst())!;
    const r = calc(l, cat, set, 1);
    expect(Number.isFinite(r.fullMonthly)).toBe(true);
    expect(r.day0).toBe(0);
  });
});

describe("pořadí přežije obnovu", () => {
  it("datum založení se ze zálohy obnoví, ne přepíše na teď", async () => {
    await db.insert(clients).values({
      id: "c0",
      name: "Starší klient",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const before = await exportBackup(db, NOW);
    await importBackup(db, JSON.stringify(before));
    const c0 = await db.query.clients.findFirst({
      where: eq(clients.id, "c0"),
    });
    expect(c0!.createdAt.toISOString()).toBe("2020-01-01T00:00:00.000Z");
  });

  it("chybějící datum v ručně upravené záloze nic nerozbije", async () => {
    const res = await importBackup(
      db,
      JSON.stringify({
        catalog: [],
        clients: [{ id: "c", name: "Bez data", locations: [] }],
      }),
    );
    expect(res.ok).toBe(true);
    const c = await db.query.clients.findFirst({ where: eq(clients.id, "c") });
    expect(c!.createdAt).toBeInstanceOf(Date);
  });
})

/**
 * Finanční sekce v záloze.
 *
 * Nejcitlivější případ je obnova staré zálohy, která finanční sekci nemá.
 * Tichý výmaz bankovních dat by se poznal až ve chvíli, kdy je někdo hledá.
 */
/** Záloha rozbalená do tvaru, který jde v testu poškodit. */
interface Dump {
  finance: { transactions: Record<string, unknown>[] };
}

describe("záloha finanční sekce", () => {
  const csv = readFileSync("tests/fixtures/rb-vypis.csv", "utf8");

  async function withFinance() {
    await seedFinanceIfEmpty(db);
    await importStatement(db, {
      filename: "srpen.csv",
      statement: parseStatement(csv),
    });
    const rows = await db.select().from(bankTransactions);
    const alza = rows.find((r) => r.externalId === "TX0001")!;
    await setTxCategory(db, [alza.id], "fc_hw");
  }

  it("projde round-tripem beze ztráty", async () => {
    await seedIfEmpty(db);
    await withFinance();

    const dump = JSON.stringify(await exportBackup(db, new Date().toISOString()));
    const res = await importBackup(db, dump);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.finance?.transactions).toBe(8);

    const rows = await db.select().from(bankTransactions);
    expect(rows).toHaveLength(8);
    const alza = rows.find((r) => r.externalId === "TX0001")!;
    expect(alza.amount).toBe(-12500);
    expect(alza.categoryId).toBe("fc_hw");
    expect(alza.categorySource).toBe("manual");
    expect(alza.raw["Zaúčtovaná částka"]).toBe("-12 500,00");
  });

  it("obnova zálohy verze 1 bankovní data nesmaže", async () => {
    await seedIfEmpty(db);
    await withFinance();

    const full = JSON.parse(
      JSON.stringify(await exportBackup(db, new Date().toISOString())),
    );
    // Přesně to, co by dodala záloha vytvořená před finanční sekcí.
    delete full.finance;
    full.version = 1;

    const res = await importBackup(db, JSON.stringify(full));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.finance).toBeNull();

    const rows = await db.select().from(bankTransactions);
    expect(rows).toHaveLength(8);
  });

  it("transakce odkazující na chybějící import se zahodí, obnova nespadne", async () => {
    await seedIfEmpty(db);
    await withFinance();

    const dump = JSON.parse(
      JSON.stringify(await exportBackup(db, new Date().toISOString())),
    ) as Dump;
    dump.finance.transactions[0].importId = "neexistujici-import";

    const res = await importBackup(db, JSON.stringify(dump));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.finance?.transactions).toBe(7);
    expect(await db.select().from(bankTransactions)).toHaveLength(7);
  });

  it("duplicitní klíč v ručně upravené záloze obnovu neshodí", async () => {
    await seedIfEmpty(db);
    await withFinance();

    const dump = JSON.parse(
      JSON.stringify(await exportBackup(db, new Date().toISOString())),
    ) as Dump;
    dump.finance.transactions.push({
      ...dump.finance.transactions[0],
      id: "kopie",
    });

    const res = await importBackup(db, JSON.stringify(dump));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.finance?.transactions).toBe(8);
  });
});
