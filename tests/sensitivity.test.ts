/**
 * Citlivostní analýza.
 *
 * Nejužitečnější číslo tu není marže při pevné ceně, ale obráceně: jakou cenu
 * si musíš říct, abys cílovou marži udržel. To je věta, která se dá použít
 * při jednání.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";
import { sensitivity, priceForMargin } from "../lib/sensitivity";
import type { CalcLocation, CatalogItem, Settings } from "../lib/types";

const catalog = (): CatalogItem[] => SEED_CATALOG.map((i) => ({ ...i }));
const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

const A: CalcLocation = {
  product: "drone",
  cameras: 0,
  camerasTlBig: 0,
  camerasTlSmall: 0,
  poles: 0,
  docks: 1,
  km: 260,
  hours: 8,
  trips1: 10,
  trips2: 8,
  price: 50000,
  setupFee: 0,
  off: {},
  over: {},
  qty: {},
};

const run = (loc = A, cat = catalog(), count = 1, target = 0.4) =>
  sensitivity(loc, cat, settings(), count, target);

const row = (rows: ReturnType<typeof run>, v: string) =>
  rows.find((r) => r.variable === v)!;

describe("cena pro cílovou marži", () => {
  it("je fullMonthly děleno zbytkem do jedné", () => {
    expect(priceForMargin(25378.35, 0.4)).toBeCloseTo(42297.25, 2);
    expect(priceForMargin(35378.35, 0.4)).toBeCloseTo(58963.92, 2);
    expect(priceForMargin(25378.35, 0)).toBeCloseTo(25378.35, 2);
  });

  it("při stoprocentní marži nevrací nekonečno", () => {
    expect(Number.isFinite(priceForMargin(25378.35, 1))).toBe(true);
    expect(Number.isFinite(priceForMargin(25378.35, 1.5))).toBe(true);
  });

  it("nulový náklad dává nulovou cenu", () => {
    expect(priceForMargin(0, 0.4)).toBe(0);
  });
});

describe("všech pět veličin", () => {
  it("je v analýze", () => {
    expect(run().map((r) => r.variable)).toEqual([
      "price",
      "km",
      "locationCount",
      "cameras",
      "docks",
    ]);
  });

  it("každá má pět bodů a právě jeden označený jako současný", () => {
    for (const r of run()) {
      expect(r.points).toHaveLength(5);
      expect(r.points.filter((p) => p.current)).toHaveLength(1);
    }
  });

  it("body jsou seřazené vzestupně", () => {
    for (const r of run()) {
      const v = r.points.map((p) => p.value);
      expect([...v].sort((a, b) => a - b)).toEqual(v);
    }
  });
});

describe("cena klientovi", () => {
  it("vyšší cena znamená vyšší marži i kumulativ", () => {
    const p = row(run(), "price").points;
    for (let i = 1; i < p.length; i++) {
      expect(p[i].margin).toBeGreaterThan(p[i - 1].margin);
      expect(p[i].cumulative).toBeGreaterThan(p[i - 1].cumulative);
    }
  });

  it("cena pro cílovou marži je na ceně nezávislá", () => {
    // fullMonthly na ceně klientovi nezávisí, takže podlaha je pořád stejná
    const p = row(run(), "price").points;
    for (const x of p) {
      expect(x.fullMonthly).toBeCloseTo(p[0].fullMonthly, 9);
      expect(x.priceForTarget).toBeCloseTo(p[0].priceForTarget, 6);
    }
  });
});

describe("vzdálenost", () => {
  // Doprava na výjezdech se násobí kilometry, práce na místě ne.
  const DALEKO: CalcLocation = { ...A, km: 260, trips1: 8, trips2: 8 };

  it("posouvá podlahu ceny nahoru", () => {
    const r = row(run(DALEKO), "km");
    expect(r.currentValue).toBe(260);
    expect(r.points.some((x) => x.current && x.value === 260)).toBe(true);
    for (let i = 1; i < r.points.length; i++) {
      expect(r.points[i].priceForTarget).toBeGreaterThan(
        r.points[i - 1].priceForTarget,
      );
    }
    for (const x of r.points) {
      expect(x.priceForTarget).toBeCloseTo(x.fullMonthly / 0.6, 6);
    }
  });

  it("rozdíl mezi body je přesně doprava na výjezdech", () => {
    const p = row(run(DALEKO), "km").points;
    const rozdilKm = p[1].value - p[0].value;
    expect(p[1].fullMonthly - p[0].fullMonthly).toBeCloseTo(
      (8 * rozdilKm * 10.33) / 12,
      6,
    );
  });

  it("při pevné ceně klesá marže s rostoucí vzdáleností", () => {
    const p = row(run(DALEKO), "km").points;
    expect(p[0].margin).toBeGreaterThan(p[4].margin);
  });

  it("nulová vzdálenost dá nulovou dopravu", () => {
    const p = row(run(), "km").points;
    expect(p[0].value).toBe(0);
    expect(p.every((x) => x.value >= 0)).toBe(true);
  });
});

describe("počet lokalit v portfoliu", () => {
  it("víc lokalit sníží podlahu, protože se sdílené položky dělí", () => {
    const p = row(run(), "locationCount").points;
    for (let i = 1; i < p.length; i++) {
      expect(p[i].priceForTarget).toBeLessThan(p[i - 1].priceForTarget);
      expect(p[i].margin).toBeGreaterThan(p[i - 1].margin);
    }
    expect(p[0].value).toBe(1);
  });
});

describe("počet kamer a stanic", () => {
  it("víc stanic znamená vyšší podlahu", () => {
    const p = row(run(), "docks").points;
    for (let i = 1; i < p.length; i++) {
      expect(p[i].priceForTarget).toBeGreaterThan(p[i - 1].priceForTarget);
    }
  });

  it("u Sky Cam víc kamer znamená vyšší podlahu", () => {
    const cam: CalcLocation = { ...A, product: "cam", cameras: 5, poles: 3 };
    const p = row(run(cam), "cameras").points;
    for (let i = 1; i < p.length; i++) {
      expect(p[i].priceForTarget).toBeGreaterThan(p[i - 1].priceForTarget);
    }
  });

  it("počty nikdy nejdou pod nulu", () => {
    const maly: CalcLocation = { ...A, cameras: 0, docks: 0 };
    for (const v of ["cameras", "docks"]) {
      for (const p of row(run(maly), v).points) {
        expect(p.value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("cílová marže je parametr", () => {
  it("vyšší cíl znamená vyšší požadovanou cenu", () => {
    const a = row(run(A, catalog(), 1, 0.3), "km").points[0];
    const b = row(run(A, catalog(), 1, 0.5), "km").points[0];
    expect(b.priceForTarget).toBeGreaterThan(a.priceForTarget);
    expect(a.priceForTarget).toBeCloseTo(a.fullMonthly / 0.7, 6);
    expect(b.priceForTarget).toBeCloseTo(b.fullMonthly / 0.5, 6);
  });
});

describe("hraniční stavy", () => {
  it("lokalita bez nákladů nerozbije dělení", () => {
    const prazdna: CalcLocation = { ...A, docks: 0, price: 0 };
    for (const r of sensitivity(prazdna, [], settings(), 1, 0.4)) {
      for (const p of r.points) {
        expect(Number.isFinite(p.priceForTarget)).toBe(true);
        expect(Number.isFinite(p.margin)).toBe(true);
      }
    }
  });

  it("nevratná konfigurace vrací payback null, ne nesmysl", () => {
    const drahy: CalcLocation = { ...A, price: 1000 };
    const p = row(run(drahy), "km").points;
    expect(p.some((x) => x.payback === null)).toBe(true);
  });
});
