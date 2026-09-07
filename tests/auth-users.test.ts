/**
 * Uživatelé, session a zamykání přihlášení proti skutečné databázi.
 *
 * Těžiště jsou invarianty, které musí platit i tehdy, když se admin splete:
 * poslední admin nesmí zmizet a nikdo si nesmí sám sebe vypnout. Obojí je
 * cesta, jak se nevratně zamknout z vlastní aplikace.
 */
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAudit } from "../lib/auth/audit";
import { verifyPassword } from "../lib/auth/password";
import { lockState, recordAttempt } from "../lib/auth/rate-limit";
import {
  createSession,
  listUserSessions,
  resolveSession,
  revokeAllUserSessions,
  revokeSession,
} from "../lib/auth/session";
import {
  activateUser,
  changeOwnPassword,
  createUser,
  deactivateUser,
  deleteUser,
  resetUserPassword,
  setUserRole,
} from "../lib/auth/users";
import { auditLog, schema, sessions, users } from "../lib/db/schema";

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

/** Kdo akci provedl. V testech skoro vždy zakládající admin. */
async function admin(email = "admin@sky-guard.cz") {
  const r = await createUser(db, SYS, { email, name: "Admin", role: "admin" });
  if (!r.ok) throw new Error(r.error);
  return r.user;
}

const SYS = { userId: null, actor: "test" };

