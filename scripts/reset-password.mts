/**
 * Nouzový reset hesla. Jediná cesta zpět, když se správce zamkne z aplikace.
 *
 * Bootstrap po prvním přihlášení už neproběhne a e-maily se neposílají, takže
 * bez druhého správce by neexistoval nikdo, kdo heslo resetuje. Tohle běží
 * mimo aplikaci, přímo proti databázi, a vyžaduje DATABASE_URL — tedy přístup
 * k produkčnímu tajemství, ne jen k webu.
 *
 *   npm run admin:reset-password -- jan@sky-guard.cz
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { SYSTEM_ACTOR, writeAudit } from "../lib/auth/audit";
import { generateTempPassword, hashPassword } from "../lib/auth/password";
import { normalizeEmail } from "../lib/auth/rate-limit";
import { revokeAllUserSessions } from "../lib/auth/session";
import { schema, users } from "../lib/db/schema";
import { connectionString } from "../lib/db/url";

const email = normalizeEmail(process.argv[2] ?? "");
if (!email) {
  console.error("Použití: npm run admin:reset-password -- jan@sky-guard.cz");
  process.exit(1);
}

const client = postgres(connectionString(), { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(client, { schema, casing: "snake_case" });

const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
const user = found[0];
if (!user) {
  console.error(`Uživatel ${email} v databázi není.`);
  await client.end();
  process.exit(1);
}

const tempPassword = generateTempPassword();
await db
  .update(users)
  .set({
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
    // Zamčený účet se resetem zároveň odemkne, jinak by nouzová cesta
    // skončila u deaktivovaného uživatele na půl kroku.
    active: true,
  })
  .where(eq(users.id, user.id));

await revokeAllUserSessions(db, user.id);
await writeAudit(db, SYSTEM_ACTOR, "user.password_reset", user.id, {
  email,
  emergency: true,
});

console.log(`\nÚčet:            ${email}`);
console.log(`Dočasné heslo:   ${tempPassword}`);
console.log(`\nVšechny session tohoto účtu byly ukončeny.`);
console.log(`Při přihlášení si aplikace vyžádá nové heslo.`);
console.log(`Zapsáno do audit logu jako akce systému.\n`);

await client.end();
