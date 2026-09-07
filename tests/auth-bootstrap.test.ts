/**
 * Bootstrap prvního admina a přihlášení.
 *
 * Tohle je ta část, kde se rozhoduje, jestli se do aplikace vůbec někdo
 * dostane. Proto se tu testuje i to, co se stát nemá: že bootstrap ožije po
 * smazání admina, nebo že se dá donekonečna hádat heslo.
 */
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAudit } from "../lib/auth/audit";
import { ensureBootstrapAdmin } from "../lib/auth/bootstrap";
import { login } from "../lib/auth/login";
import { resolveSession } from "../lib/auth/session";
import { appState, schema, users } from "../lib/db/schema";

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

const EMAIL = "jan@sky-guard.cz";
const PASS = "bootstrap-heslo-z-vercelu";
const IP = "203.0.113.5";

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
  process.env.BOOTSTRAP_ADMIN_EMAIL = EMAIL;
  process.env.BOOTSTRAP_ADMIN_PASSWORD = PASS;
});

afterEach(async () => {
  await pg.close();
  delete process.env.BOOTSTRAP_ADMIN_EMAIL;
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
});

describe("bootstrap", () => {
  it("nad prázdnou databází založí admina s vynucenou změnou hesla", async () => {
    const r = await ensureBootstrapAdmin(db);
    expect(r.created).toBe(true);
    const u = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
    expect(u?.role).toBe("admin");
    expect(u?.mustChangePassword).toBe(true);
  });

  it("bez proměnných prostředí nepustí nikoho dovnitř", async () => {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const r = await ensureBootstrapAdmin(db);
    expect(r.created).toBe(false);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("podruhé nevznikne druhý účet, jen se obnoví heslo", async () => {
    await ensureBootstrapAdmin(db);
    await ensureBootstrapAdmin(db);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("neaktivuje účet, který někdo vědomě vypnul", async () => {
    await ensureBootstrapAdmin(db);
    await db.update(users).set({ active: false }).where(eq(users.email, EMAIL));
    await ensureBootstrapAdmin(db);
    const u = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
    expect(u?.active).toBe(false);
  });

  it("před prvním přihlášením jde začít znovu — příznak ještě není", async () => {
    await ensureBootstrapAdmin(db);
    await db.delete(users);
    const again = await ensureBootstrapAdmin(db);
    expect(again.created).toBe(true);
  });

  it("po prvním přihlášení už bootstrap neožije, ani když admina někdo smaže", async () => {
    await ensureBootstrapAdmin(db);
    const res = await login(db, EMAIL, PASS, IP);
    expect(res.ok).toBe(true);

    const state = await db.select().from(appState);
    expect(state[0]?.bootstrapUsedAt).not.toBeNull();

    await db.delete(users);
    const again = await ensureBootstrapAdmin(db);
    expect(again.created).toBe(false);
    expect(await db.select().from(users)).toHaveLength(0);
  });
});

describe("přihlášení", () => {
  it("první přihlášení projde a vyžádá si změnu hesla", async () => {
    const res = await login(db, EMAIL, PASS, IP);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.mustChangePassword).toBe(true);

    const s = await resolveSession(db, res.sessionId);
    expect(s?.email).toBe(EMAIL);
    expect(s?.role).toBe("admin");
  });

  it("e-mail se bere bez ohledu na velikost písmen a mezery", async () => {
    expect((await login(db, "  JAN@Sky-Guard.CZ ", PASS, IP)).ok).toBe(true);
  });

  it("špatné heslo neprojde a neřekne, co bylo špatně", async () => {
    await ensureBootstrapAdmin(db);
    const res = await login(db, EMAIL, "spatne", IP);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).not.toContain("heslo je");
    // stejná hláška jako u neexistujícího účtu
    const unknown = await login(db, "nikdo@sky-guard.cz", "cokoli", IP);
    if (unknown.ok) return;
    expect(unknown.error).toBe(res.error);
  });

  it("deaktivovaný účet se navenek chová jako špatné heslo", async () => {
    await ensureBootstrapAdmin(db);
    await db.update(users).set({ active: false }).where(eq(users.email, EMAIL));
    const res = await login(db, EMAIL, PASS, IP);
    expect(res.ok).toBe(false);
  });

  it("po pěti pokusech se zamkne a šesté heslo už neprojde, i když je správné", async () => {
    await ensureBootstrapAdmin(db);
    for (let i = 0; i < 5; i++) await login(db, EMAIL, "spatne", IP);
    const res = await login(db, EMAIL, PASS, IP);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.locked).toBe(true);
  });

  it("zamčení platí jen pro tu IP, ze které se hádalo", async () => {
    await ensureBootstrapAdmin(db);
    for (let i = 0; i < 5; i++) await login(db, EMAIL, "spatne", IP);
    expect((await login(db, EMAIL, PASS, "198.51.100.9")).ok).toBe(true);
  });

  it("zapíše přihlášení i neúspěch do audit logu", async () => {
    await ensureBootstrapAdmin(db);
    await login(db, EMAIL, "spatne", IP);
    await login(db, EMAIL, PASS, IP);
    const actions = (await readAudit(db)).map((r) => r.action);
    expect(actions).toContain("login");
    expect(actions).toContain("login.failed");
  });

  it("každé přihlášení dá vlastní session, staré platí dál", async () => {
    await ensureBootstrapAdmin(db);
    const a = await login(db, EMAIL, PASS, IP);
    const b = await login(db, EMAIL, PASS, "198.51.100.9");
    if (!a.ok || !b.ok) return;
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(await resolveSession(db, a.sessionId)).not.toBeNull();
    expect(await resolveSession(db, b.sessionId)).not.toBeNull();
  });
});

describe("překlep v proměnné prostředí nezasekne první přihlášení", () => {
  it("dokud se nikdo nepřihlásil, heslo se z proměnných obnoví", async () => {
    // první nasazení mělo v proměnné překlep
    process.env.BOOTSTRAP_ADMIN_PASSWORD = "spatne-heslo-preklep";
    await ensureBootstrapAdmin(db);
    expect((await login(db, EMAIL, PASS, IP)).ok).toBe(false);

    // správce překlep opraví a nasadí znovu
    process.env.BOOTSTRAP_ADMIN_PASSWORD = PASS;
    await ensureBootstrapAdmin(db);
    const res = await login(db, EMAIL, PASS, "198.51.100.20");
    expect(res.ok).toBe(true);
  });

  it("po prvním přihlášení už proměnné heslo nepřepíšou", async () => {
    await ensureBootstrapAdmin(db);
    expect((await login(db, EMAIL, PASS, IP)).ok).toBe(true);

    // někdo změní proměnnou a doufá, že se dostane dovnitř
    process.env.BOOTSTRAP_ADMIN_PASSWORD = "podvrzene-heslo";
    await ensureBootstrapAdmin(db);
    expect((await login(db, EMAIL, "podvrzene-heslo", "198.51.100.21")).ok).toBe(false);
  });
})
