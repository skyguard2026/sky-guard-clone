/**
 * Jednorázové naplnění produkce: aktualizace katalogu na časosběrné kamery
 * a založení klientů Apeltauer a Kerosin.
 *
 * Idempotentní — dá se pustit vícekrát. Testovací záznamy smaže jen
 * s příznakem --smazat-testovaci.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadApeltauerData } from "../lib/db/apeltauer-data";
import { schema } from "../lib/db/schema";
import { connectionString } from "../lib/db/url";
import {
  updateModemPrice,
  upgradeCatalogForTimelapse,
  verifyTimelapseCatalog,
} from "../lib/db/upgrade-timelapse";

const smazatTestovaci = process.argv.includes("--smazat-testovaci");

const client = postgres(connectionString(), {
  max: 1,
  prepare: false,
  onnotice: () => {},
});
const db = drizzle(client, { schema, casing: "snake_case" });

console.log("== Katalog ==");
const kat = await upgradeCatalogForTimelapse(db);
console.log(`  driverů změněno na cameraAll: ${kat.driversUpdated}`);
console.log(
  kat.itemsAdded.length
    ? `  přidáno: ${kat.itemsAdded.join(", ")}`
    : "  nic nepřibylo, položky už tam byly",
);
const v = await verifyTimelapseCatalog(db);
console.log(`  položek celkem: ${v.count}`);
if (v.problems.length) {
  console.error("  PROBLÉMY:", v.problems.join(" | "));
  process.exit(1);
}

console.log("== Ceník ==");
const cen = await updateModemPrice(db);
console.log(`  upraveno: ${cen.changed.join(", ") || "nic"}`);

console.log("== Klienti a lokality ==");
const dat = await loadApeltauerData(db, { removeTestData: smazatTestovaci });
console.log(
  dat.clientsAdded.length
    ? `  klienti: ${dat.clientsAdded.join(", ")}`
    : "  klienti už existovali",
);
console.log(
  dat.locationsAdded.length
    ? `  lokality: ${dat.locationsAdded.join(", ")}`
    : "  lokality už existovaly",
);
if (dat.alreadyPresent.length)
  console.log(`  přeskočeno: ${dat.alreadyPresent.join(", ")}`);
if (dat.testDataRemoved.length)
  console.log(`  smazána testovací data: ${dat.testDataRemoved.join(", ")}`);
else if (smazatTestovaci) console.log("  žádná testovací data k smazání");

await client.end();
