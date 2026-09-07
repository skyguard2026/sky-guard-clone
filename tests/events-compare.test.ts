/**
 * Kalendář obnov v grafu (bod 5) a srovnání produktů (bod 6).
 */
import { describe, expect, it } from "vitest";
import { calc } from "../lib/calc";
import { compareProducts } from "../lib/compare-products";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";
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

describe("kalendář obnov nese částky", () => {
  const r = calc(A, catalog(), settings({ horizon: 72 }), 1);

  it("eventDetails sedí na events a doplňuje částky", () => {
    expect(Object.keys(r.eventDetails)).toEqual(Object.keys(r.events));
    for (const [m, list] of Object.entries(r.eventDetails)) {
      expect(list.map((x) => x.label)).toEqual(r.events[Number(m)]);
      for (const x of list) expect(Number.isFinite(x.amount)).toBe(true);
    }
  });

  it("částky jednotlivých obnov", () => {
    const soucet = (m: number) =>
      Math.round(r.eventDetails[m].reduce((s, x) => s + x.amount, 0));
    expect(soucet(13)).toBe(113621);
    expect(soucet(25)).toBe(120224);
    expect(soucet(31)).toBe(127264);
    expect(soucet(43)).toBe(249077);
    expect(soucet(61)).toBe(240885);
  });

  it("nejtenčí místa jsou měsíce s víc obnovami najednou", () => {
    const vic = Object.entries(r.eventDetails)
      .filter(([, list]) => list.length > 1)
      .map(([m]) => Number(m));
    expect(vic).toEqual([25, 43, 49, 61]);
  });

  it("ve 43. měsíci se sejde stanice, dongle i sleva", () => {
    const l = r.eventDetails[43];
    expect(l.map((x) => x.label).sort()).toEqual([
      "dokovací stanice",
      "dongle",
      "sleva dealera",
    ]);
    expect(l.find((x) => x.label === "sleva dealera")!.amount).toBe(-22808);
  });

  it("s inflací obnova předplatného zdraží, výměna hardwaru ne", () => {
    const s = calc(A, catalog(), settings({ horizon: 72, inflation: 6 }), 1);
    expect(s.eventDetails[13][0].amount).toBeGreaterThan(
      r.eventDetails[13][0].amount,
    );
    const dronBez = r.eventDetails[31][0].amount;
    const dronS = s.eventDetails[31][0].amount;
    expect(dronS).toBe(dronBez);
  });
});

describe("srovnání produktů na jedné lokalitě", () => {
  const loc: CalcLocation = {
    ...A,
    product: "drone",
    cameras: 8,
    poles: 5,
    docks: 1,
  };

  it("vrátí tři varianty nad týmiž vstupy", () => {
    const c = compareProducts(loc, catalog(), settings(), 1);
    expect(c.map((x) => x.product)).toEqual(["cam", "drone", "both"]);
    for (const x of c) {
      expect(Number.isFinite(x.result.fullMonthly)).toBe(true);
      expect(x.result.day0).toBeGreaterThanOrEqual(0);
    }
  });

  it("kombinace stojí víc než kterákoli část zvlášť", () => {
    const [cam, drone, both] = compareProducts(loc, catalog(), settings(), 1);
    expect(both.result.fullMonthly).toBeGreaterThan(cam.result.fullMonthly);
    expect(both.result.fullMonthly).toBeGreaterThan(drone.result.fullMonthly);
    expect(both.result.day0).toBeGreaterThan(drone.result.day0);
  });

  it("označí variantu, která je právě nastavená", () => {
    const c = compareProducts(loc, catalog(), settings(), 1);
    expect(c.filter((x) => x.current).map((x) => x.product)).toEqual(["drone"]);
  });

  it("neukládá ani nemění vstupní lokalitu", () => {
    const puvodni = JSON.parse(JSON.stringify(loc));
    compareProducts(loc, catalog(), settings(), 1);
    expect(loc).toEqual(puvodni);
  });

  it("upozorní, když varianta nedává smysl kvůli nulovým vstupům", () => {
    const bezKamer: CalcLocation = { ...loc, cameras: 0, poles: 0 };
    const c = compareProducts(bezKamer, catalog(), settings(), 1);
    const cam = c.find((x) => x.product === "cam")!;
    expect(cam.warning).toContain("kamer");
    expect(c.find((x) => x.product === "drone")!.warning).toBeNull();
  });

  it("bez stanic upozorní u dronu", () => {
    const bezStanic: CalcLocation = { ...loc, docks: 0 };
    const c = compareProducts(bezStanic, catalog(), settings(), 1);
    expect(c.find((x) => x.product === "drone")!.warning).toContain("stanic");
  });

  it("marže se počítá proti stejné ceně u všech variant", () => {
    const c = compareProducts(loc, catalog(), settings(), 1);
    for (const x of c) {
      expect(x.result.margin).toBeCloseTo(
        (loc.price - x.result.fullMonthly) / loc.price,
        9,
      );
    }
  });
});
