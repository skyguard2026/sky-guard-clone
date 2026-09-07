/**
 * Lokální vývojová databáze.
 *
 * PGlite vystavené přes socket, takže se k němu aplikace připojí úplně stejně
 * jako k Neonu — postgres.js, stejný wire protokol, stejné SQL. Data leží
 * v .pgdata/ a jsou v .gitignore. V produkci se tenhle soubor nepoužívá.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.LOCAL_DB_PORT || 5433);
const db = await PGlite.create({ dataDir: "./.pgdata" });
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });

await server.start();
console.log(`Lokální Postgres běží na postgresql://127.0.0.1:${port}/postgres`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
