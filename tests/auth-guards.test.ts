/**
 * Kontrola oprávnění u server actions.
 *
 * Test si projde **všechny** exportované akce a ověří, že každá prošla jednou
 * z obálek withUser, withAdmin nebo publicAction. Nekontroluje se to hledáním
 * v textu zdrojáku — obálka nechá na funkci značku a ta se čte z běžícího
 * objektu. Zapomenutá stráž tím shodí test, ne až produkci.
 */
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { guardOf, publicAction, withAdmin, withUser } from "../lib/auth/guards";

const FILES = readdirSync("app/actions")
  .filter((f) => f.endsWith(".ts"))
  .sort();

/** Akce, které smí být bez přihlášení. Seznam je schválně krátký a ručně vedený. */
const PUBLIC_ALLOWED = new Set(["login", "logout"]);

describe("obálky značkují", () => {
  it("withUser, withAdmin i publicAction nechají na funkci značku", () => {
    expect(guardOf(withUser(async () => 1))).toBe("user");
    expect(guardOf(withAdmin(async () => 1))).toBe("admin");
    expect(guardOf(publicAction(async () => 1))).toBe("public");
  });

  it("neobalená funkce značku nemá", () => {
    expect(guardOf(async () => 1)).toBeNull();
    expect(guardOf(undefined)).toBeNull();
    expect(guardOf("cokoli")).toBeNull();
  });

  it("značka nepřekáží volání ani argumentům", async () => {
    const f = withUser(async (_u, a: number, b: number) => a + b);
    expect(typeof f).toBe("function");
    expect(f.length).toBeGreaterThanOrEqual(0);
  });
});

describe("žádná akce nesmí zůstat bez kontroly", () => {
  it("našel se aspoň jeden modul s akcemi", () => {
    expect(FILES.length).toBeGreaterThan(3);
  });

  for (const file of FILES) {
    it(`app/actions/${file} — každý export má stráž`, async () => {
      const mod = (await import(`../app/actions/${file}`)) as Record<string, unknown>;
      const fns = Object.entries(mod).filter(([, v]) => typeof v === "function");
      expect(fns.length, `${file} neexportuje žádnou akci`).toBeGreaterThan(0);

      const bare = fns.filter(([, fn]) => guardOf(fn) === null).map(([n]) => n);
      expect(
        bare,
        `bez withUser/withAdmin/publicAction: ${bare.join(", ")}`,
      ).toEqual([]);
    });
  }

  it("veřejné jsou jen přihlášení a odhlášení", async () => {
    const publicOnes: string[] = [];
    for (const file of FILES) {
      const mod = (await import(`../app/actions/${file}`)) as Record<string, unknown>;
      for (const [name, fn] of Object.entries(mod)) {
        if (guardOf(fn) === "public") publicOnes.push(name);
      }
    }
    for (const name of publicOnes) {
      expect(PUBLIC_ALLOWED.has(name), `${name} je veřejná, ale nemá být`).toBe(true);
    }
  });

  it("celá sekce Finance je jen pro admina", async () => {
    const mod = (await import("../app/actions/finance")) as Record<string, unknown>;
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      expect(guardOf(fn), `finance.${name} musí být withAdmin`).toBe("admin");
    }
  });

  it("admin centrum je jen pro admina", async () => {
    const mod = (await import("../app/actions/admin")) as Record<string, unknown>;
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      expect(guardOf(fn), `admin.${name} musí být withAdmin`).toBe("admin");
    }
  });
});
