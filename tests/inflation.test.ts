/**
 * Inflace ročních položek.
 *
 * Nejdůležitější vlastnost: s nulovou sazbou se nesmí hnout nic. Kontrolní
 * hodnoty ze SPEC §4 existují proto, aby chytily nechtěnou změnu chování
 * jádra — kdyby je rozbilo plánované rozšíření, přestaly by cokoli hlídat.
 */
import { describe, expect, it } from "vitest";
import { calc } from "../lib/calc";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import type { CalcLocation, CatalogItem, Settings } from "../lib/types";
import { specCatalog } from "./spec-catalog";

// Kontrolní hodnoty se ověřují proti zafixovanému katalogu — viz spec-catalog.ts
const catalog = (): CatalogItem[] => specCatalog();
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

const czk = (n: number) => Math.round(n);

/** Průměrný inflační faktor přes horizont, rok = ceil(m/12). */
function avgFactor(rate: number, horizon: number): number {
  let s = 0;
  for (let m = 1; m <= horizon; m++) {
    s += Math.pow(1 + rate / 100, Math.ceil(m / 12) - 1);
  }
  return s / horizon;
}

describe("nulová sazba nesmí hnout ničím", () => {
  it("případ A zůstává na kontrolních hodnotách", () => {
    const r = calc(A, catalog(), settings({ inflation: 0 }), 1);
    expect(czk(r.day0)).toBe(521565);
    expect(r.monthlyCash).toBeCloseTo(14930.68, 2);
    expect(r.amortMonthly).toBeCloseTo(10447.66, 2);
    expect(r.fullMonthly).toBeCloseTo(25378.35, 2);
    expect(r.payback).toBe(15);
    expect(czk(r.flow[36])).toBe(720684);
    expect(r.margin).toBeCloseTo(0.4924, 4);
  });

  it("chybějící pole se chová jako nula", () => {
    const bez = calc(
      A,
      catalog(),
      { ...settings(), inflation: undefined as unknown as number },
      1,
    );
    const nula = calc(A, catalog(), settings({ inflation: 0 }), 1);
    expect(bez.fullMonthly).toBe(nula.fullMonthly);
    expect(bez.flow).toEqual(nula.flow);
  });

  it("průměrný faktor je při nule přesně 1", () => {
    const r = calc(A, catalog(), settings({ inflation: 0 }), 1);
    expect(r.inflationFactor).toBe(1);
  });
});

describe("nenulová sazba", () => {
  const RATE = 6;

  it("průměrný faktor přes horizont, ne hodnota prvního roku", () => {
    const r = calc(A, catalog(), settings({ inflation: RATE }), 1);
    // horizont 36 = tři roky s faktory 1, 1,06 a 1,1236
    expect(r.inflationFactor).toBeCloseTo((1 + 1.06 + 1.06 ** 2) / 3, 10);
    expect(r.inflationFactor).toBeCloseTo(avgFactor(RATE, 36), 10);
    // rozhodně ne faktor prvního roku
    expect(r.inflationFactor).toBeGreaterThan(1);
  });

  it("day0 se nemění, protože předplatné prvního roku neinflatuje", () => {
    const r = calc(A, catalog(), settings({ inflation: RATE }), 1);
    expect(czk(r.day0)).toBe(521565);
    expect(czk(r.prepaid)).toBe(113621);
    expect(czk(r.capexTotal)).toBe(382944);
    expect(czk(r.startupTotal)).toBe(25000);
  });

  it("fullMonthly roste jen o inflatovanou část ročních položek", () => {
    const bez = calc(A, catalog(), settings({ inflation: 0 }), 1);
    const s = calc(A, catalog(), settings({ inflation: RATE }), 1);
    const f = s.inflationFactor;

    // rezerva je pctHw, ta se neinflatuje
    const rezerva = bez.lines.find((l) => l.it.id === "sh_reserve")!.amount;
    const inflatovatelne = bez.yearlyTotal - rezerva;
    const ocekavany =
      bez.monthlyTotal +
      (inflatovatelne * f + rezerva) / 12 +
      bez.amortMonthly;

    expect(s.fullMonthly).toBeCloseTo(ocekavany, 6);
    expect(s.amortMonthly).toBe(bez.amortMonthly);
    expect(s.monthlyTotal).toBe(bez.monthlyTotal);
  });

  it("delší horizont znamená vyšší průměrný faktor", () => {
    const a = calc(A, catalog(), settings({ inflation: RATE, horizon: 36 }), 1);
    const b = calc(A, catalog(), settings({ inflation: RATE, horizon: 60 }), 1);
    expect(b.inflationFactor).toBeGreaterThan(a.inflationFactor);
    expect(b.fullMonthly).toBeGreaterThan(a.fullMonthly);
  });

  it("obnova předplatného ve 13. měsíci stojí o inflaci víc", () => {
    const bez = calc(A, catalog(), settings({ inflation: 0 }), 1);
    const s = calc(A, catalog(), settings({ inflation: RATE }), 1);
    // rozdíl hotovosti mezi 12. a 13. měsícem obsahuje obnovu předplatného
    const skokBez = bez.flow[12] - bez.flow[13];
    const skokS = s.flow[12] - s.flow[13];
    // předplatné druhého roku je dražší o 6 %
    const rezervaPre = 0; // rezerva je průběžná, ne předplacená
    expect(skokS - skokBez).toBeCloseTo(
      (bez.preTotal - rezervaPre) * (1.06 - 1) +
        // navíc průběžné roční položky druhého roku
        ((bez.accTotal -
          bez.lines.find((l) => l.it.id === "sh_reserve")!.amount) *
          (1.06 - 1)) /
          12,
      2,
    );
  });

  it("marže klesá a návratnost se prodlužuje", () => {
    const bez = calc(A, catalog(), settings({ inflation: 0 }), 1);
    const s = calc(A, catalog(), settings({ inflation: 7 }), 1);
    expect(s.margin).toBeLessThan(bez.margin);
    expect(s.flow[36]).toBeLessThan(bez.flow[36]);
    expect(s.payback!).toBeGreaterThanOrEqual(bez.payback!);
  });

  it("rozpad podle kategorií se dál sečte na fullMonthly", () => {
    const s = calc(A, catalog(), settings({ inflation: RATE }), 1);
    const soucet = Object.values(s.byCat).reduce((a, v) => a + (v || 0), 0);
    expect(soucet).toBeCloseTo(s.fullMonthly, 6);
  });

  it("měsíční položky inflace nezvyšuje", () => {
    const cam: CalcLocation = { ...A, product: "cam", cameras: 5, poles: 3 };
    const bez = calc(cam, catalog(), settings({ inflation: 0 }), 1);
    const s = calc(cam, catalog(), settings({ inflation: 10 }), 1);
    expect(s.monthlyTotal).toBe(bez.monthlyTotal);
    const starlinkBez = bez.lines.find((l) => l.it.id === "cam_starlink")!;
    const starlinkS = s.lines.find((l) => l.it.id === "cam_starlink")!;
    expect(starlinkS.amount).toBe(starlinkBez.amount);
    expect(starlinkS.monthly).toBe(starlinkBez.monthly);
  });
});

