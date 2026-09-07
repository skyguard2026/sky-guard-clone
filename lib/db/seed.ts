/** Samostatné spuštění seedu bez migrací. Idempotentní. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { connectionString } from "./url";
import { schema } from "./schema";
import { seedFinanceIfEmpty } from "./finance-seed";
import { seedIfEmpty } from "./seed-core";

async function main() {
  const client = postgres(connectionString(), { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  const r = await seedIfEmpty(db);
  console.log(
    r.catalogSeeded
      ? `Katalog naplněn: ${r.catalogCount} položek.`
      : `Katalog už obsahuje ${r.catalogCount} položek, seed přeskočen.`,
  );
  const f = await seedFinanceIfEmpty(db);
  console.log(
    f.categoriesSeeded
      ? `Kategorie výdajů naplněny: ${f.categoryCount}, pravidel ${f.ruleCount}.`
      : `Kategorie výdajů už existují (${f.categoryCount}), seed přeskočen.`,
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
