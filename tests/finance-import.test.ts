/**
 * Import výpisu proti skutečné databázi.
 *
 * PGlite je opravdový Postgres v procesu, takže se tu ověřuje i to, co jde
 * ověřit jenom proti databázi: že duplicitu odmítne unikátní index, ne kód.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseStatement } from "../lib/bank/rb-csv";
import {
  applyRules,
  deleteImport,
  importStatement,
  previewRule,
  setTxCategory,
  wipeFinance,
} from "../lib/db/finance-ops";
import { seedFinanceIfEmpty } from "../lib/db/finance-seed";
import {
  bankImports,
  bankTransactions,
  categoryRules,
  expenseCategories,
  schema,
} from "../lib/db/schema";

const csv = readFileSync("tests/fixtures/rb-vypis.csv", "utf8");

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedFinanceIfEmpty(db);
});

afterEach(async () => {
  await pg.close();
});

const imp = (name = "vypis-srpen.csv") =>
  importStatement(db, { filename: name, statement: parseStatement(csv) });

describe("seed kategorií", () => {
  it("naplní prázdnou tabulku a podruhé už nic nepřidá", async () => {
    const before = await db.select().from(expenseCategories);
    const r = await seedFinanceIfEmpty(db);
    expect(r.categoriesSeeded).toBe(false);
    const after = await db.select().from(expenseCategories);
    expect(after).toHaveLength(before.length);
  });

  it("nevrátí kategorii, kterou někdo smazal", async () => {
    await db.delete(expenseCategories).where(eq(expenseCategories.id, "fc_marketing"));
    await seedFinanceIfEmpty(db);
    const m = await db.query.expenseCategories.findFirst({
      where: eq(expenseCategories.id, "fc_marketing"),
    });
    expect(m).toBeUndefined();
  });

  it("nepřepíše přejmenovanou kategorii", async () => {
    await db
      .update(expenseCategories)
      .set({ name: "Drony a díly" })
      .where(eq(expenseCategories.id, "fc_hw"));
    await seedFinanceIfEmpty(db);
    const hw = await db.query.expenseCategories.findFirst({
      where: eq(expenseCategories.id, "fc_hw"),
    });
    expect(hw?.name).toBe("Drony a díly");
  });
});

describe("nahrání výpisu", () => {
  it("uloží transakce, které parser přečetl", async () => {
    const r = await imp();
    expect(r.rowCount).toBe(8);
    expect(r.newCount).toBe(8);
    expect(r.dupeCount).toBe(0);
    expect(r.problemCount).toBe(2);

    const rows = await db.select().from(bankTransactions);
    expect(rows).toHaveLength(8);
  });

  it("zapíše i hlavičku importu s obdobím", async () => {
    const r = await imp("srpen.csv");
    const rec = await db.query.bankImports.findFirst({
      where: eq(bankImports.id, r.importId),
    });
    expect(rec?.filename).toBe("srpen.csv");
    expect(rec?.periodFrom).toBe("2026-08-05");
    expect(rec?.periodTo).toBe("2026-08-25");
    expect(rec?.newCount).toBe(8);
    expect(rec?.account).toBe("1234567890/5500");
  });

  it("desetinná částka přežije průchod databází", async () => {
    await imp();
    const tm = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0002"),
    });
    expect(typeof tm?.amount).toBe("number");
    expect(tm?.amount).toBe(-1250.5);
  });

  it("uloží původní řádek, ať jde dohledat originál", async () => {
    await imp();
    const alza = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0001"),
    });
    expect(alza?.raw["Zaúčtovaná částka"]).toBe("-12 500,00");
  });

  it("dvě shodné platby v jednom dni se uloží obě", async () => {
    await imp();
    const rows = await db.select().from(bankTransactions);
    const benzina = rows.filter((r) => r.counterName === "Benzina s.r.o.");
    expect(benzina).toHaveLength(2);
  });
});

describe("stejný výpis nahraný podruhé", () => {
  it("nepřidá ani jednu transakci", async () => {
    await imp();
    const second = await imp("znovu.csv");
    expect(second.newCount).toBe(0);
    expect(second.dupeCount).toBe(8);
    const rows = await db.select().from(bankTransactions);
    expect(rows).toHaveLength(8);
  });

  it("hlavička druhého importu zůstane jako záznam, že se soubor nahrál", async () => {
    await imp();
    const second = await imp("znovu.csv");
    const rec = await db.query.bankImports.findFirst({
      where: eq(bankImports.id, second.importId),
    });
    expect(rec?.dupeCount).toBe(8);
    expect(rec?.newCount).toBe(0);
  });

  it("duplicitu odmítne databáze, ne kód", async () => {
    await imp();
    const existing = (await db.select().from(bankTransactions))[0];
    await expect(
      db.insert(bankTransactions).values({
        id: "podvrzene-id",
        importId: existing.importId,
        bookedAt: existing.bookedAt,
        account: existing.account,
        amount: existing.amount,
        dedupeKey: existing.dedupeKey,
      }),
    ).rejects.toThrow();
  });

  it("stejné id transakce na jiném účtu duplicita není", async () => {
    await imp();
    const existing = (await db.select().from(bankTransactions))[0];
    await db.insert(bankTransactions).values({
      id: "jiny-ucet",
      importId: existing.importId,
      bookedAt: existing.bookedAt,
      account: "9999999999/5500",
      amount: existing.amount,
      dedupeKey: existing.dedupeKey,
    });
    const rows = await db.select().from(bankTransactions);
    expect(rows).toHaveLength(9);
  });
});

describe("zařazení při importu", () => {
  it("startovní pravidla zaberou hned", async () => {
    await imp();
    const pojistovna = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0007"),
    });
    expect(pojistovna?.categoryId).toBe("fc_sluzby");
    expect(pojistovna?.categorySource).toBe("rule");
  });

  it("na co pravidlo není, zůstane nezařazené", async () => {
    await imp();
    const alza = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0001"),
    });
    expect(alza?.categoryId).toBeNull();
    expect(alza?.categorySource).toBeNull();
  });
});

describe("přepočet pravidel", () => {
  async function addRule(value: string, categoryId = "fc_hw") {
    await db.insert(categoryRules).values({
      id: `r_${value}`,
      categoryId,
      field: "counterName",
      op: "contains",
      value,
      priority: 5,
      enabled: true,
    });
  }

  it("nové pravidlo zařadí, co bylo nezařazené", async () => {
    await imp();
    await addRule("alza");
    const r = await applyRules(db);
    expect(r.changed).toBe(1);
    const alza = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0001"),
    });
    expect(alza?.categoryId).toBe("fc_hw");
    expect(alza?.categorySource).toBe("rule");
  });

  it("ručně zařazenou transakci nechá být", async () => {
    await imp();
    const alza = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0001"),
    });
    await setTxCategory(db, [alza!.id], "fc_kancelar");

    await addRule("alza");
    const r = await applyRules(db);
    expect(r.skippedManual).toBe(1);

    const after = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0001"),
    });
    expect(after?.categoryId).toBe("fc_kancelar");
    expect(after?.categorySource).toBe("manual");
  });

  it("smazané pravidlo automatické zařazení uvolní", async () => {
    await imp();
    await db.delete(categoryRules).where(eq(categoryRules.id, "fr_pojisteni"));
    await applyRules(db);
    const pojistovna = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0007"),
    });
    expect(pojistovna?.categoryId).toBeNull();
    expect(pojistovna?.categorySource).toBeNull();
  });

  it("druhý přepočet už nic nemění", async () => {
    await imp();
    await addRule("alza");
    await applyRules(db);
    const again = await applyRules(db);
    expect(again.changed).toBe(0);
  });
});

describe("ruční zařazení", () => {
  it("vyčištění vrátí transakci pravidlům, ne do trvalého vakua", async () => {
    await imp();
    const pojistovna = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0007"),
    });
    await setTxCategory(db, [pojistovna!.id], "fc_kancelar");
    await setTxCategory(db, [pojistovna!.id], null);

    const cleared = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0007"),
    });
    expect(cleared?.categorySource).toBeNull();

    await applyRules(db);
    const back = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.externalId, "TX0007"),
    });
    expect(back?.categoryId).toBe("fc_sluzby");
  });

  it("zařadí i víc transakcí naráz", async () => {
    await imp();
    const rows = await db.select().from(bankTransactions);
    const ids = rows.filter((r) => r.counterName === "Benzina s.r.o.").map((r) => r.id);
    const r = await setTxCategory(db, ids, "fc_doprava");
    expect(r.updated).toBe(2);
  });
});

describe("náhled pravidla před založením", () => {
  it("řekne, kolik transakcí zabere a kolik z nich je ručních", async () => {
    await imp();
    const rows = await db.select().from(bankTransactions);
    const alza = rows.find((r) => r.externalId === "TX0001")!;
    await setTxCategory(db, [alza.id], "fc_kancelar");

    const p = await previewRule(db, {
      id: "navrh",
      categoryId: "fc_hw",
      field: "counterName",
      op: "contains",
      value: "alza",
      priority: 1,
      enabled: true,
    });
    expect(p.matches).toBe(1);
    expect(p.manual).toBe(1);
  });
});

describe("vrácení importu", () => {
  it("smaže transakce, které přinesl", async () => {
    const r = await imp();
    const out = await deleteImport(db, r.importId);
    expect(out.deleted).toBe(8);
    expect(await db.select().from(bankTransactions)).toHaveLength(0);
    expect(await db.select().from(bankImports)).toHaveLength(0);
  });

  it("transakce z jiného importu nechá být", async () => {
    const first = await imp();
    const other = parseStatement(
      "Datum zaúčtování;Zaúčtovaná částka;Název protiúčtu;Číslo účtu\n01.09.2026;-4 000,00;Jiný dodavatel;1234567890/5500\n",
    );
    const second = await importStatement(db, {
      filename: "zari.csv",
      statement: other,
    });
    expect(second.newCount).toBe(1);

    await deleteImport(db, first.importId);
    const rows = await db.select().from(bankTransactions);
    expect(rows).toHaveLength(1);
    expect(rows[0].counterName).toBe("Jiný dodavatel");
  });
});

describe("smazání kategorie", () => {
  it("transakce zůstanou, jen se z nich zařazení uvolní", async () => {
    await imp();
    await db.delete(expenseCategories).where(eq(expenseCategories.id, "fc_sluzby"));
    const rows = await db.select().from(bankTransactions);
    expect(rows).toHaveLength(8);
    const pojistovna = rows.find((r) => r.externalId === "TX0007")!;
    expect(pojistovna.categoryId).toBeNull();
  });

  it("pravidla, která na ni odkazovala, zmizí s ní", async () => {
    await db.delete(expenseCategories).where(eq(expenseCategories.id, "fc_sluzby"));
    const rules = await db.select().from(categoryRules);
    expect(rules.some((r) => r.categoryId === "fc_sluzby")).toBe(false);
  });
});

describe("vymazání bankovních dat z Nastavení", () => {
  it("smaže výpisy i transakce", async () => {
    await imp();
    await wipeFinance(db);
    expect(await db.select().from(bankTransactions)).toHaveLength(0);
    expect(await db.select().from(bankImports)).toHaveLength(0);
  });

  it("kategorie a pravidla nechá být — ladí se pracně a po vymazání dat se hodí znovu", async () => {
    await imp();
    const catsBefore = await db.select().from(expenseCategories);
    const rulesBefore = await db.select().from(categoryRules);

    await wipeFinance(db);

    expect(await db.select().from(expenseCategories)).toHaveLength(
      catsBefore.length,
    );
    expect(await db.select().from(categoryRules)).toHaveLength(
      rulesBefore.length,
    );
  });

  it("po vymazání jde tentýž výpis nahrát znovu jako nový", async () => {
    await imp();
    await wipeFinance(db);
    const again = await imp();
    expect(again.newCount).toBe(8);
    expect(again.dupeCount).toBe(0);
  });
});
