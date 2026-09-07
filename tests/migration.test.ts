/**
 * Migrace nad databází, ve které už jsou data.
 *
 * Testy jinde staví schéma od nuly, takže by neodhalily migraci, která
 * na existujících řádcích selže. Tady se schéma postaví po krocích: nejdřív
 * první migrace, pak se vloží data, a teprve potom se aplikuje ta nová.
 */
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let pg: PGlite;

const migrationFiles = () =>
  readdirSync("./drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();

const statements = (file: string) =>
  readFileSync(`./drizzle/${file}`, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

async function apply(file: string) {
  for (const stmt of statements(file)) await pg.exec(stmt);
}

beforeEach(() => {
  pg = new PGlite();
});
afterEach(async () => {
  await pg.close();
});

describe("migrace je čistě aditivní", () => {
  it("žádná neobsahuje DROP, RENAME ani změnu typu sloupce", () => {
    for (const file of migrationFiles()) {
      const sql = readFileSync(`./drizzle/${file}`, "utf8");
      const destructive = sql
        .split("\n")
        .filter((l) =>
          /\bDROP\b|\bALTER COLUMN\b|\bRENAME\b|\bTRUNCATE\b|^\s*DELETE\b/i.test(
            l,
          ),
        );
      expect(destructive, `${file} obsahuje destruktivní příkaz`).toEqual([]);
    }
  });

  it("každý sloupec přidaný do existující tabulky má DEFAULT", () => {
    for (const file of migrationFiles()) {
      const sql = readFileSync(`./drizzle/${file}`, "utf8");
      for (const line of sql.split("\n")) {
        if (!/ADD COLUMN/i.test(line)) continue;
        expect(line, `${file}: sloupec bez DEFAULT`).toMatch(/DEFAULT/i);
      }
    }
  });
});

describe("existující řádky migraci přežijí", () => {
  it("lokalita založená před migrací dostane výchozí hodnoty", async () => {
    const [first, ...rest] = migrationFiles();
    expect(rest.length).toBeGreaterThan(0);

    await apply(first);

    // data, která v databázi byla před nasazením nové verze
    await pg.exec(`
      insert into "client" ("id", "name") values ('c1', 'Starý klient');
      insert into "location" ("id", "client_id", "name", "product", "price", "docks")
      values ('l1', 'c1', 'Stará lokalita', 'drone', 50000, 1);
    `);

    for (const file of rest) await apply(file);

    const res = await pg.query<{
      setup_fee: number;
      commitment_months: number;
      name: string;
      price: number;
    }>(`select "name", "price", "setup_fee", "commitment_months" from "location"`);

    expect(res.rows).toHaveLength(1);
    // původní data zůstala
    expect(res.rows[0].name).toBe("Stará lokalita");
    expect(res.rows[0].price).toBe(50000);
    // nové sloupce dostaly výchozí hodnoty, ne NULL
    expect(res.rows[0].setup_fee).toBe(0);
    expect(res.rows[0].commitment_months).toBe(24);
  });

  it("katalog s ručně upravenou cenou migrací neutrpí", async () => {
    const [first, ...rest] = migrationFiles();
    await apply(first);
    await pg.exec(`
      insert into "catalog_item" ("id","label","group","cat","price","life","billing","driver")
      values ('dr_dock','Dokovací stanice','drone','hw',299000,42,'oneoff','dock');
    `);
    for (const file of rest) await apply(file);
    const res = await pg.query<{ price: number }>(
      `select "price" from "catalog_item" where "id" = 'dr_dock'`,
    );
    expect(res.rows[0].price).toBe(299000);
  });

  it("celá řada migrací projde i na prázdné databázi", async () => {
    for (const file of migrationFiles()) await apply(file);
    const res = await pg.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(res.rows.map((r) => r.table_name)).toEqual([
      "app_state",
      "audit_log",
      "bank_import",
      "bank_tx",
      "catalog_item",
      "category_rule",
      "client",
      "expense_category",
      "inquiry",
      "location",
      "login_attempt",
      "offer",
      "session",
      "settings",
      "user",
    ]);
  });
});