describe("pctHw se neinflatuje", () => {
  /**
   * sh_reserve je procento z hodnoty hardwaru, ne korunová částka.
   * Kdyby inflatovala, rostla by rezerva rychleji než majetek,
   * ze kterého se počítá.
   */
  it("částka rezervy je na sazbě nezávislá", () => {
    for (const rate of [0, 5, 10, 25]) {
      const r = calc(A, catalog(), settings({ inflation: rate }), 1);
      const rezerva = r.lines.find((l) => l.it.id === "sh_reserve")!;
      expect(rezerva.amount).toBeCloseTo(382944 * 0.05, 6);
      expect(rezerva.monthly).toBeCloseTo((382944 * 0.05) / 12, 6);
    }
  });

  it("rezerva zůstává přesně 5 % z hodnoty hardwaru i při inflaci", () => {
    const r = calc(A, catalog(), settings({ inflation: 10 }), 1);
    const rezerva = r.lines.find((l) => l.it.id === "sh_reserve")!;
    expect(rezerva.amount).toBeCloseTo(r.hwValue * 0.05, 6);
  });

  it("kdyby se rezerva inflatovala, fullMonthly by bylo vyšší", () => {
    const s = calc(A, catalog(), settings({ inflation: 10 }), 1);
    const rezerva = s.lines.find((l) => l.it.id === "sh_reserve")!.amount;
    // rozdíl, který by vznikl, kdyby rezerva inflaci podléhala
    const rozdil = (rezerva * (s.inflationFactor - 1)) / 12;
    expect(rozdil).toBeGreaterThan(100);
    // a ten rozdíl ve fullMonthly opravdu není
    const bez = calc(A, catalog(), settings({ inflation: 0 }), 1);
    const inflatovatelne =
      bez.yearlyTotal -
      bez.lines.find((l) => l.it.id === "sh_reserve")!.amount;
    expect(s.fullMonthly).toBeCloseTo(
      bez.monthlyTotal +
        (inflatovatelne * s.inflationFactor + rezerva) / 12 +
        bez.amortMonthly,
      6,
    );
  });

  it("v simulaci hotovosti se rezerva taky neinflatuje", () => {
    const cat = catalog().map((i) =>
      // vypneme všechny ostatní roční položky, ať zbude jen rezerva
      i.billing === "yearly" && i.id !== "sh_reserve"
        ? { ...i, enabled: false }
        : i,
    );
    const bez = calc(A, cat, settings({ inflation: 0 }), 1);
    const s = calc(A, cat, settings({ inflation: 20 }), 1);
    expect(s.flow).toEqual(bez.flow);
    expect(s.fullMonthly).toBe(bez.fullMonthly);
  });
});
