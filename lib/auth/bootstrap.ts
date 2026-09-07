/**
 * Založení prvního admina z proměnných prostředí.
 *
 * Běží jen tehdy, když **nejsou žádní uživatelé a zároveň je příznak
 * bootstrapUsedAt prázdný**. Samotná kontrola prázdné tabulky by nestačila:
 * po smazání posledního admina by bootstrap ožil a kdokoli se znalostí
 * proměnných by si založil přístup. Příznak se nastaví při prvním úspěšném
 * přihlášení, takže cesta zpět existuje jen do té chvíle.
 */
import { eq, sql } from "drizzle-orm";
import { appState, users } from "../db/schema";
import type { AnyPgDatabase } from "../db/seed-core";
import { uid } from "../id";
import { writeAudit, SYSTEM_ACTOR } from "./audit";
import { hashPassword } from "./password";
import { normalizeEmail } from "./rate-limit";

async function bootstrapUsed(db: AnyPgDatabase): Promise<boolean> {
  const rows = await db.select().from(appState).limit(1);
  if (!rows.length) {
    await db.insert(appState).values({ id: 1 }).onConflictDoNothing();
    return false;
  }
  return rows[0].bootstrapUsedAt !== null;
}

export type BootstrapResult =
  | { created: true; email: string }
  | { created: false; reason: "already-used" | "users-exist" | "no-env" };

export async function ensureBootstrapAdmin(
  db: AnyPgDatabase,
): Promise<BootstrapResult> {
  if (await bootstrapUsed(db)) return { created: false, reason: "already-used" };

  const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL ?? "");
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  if (!email || !password) return { created: false, reason: "no-env" };

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    /**
     * Účet už z bootstrapu vznikl, ale nikdo se jím ještě nepřihlásil.
     *
     * Stává se to při překlepu v proměnné: účet se založí, přihlášení selže
     * a při další kontrole „jsou uživatelé" by se bootstrap už nespustil —
     * heslo by neznal nikdo a jedinou cestou by byl nouzový skript. Dokud je
     * příznak prázdný, heslo se proto z proměnných obnovuje.
     */
    await db
      .update(users)
      // Obnovuje se **jen heslo**. Role ani aktivita ne: kdyby se ten účet
      // mezitím někdo vědomě deaktivoval, bootstrap by mu ho tiše vrátil.
      .set({
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      })
      .where(eq(users.id, existing[0].id));
    return { created: true, email };
  }

  const others = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  if ((others[0]?.n ?? 0) > 0) return { created: false, reason: "users-exist" };

  await db.insert(users).values({
    id: uid(),
    email,
    name: "Správce",
    passwordHash: await hashPassword(password),
    role: "admin",
    active: true,
    // I první admin si heslo z proměnné prostředí musí hned změnit — jinak
    // by heslo aplikace navždy leželo v nastavení Vercelu.
    mustChangePassword: true,
  });
  await writeAudit(db, SYSTEM_ACTOR, "user.created", email, { bootstrap: true });
  return { created: true, email };
}

/**
 * Zavře bootstrap natrvalo. Volá se po prvním úspěšném přihlášení, ne při
 * založení účtu — kdyby se admin nikdy nepřihlásil, musí jít začít znovu.
 */
export async function markBootstrapUsed(db: AnyPgDatabase): Promise<void> {
  await db.insert(appState).values({ id: 1 }).onConflictDoNothing();
  await db
    .update(appState)
    .set({ bootstrapUsedAt: new Date() })
    .where(sql`${appState.id} = 1 and ${appState.bootstrapUsedAt} is null`);
}