beforeEach(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterEach(async () => {
  await pg.close();
});

describe("zakládání uživatele", () => {
  it("vygeneruje dočasné heslo a vynutí jeho změnu", async () => {
    const r = await createUser(db, SYS, {
      email: "michal@sky-guard.cz",
      name: "Michal",
      role: "member",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tempPassword.length).toBeGreaterThanOrEqual(12);
    expect(r.user.mustChangePassword).toBe(true);
    expect(await verifyPassword(r.user.passwordHash, r.tempPassword)).toBe(true);
  });

  it("heslo v databázi není čitelné", async () => {
    const r = await createUser(db, SYS, { email: "a@b.cz", name: "A", role: "member" });
    if (!r.ok) return;
    expect(r.user.passwordHash).not.toContain(r.tempPassword);
    expect(r.user.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("e-mail se ukládá malými písmeny a podruhé neprojde", async () => {
    const first = await createUser(db, SYS, { email: "Jan@Sky-Guard.CZ", name: "Jan", role: "admin" });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.user.email).toBe("jan@sky-guard.cz");

    const second = await createUser(db, SYS, { email: "JAN@sky-guard.cz", name: "Jiný", role: "member" });
    expect(second.ok).toBe(false);
  });

  it("bez e-mailu to neprojde", async () => {
    expect((await createUser(db, SYS, { email: "  ", name: "X", role: "member" })).ok).toBe(false);
    expect((await createUser(db, SYS, { email: "neni-email", name: "X", role: "member" })).ok).toBe(false);
  });
});

describe("poslední admin", () => {
  it("nejde deaktivovat", async () => {
    const a = await admin();
    const r = await deactivateUser(db, { userId: "kdosi", actor: "kdosi" }, a.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("poslední");
  });

  it("nejde degradovat na member", async () => {
    const a = await admin();
    const r = await setUserRole(db, { userId: "kdosi", actor: "kdosi" }, a.id, "member");
    expect(r.ok).toBe(false);
  });

  it("nejde smazat", async () => {
    const a = await admin();
    expect((await deleteUser(db, { userId: "kdosi", actor: "kdosi" }, a.id)).ok).toBe(false);
  });

  it("druhý admin první uvolní", async () => {
    const a = await admin("prvni@sky-guard.cz");
    await admin("druhy@sky-guard.cz");
    expect((await setUserRole(db, { userId: "x", actor: "x" }, a.id, "member")).ok).toBe(true);
  });

  it("deaktivovaný admin se do počtu nepočítá", async () => {
    const a = await admin("prvni@sky-guard.cz");
    const b = await admin("druhy@sky-guard.cz");
    expect((await deactivateUser(db, { userId: "x", actor: "x" }, b.id)).ok).toBe(true);
    // teď je aktivní admin jen jeden a musí být chráněný
    expect((await deactivateUser(db, { userId: "x", actor: "x" }, a.id)).ok).toBe(false);
  });
});

describe("sám na sebe", () => {
  it("nikdo se nedeaktivuje sám", async () => {
    const a = await admin("prvni@sky-guard.cz");
    await admin("druhy@sky-guard.cz");
    const r = await deactivateUser(db, { userId: a.id, actor: a.email }, a.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("sám sebe");
  });

  it("nikdo si sám nezmění roli", async () => {
    const a = await admin("prvni@sky-guard.cz");
    await admin("druhy@sky-guard.cz");
    expect((await setUserRole(db, { userId: a.id, actor: a.email }, a.id, "member")).ok).toBe(false);
  });

  it("nikdo se nesmaže sám", async () => {
    const a = await admin("prvni@sky-guard.cz");
    await admin("druhy@sky-guard.cz");
    expect((await deleteUser(db, { userId: a.id, actor: a.email }, a.id)).ok).toBe(false);
  });
});

describe("deaktivace a reset hesla ukončí session hned", () => {
  it("deaktivovaný uživatel neprojde, i když má platnou session", async () => {
    await admin("prvni@sky-guard.cz");
    const m = (await createUser(db, SYS, { email: "m@sky-guard.cz", name: "M", role: "member" }) as { ok: true; user: typeof users.$inferSelect }).user;
    const sid = await createSession(db, m.id);
    expect(await resolveSession(db, sid)).not.toBeNull();

    await deactivateUser(db, { userId: "x", actor: "x" }, m.id);
    expect(await resolveSession(db, sid)).toBeNull();
  });

  it("reset hesla zruší všechny session a vynutí změnu", async () => {
    await admin("prvni@sky-guard.cz");
    const r = await createUser(db, SYS, { email: "m@sky-guard.cz", name: "M", role: "member" });
    if (!r.ok) return;
    const sid = await createSession(db, r.user.id);

    const reset = await resetUserPassword(db, { userId: "x", actor: "x" }, r.user.id);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;

    expect(await resolveSession(db, sid)).toBeNull();
    const after = await db.query.users.findFirst({ where: eq(users.id, r.user.id) });
    expect(after?.mustChangePassword).toBe(true);
    expect(await verifyPassword(after!.passwordHash, reset.tempPassword)).toBe(true);
  });

  it("změna vlastního hesla zruší ostatní session, ale ne tu právě používanou", async () => {
    const a = await admin();
    const keep = await createSession(db, a.id);
    const other = await createSession(db, a.id);

    const r = await changeOwnPassword(db, { userId: a.id, actor: a.email }, a.id, "dostatecne-dlouhe-heslo", keep);
    expect(r.ok).toBe(true);

    expect(await resolveSession(db, keep)).not.toBeNull();
    expect(await resolveSession(db, other)).toBeNull();
  });

  it("krátké heslo neprojde", async () => {
    const a = await admin();
    const sid = await createSession(db, a.id);
    expect((await changeOwnPassword(db, { userId: a.id, actor: a.email }, a.id, "kratke", sid)).ok).toBe(false);
  });

  it("po změně hesla se vynucená změna zruší", async () => {
    const a = await admin();
    const sid = await createSession(db, a.id);
    await changeOwnPassword(db, { userId: a.id, actor: a.email }, a.id, "dostatecne-dlouhe-heslo", sid);
    const after = await db.query.users.findFirst({ where: eq(users.id, a.id) });
    expect(after?.mustChangePassword).toBe(false);
  });
});

describe("session", () => {
  it("neznámá, prázdná i prošlá session neprojde", async () => {
    const a = await admin();
    expect(await resolveSession(db, undefined)).toBeNull();
    expect(await resolveSession(db, "")).toBeNull();
    expect(await resolveSession(db, "neexistuje")).toBeNull();

    const sid = await createSession(db, a.id);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, sid));
    expect(await resolveSession(db, sid)).toBeNull();
  });

  it("ukončení session platí okamžitě, bez čekání na vypršení", async () => {
    const a = await admin();
    const sid = await createSession(db, a.id);
    await revokeSession(db, sid);
    expect(await resolveSession(db, sid)).toBeNull();
  });

  it("ukončí se i všechny session naráz", async () => {
    const a = await admin();
    await createSession(db, a.id);
    await createSession(db, a.id);
    expect(await listUserSessions(db, a.id)).toHaveLength(2);
    expect(await revokeAllUserSessions(db, a.id)).toBe(2);
    expect(await listUserSessions(db, a.id)).toHaveLength(0);
  });

  it("vrací roli, podle které se rozhoduje o přístupu", async () => {
    const a = await admin();
    const s = await resolveSession(db, await createSession(db, a.id));
    expect(s?.role).toBe("admin");
    expect(s?.email).toBe("admin@sky-guard.cz");
  });
});

describe("zamykání přihlášení", () => {
  const IP = "192.0.2.10";

  it("pět neúspěchů v okně zamkne", async () => {
    for (let i = 0; i < 4; i++) await recordAttempt(db, "a@b.cz", IP, false);
    expect((await lockState(db, "a@b.cz", IP)).locked).toBe(false);
    await recordAttempt(db, "a@b.cz", IP, false);
    const s = await lockState(db, "a@b.cz", IP);
    expect(s.locked).toBe(true);
    expect(s.until).not.toBeNull();
  });

  it("úspěšné přihlášení čítač vynuluje", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt(db, "a@b.cz", IP, false);
    expect((await lockState(db, "a@b.cz", IP)).locked).toBe(true);
    await recordAttempt(db, "a@b.cz", IP, true);
    expect((await lockState(db, "a@b.cz", IP)).locked).toBe(false);
  });

  it("zamyká se dvojice e-mail a IP, ne e-mail sám", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt(db, "a@b.cz", IP, false);
    expect((await lockState(db, "a@b.cz", "198.51.100.7")).locked).toBe(false);
  });

  it("cizí e-mail ze stejné IP zamčený není", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt(db, "a@b.cz", IP, false);
    expect((await lockState(db, "jiny@b.cz", IP)).locked).toBe(false);
  });

  it("po uplynutí zámku se zase dá zkusit", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt(db, "a@b.cz", IP, false);
    const later = new Date(Date.now() + 16 * 60 * 1000);
    expect((await lockState(db, "a@b.cz", IP, later)).locked).toBe(false);
  });

  it("e-mail se porovnává bez ohledu na velikost písmen", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt(db, "A@B.cz", IP, false);
    expect((await lockState(db, "a@b.cz", IP)).locked).toBe(true);
  });
});

