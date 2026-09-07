/**
 * Zbytková hodnota hardwaru na konci kontraktu.
 *
 * Počítá se mimo `calc` schválně — do hotovosti ani marže vstoupit nesmí.
 * Je to samostatný ukazatel pro rozhodnutí o délce kontraktu, ne příjem.
 */
import { describe, expect, it } from "vitest";
import { calc } from "../lib/calc";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";
import { residualValue } from "../lib/residual";
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

const run = (over: Partial<Settings> = {}) => {
  const st = settings({ horizon: 84, ...over });
  return { r: calc(A, catalog(), st, 1), st };
};

describe("účetní zůstatek při plné realizovatelnosti", () => {
  it("po 36 měsících vychází 145 212 Kč", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 0 });
    const z = residualValue(r, st, 36);
    expect(Math.round(z.total)).toBe(145212);
  });

  it("sedí položku po položce na ruční výpočet", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 0 });
    const z = residualValue(r, st, 36);
    const podle = (id: string) => z.lines.find((l) => l.it.id === id)!;

    // dok má životnost 42, výměna přijde až ve 43. měsíci → zbývá 6
    expect(podle("dr_dock").remainingLife).toBe(6);
    expect(podle("dr_dock").value).toBeCloseTo((268587 * 6) / 42, 4);
    // dron byl vyměněn ve 31., takže je mu 5 měsíců a zbývá 25
    expect(podle("dr_drone").remainingLife).toBe(25);
    expect(podle("dr_drone").value).toBeCloseTo((127264 * 25) / 30, 4);
    // baterie vyměněné ve 25., zbývá 13
    expect(podle("dr_battery").remainingLife).toBe(13);
  });

  it("sleva dealera zůstatek snižuje, nezaokrouhluje se na nulu", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 0 });
    const z = residualValue(r, st, 36);
    const sleva = z.lines.find((l) => l.it.id === "dr_discount")!;
    expect(sleva.value).toBeLessThan(0);
    expect(sleva.value).toBeCloseTo((-22808 * 6) / 42, 4);

    const bezSlevy = calc(
      A,
      catalog().filter((i) => i.id !== "dr_discount"),
      st,
      1,
    );
    expect(residualValue(bezSlevy, st, 36).total).toBeGreaterThan(z.total);
  });
});

describe("koeficient a prodleva", () => {
  it("nulový koeficient znamená nulový zůstatek", () => {
    const { r, st } = run({ residualRate: 0, transferDelay: 0 });
    expect(residualValue(r, st, 36).total).toBe(0);
  });

  it("koeficient zůstatek škáluje", () => {
    const plny = run({ residualRate: 100, transferDelay: 0 });
    const pul = run({ residualRate: 50, transferDelay: 0 });
    expect(residualValue(pul.r, pul.st, 36).total).toBeCloseTo(
      residualValue(plny.r, plny.st, 36).total * 0.5,
      4,
    );
  });

  it("prodleva ubírá měsíční amortizaci a nikdy nejde pod nulu", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 6 });
    const z = residualValue(r, st, 36);
    const dok = z.lines.find((l) => l.it.id === "dr_dock")!;
    expect(dok.delayCost).toBeCloseTo(6 * (268587 / 42), 4);
    expect(dok.value).toBeCloseTo((268587 * 6) / 42 - 6 * (268587 / 42), 4);
    expect(dok.value).toBe(0); // šest měsíců zbývá, šest se odečte
  });

  it("výchozí nastavení: u doku se přenos nevyplatí, u dronu ano", () => {
    const { r, st } = run(); // 40 % a 6 měsíců
    const z = residualValue(r, st, 36);
    expect(z.lines.find((l) => l.it.id === "dr_dock")!.value).toBe(0);
    expect(z.lines.find((l) => l.it.id === "dr_drone")!.value).toBeGreaterThan(
      0,
    );
    expect(z.total).toBeGreaterThan(0);
    expect(z.total).toBeLessThan(
      residualValue(
        run({ residualRate: 100, transferDelay: 0 }).r,
        settings({ horizon: 84, residualRate: 100, transferDelay: 0 }),
        36,
      ).total,
    );
  });

  it("prodleva delší než životnost dá nulu, ne záporné číslo", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 60 });
    const z = residualValue(r, st, 36);
    expect(z.total).toBe(0);
    for (const l of z.lines) {
      if (l.amount > 0) expect(l.value).toBe(0);
    }
  });
});

describe("co do zůstatku nepatří", () => {
  it("uvedení do provozu se nezapočítává", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 0 });
    const z = residualValue(r, st, 36);
    for (const id of ["dr_setup", "dr_install", "dr_infra"]) {
      expect(z.lines.some((l) => l.it.id === id)).toBe(false);
    }
  });

  it("roční ani měsíční položky se nezapočítávají", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 0 });
    const z = residualValue(r, st, 36);
    for (const l of z.lines) expect(l.it.billing).toBe("oneoff");
  });
});

describe("bez obnov hardware jen stárne", () => {
  it("s renew = false je dron po 36 měsících odepsaný", () => {
    const st = settings({
      horizon: 84,
      renew: false,
      residualRate: 100,
      transferDelay: 0,
    });
    const r = calc(A, catalog(), st, 1);
    const z = residualValue(r, st, 36);
    expect(z.lines.find((l) => l.it.id === "dr_drone")!.remainingLife).toBe(0);
    expect(z.lines.find((l) => l.it.id === "dr_dock")!.remainingLife).toBe(6);
  });
});

describe("zůstatek nevstupuje do hotovosti ani marže", () => {
  it("změna koeficientu ani prodlevy s výpočtem nehne", () => {
    const a = calc(A, catalog(), settings({ residualRate: 0, transferDelay: 0 }), 1);
    const b = calc(
      A,
      catalog(),
      settings({ residualRate: 100, transferDelay: 24 }),
      1,
    );
    expect(b.day0).toBe(a.day0);
    expect(b.fullMonthly).toBe(a.fullMonthly);
    expect(b.margin).toBe(a.margin);
    expect(b.payback).toBe(a.payback);
    expect(b.flow).toEqual(a.flow);
  });
});

describe("v čase", () => {
  it("mezi obnovami klesá, obnovou skokem vyroste", () => {
    const { r, st } = run({ residualRate: 100, transferDelay: 0 });
    const v = (m: number) => residualValue(r, st, m).total;
    expect(v(30)).toBeLessThan(v(24));
    expect(v(31)).toBeGreaterThan(v(30)); // výměna dronu
    expect(v(42)).toBeLessThan(v(36));
    expect(v(43)).toBeGreaterThan(v(42)); // výměna stanice a donglu
  });

  it("na lokalitě bez hardwaru je nula", () => {
    const st = settings({ horizon: 84 });
    const r = calc({ ...A, docks: 0 }, catalog(), st, 1);
    expect(residualValue(r, st, 36).total).toBe(0);
  });
});
