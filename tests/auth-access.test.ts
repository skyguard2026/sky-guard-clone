/**
 * Že member neprojde, ne jen že nevidí odkaz.
 *
 * Testuje se skutečná server action, ne jen pomocná funkce — tedy včetně
 * obálky, kontroly session a role. Skrytí položky v navigaci je pohodlí;
 * tohle je ta ochrana.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof drizzle>,
  cookie: "" as string,
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return h.db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sg_session" && h.cookie ? { value: h.cookie } : undefined,
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Map<string, string>(),
}));

import { createSession } from "../lib/auth/session";
import { createUser } from "../lib/auth/users";
import { schema } from "../lib/db/schema";

let pg: PGlite;
const SYS = { userId: null, actor: "test" };

async function make(role: "admin" | "member", email: string) {
  const r = await createUser(h.db, SYS, { email, name: role, role });
  if (!r.ok) throw new Error(r.error);
  return r.user;
}

beforeEach(async () => {
  pg = new PGlite();
  h.db = drizzle(pg, { schema, casing: "snake_case" });
  await migrate(h.db, { migrationsFolder: "./drizzle" });
  h.cookie = "";
});

afterEach(async () => {
  await pg.close();
});

describe("member proti admin akcím", () => {
  it("nezaloží uživatele", async () => {
    await make("admin", "admin@sky-guard.cz");
    const m = await make("member", "michal@sky-guard.cz");
    h.cookie = await createSession(h.db, m.id);

    const { adminCreateUser } = await import("../app/actions/admin");
    await expect(
      adminCreateUser({ email: "novy@sky-guard.cz", name: "N", role: "admin" }),
    ).rejects.toThrow(/oprávnění/i);
  });

  it("nepřečte audit log", async () => {
    await make("admin", "admin@sky-guard.cz");
    const m = await make("member", "michal@sky-guard.cz");
    h.cookie = await createSession(h.db, m.id);

    const { adminAudit } = await import("../app/actions/admin");
    await expect(adminAudit({})).rejects.toThrow(/oprávnění/i);
  });

  it("neukončí cizí session", async () => {
    const a = await make("admin", "admin@sky-guard.cz");
    const m = await make("member", "michal@sky-guard.cz");
    const adminSession = await createSession(h.db, a.id);
    h.cookie = await createSession(h.db, m.id);

    const { adminRevokeSession } = await import("../app/actions/admin");
    await expect(adminRevokeSession(adminSession)).rejects.toThrow(/oprávnění/i);
  });
});

describe("member proti sekci Finance", () => {
  it("nenahraje výpis", async () => {
    await make("admin", "admin@sky-guard.cz");
    const m = await make("member", "michal@sky-guard.cz");
    h.cookie = await createSession(h.db, m.id);

    const { saveStatement } = await import("../app/actions/finance");
    await expect(saveStatement("x.csv", "Datum;Částka\n01.08.2026;-1,00\n")).rejects.toThrow(
      /oprávnění/i,
    );
  });

  it("nezmění zařazení transakce", async () => {
    await make("admin", "admin@sky-guard.cz");
    const m = await make("member", "michal@sky-guard.cz");
    h.cookie = await createSession(h.db, m.id);

    const { assignCategory } = await import("../app/actions/finance");
    await expect(assignCategory(["x"], "fc_hw")).rejects.toThrow(/oprávnění/i);
  });

  it("nesmaže bankovní data", async () => {
    await make("admin", "admin@sky-guard.cz");
    const m = await make("member", "michal@sky-guard.cz");
    h.cookie = await createSession(h.db, m.id);

    const { wipeFinanceData } = await import("../app/actions/finance");
    await expect(wipeFinanceData()).rejects.toThrow(/oprávnění/i);
  });
});

describe("admin projde", () => {
  it("admin uživatele založí", async () => {
    const a = await make("admin", "admin@sky-guard.cz");
    h.cookie = await createSession(h.db, a.id);

    const { adminCreateUser } = await import("../app/actions/admin");
    const res = await adminCreateUser({ email: "novy@sky-guard.cz", name: "N", role: "member" });
    expect(res.ok).toBe(true);
  });
});

describe("bez přihlášení neprojde nikdo", () => {
  it("ani na akce pro členy", async () => {
    await make("admin", "admin@sky-guard.cz");
    h.cookie = "";
    const { createClient } = await import("../app/actions/clients");
    await expect(createClient({ name: "Klient", contact: "", note: "" })).rejects.toThrow(/přihlášen/i);
  });

  it("zneplatněná session přestane platit okamžitě", async () => {
    const a = await make("admin", "admin@sky-guard.cz");
    const sid = await createSession(h.db, a.id);
    h.cookie = sid;

    const { adminAudit } = await import("../app/actions/admin");
    expect(Array.isArray(await adminAudit({}))).toBe(true);

    const { revokeSession } = await import("../lib/auth/session");
    await revokeSession(h.db, sid);

    await expect(adminAudit({})).rejects.toThrow(/přihlášen/i);
  });
});