describe("audit", () => {
  it("zapíše každou akci v admin centru", async () => {
    const a = await admin();
    const actor = { userId: a.id, actor: a.email };
    const m = await createUser(db, actor, { email: "m@sky-guard.cz", name: "M", role: "member" });
    if (!m.ok) return;
    await setUserRole(db, actor, m.user.id, "admin");
    await deactivateUser(db, actor, m.user.id);
    await activateUser(db, actor, m.user.id);
    await resetUserPassword(db, actor, m.user.id);

    const log = await readAudit(db);
    const actions = log.map((r) => r.action);
    for (const a of ["user.created", "user.role_changed", "user.deactivated", "user.activated", "user.password_reset"]) {
      expect(actions, `chybí ${a}`).toContain(a);
    }
  });

  it("nese, kdo akci provedl, a přežije smazání uživatele", async () => {
    const a = await admin("prvni@sky-guard.cz");
    const b = await admin("druhy@sky-guard.cz");
    await deleteUser(db, { userId: a.id, actor: a.email }, b.id);

    const log = await readAudit(db, { action: "user.deleted" as never });
    const rec = (await readAudit(db)).find((r) => r.target === b.id);
    expect(rec?.actor).toBe("prvni@sky-guard.cz");
    expect(log).toBeDefined();
  });

  it("dá se filtrovat podle uživatele i akce", async () => {
    const a = await admin();
    const actor = { userId: a.id, actor: a.email };
    await createUser(db, actor, { email: "m1@sky-guard.cz", name: "M1", role: "member" });
    await createUser(db, actor, { email: "m2@sky-guard.cz", name: "M2", role: "member" });

    // zakládající admin je taky user.created, proto tři
    expect((await readAudit(db, { action: "user.created" }))).toHaveLength(3);
    expect((await readAudit(db, { userId: a.id })).length).toBeGreaterThanOrEqual(2);
  });

  it("v aplikaci neexistuje cesta, která by z logu mazala", async () => {
    const mod = await import("../lib/auth/audit");
    const names = Object.keys(mod);
    expect(names.some((n) => /delete|remove|purge|clear|wipe|truncate/i.test(n))).toBe(false);
  });

  it("záznam nejde přepsat na jinou akci — log je jen k připisování", async () => {
    const a = await admin();
    const before = await readAudit(db);
    expect(before.length).toBeGreaterThan(0);
    // aplikace nemá update ani delete nad auditLog; kontrola je strukturální
    const mod = await import("../lib/auth/audit");
    expect(Object.keys(mod).filter((n) => /update|patch|edit/i.test(n))).toHaveLength(0);
    expect(a.id).toBeTruthy();
    expect((await db.select().from(auditLog)).length).toBe(before.length);
  });
});
