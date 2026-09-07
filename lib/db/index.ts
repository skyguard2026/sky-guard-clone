import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema";
import { connectionString } from "./url";

function makeDb() {
  const url = connectionString();

  /**
   * Lokální vývojová databáze (PGlite přes socket) přijímá jedno spojení
   * naráz, takže se na ní pool musí srazit na jedno. Proti Neonu jede normálně.
   */
  const isLocal = /(^|@|\/\/)(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url);
  const max = Number(process.env.DB_POOL_MAX) || (isLocal ? 1 : 5);

  const client =
    globalThis.__sgSql ?? postgres(url, { max, prepare: false });
  // V dev módu se modul přenačítá, tak držíme jedno spojení na globálu.
  if (process.env.NODE_ENV !== "production") globalThis.__sgSql = client;

  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof makeDb>;

declare global {
  var __sgSql: ReturnType<typeof postgres> | undefined;
  var __sgDb: Db | undefined;
}

/**
 * Spojení se navazuje až při prvním dotazu, ne při importu modulu.
 *
 * Build tak nepotřebuje přístup k databázi ani connection string — jinak by
 * `next build` v CI selhal na chybějícím tajemství, které při překladu
 * k ničemu není.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    globalThis.__sgDb ??= makeDb();
    const value = Reflect.get(
      globalThis.__sgDb as object,
      prop,
      globalThis.__sgDb,
    );
    return typeof value === "function"
      ? value.bind(globalThis.__sgDb)
      : value;
  },
});

export { schema };
