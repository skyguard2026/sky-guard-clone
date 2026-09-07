/**
 * Analýza délky kontraktu.
 *
 * Pozor na rozdíl mezi lokálním a globálním optimem. Vstupní investice se
 * rozpouští do počtu měsíců, takže delší kontrakt vyhrává skoro vždycky —
 * globální maximum je proto vždy nejdelší délka rozsahu. Zajímavá jsou
 * lokální optima, protože ta říkají, kde uvnitř toho trendu skončit.
 */
import { describe, expect, it } from "vitest";
import { analyzeContractLength } from "../lib/contract-length";
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

const analyze = (over: Partial<Settings> = {}) =>
  analyzeContractLength(A, catalog(), settings(over), 1);

const at = (a: ReturnType<typeof analyze>, m: number) =>
  a.rows.find((r) => r.months === m)!;

describe("rozsah a tvar", () => {
  it("pokrývá 24 až 72 měsíců", () => {
    const a = analyze();
    expect(a.rows[0].months).toBe(24);
    expect(a.rows[a.rows.length - 1].months).toBe(72);
    expect(a.rows).toHaveLength(49);
  });

  it("hodnota na měsíc se počítá s zůstatkem i bez něj", () => {
    const a = analyze({ residualRate: 100, transferDelay: 0 });
    const r = at(a, 36);
    expect(r.perMonthWithout).toBeCloseTo(r.cash / 36, 6);
    expect(r.perMonthWith).toBeCloseTo((r.cash + r.residual) / 36, 6);
    expect(r.residual).toBeGreaterThan(0);
  });
});

describe("bez zbytkové hodnoty vyhrává 42", () => {
  it("42 je lepší než 36 i než 48", () => {
    const a = analyze({ residualRate: 0, transferDelay: 0 });
    expect(at(a, 42).perMonthWithout).toBeGreaterThan(
      at(a, 36).perMonthWithout,
    );
    expect(at(a, 42).perMonthWithout).toBeGreaterThan(
      at(a, 48).perMonthWithout,
    );
    // a 48 je z té trojice nejhorší
    expect(at(a, 48).perMonthWithout).toBeLessThan(at(a, 36).perMonthWithout);
    expect(a.bestWithout).toBe(42);
  });
});

describe("s plnou zbytkovou hodnotou vyhrává 48", () => {
  it("48 je lepší než 36 i než 42", () => {
    const a = analyze({ residualRate: 100, transferDelay: 0 });
    expect(at(a, 48).perMonthWith).toBeGreaterThan(at(a, 36).perMonthWith);
    expect(at(a, 48).perMonthWith).toBeGreaterThan(at(a, 42).perMonthWith);
    expect(a.bestWith).toBe(48);
  });

  it("42 přestává být lokálním optimem, protože se hodnota vrátí v zůstatku", () => {
    const bez = analyze({ residualRate: 0, transferDelay: 0 });
    const s = analyze({ residualRate: 100, transferDelay: 0 });
    expect(bez.localOptimaWithout).toContain(42);
    expect(s.localOptimaWith).not.toContain(42);
  });
});

describe("globální maximum je vždy nejdelší délka rozsahu", () => {
  it("platí ve všech variantách zůstatku", () => {
    for (const over of [
      { residualRate: 0, transferDelay: 0 },
      { residualRate: 40, transferDelay: 6 },
      { residualRate: 100, transferDelay: 0 },
    ]) {
      const a = analyze(over);
      expect(a.globalWith).toBe(72);
      expect(a.globalWithout).toBe(72);
    }
  });

  it("nejdelší délka je měřitelně lepší než doporučená", () => {
    const a = analyze({ residualRate: 0, transferDelay: 0 });
    expect(a.globalWith).toBeGreaterThan(a.recommended);
    // konkrétní číslo do argumentace, ne jen „delší je lepší"
    expect(a.globalGainPct).toBeGreaterThan(5);
    expect(a.globalGainPct).toBeLessThan(30);
  });
});

describe("optima leží měsíc před velkou obnovou", () => {
  it("každé lokální optimum má hned za sebou obnovu", () => {
    for (const over of [
      { residualRate: 0, transferDelay: 0 },
      { residualRate: 40, transferDelay: 6 },
      { residualRate: 100, transferDelay: 0 },
    ]) {
      const a = analyze(over);
      const mesiceObnov = new Set(a.renewals.map((x) => x.month));
      for (const L of [...a.localOptimaWith, ...a.localOptimaWithout]) {
        expect(mesiceObnov.has(L + 1), `L=${L} nemá za sebou obnovu`).toBe(
          true,
        );
      }
    }
  });

  it("bez zůstatku jsou optimy i před obnovou dronu a stanice, ne jen předplatného", () => {
    const a = analyze({ residualRate: 0, transferDelay: 0 });
    expect(a.localOptimaWithout).toEqual(
      expect.arrayContaining([30, 36, 42, 48, 60]),
    );
  });
});

describe("kalendář obnov", () => {
  it("vypíše měsíce, částky a co se obnovuje", () => {
    const a = analyze();
    const m = (x: number) => a.renewals.find((r) => r.month === x)!;
    expect(a.renewals.map((r) => r.month)).toEqual([
      13, 25, 31, 37, 43, 49, 61, 73,
    ]);
    expect(Math.round(m(13).amount)).toBe(113621);
    expect(Math.round(m(25).amount)).toBe(120224);
    expect(Math.round(m(43).amount)).toBe(249077);
    expect(Math.round(m(61).amount)).toBe(240885);
    expect(m(43).labels).toEqual(
      expect.arrayContaining(["dokovací stanice", "dongle", "sleva dealera"]),
    );
  });

  it("označí měsíce, kde se sejde víc obnov najednou", () => {
    const a = analyze();
    const vic = a.renewals.filter((r) => r.labels.length > 1).map((r) => r.month);
    expect(vic).toEqual([25, 43, 49, 61, 73]);
  });

  it("nejdražší měsíce jsou 43 a 61", () => {
    const a = analyze();
    const podleCastky = [...a.renewals].sort((x, y) => y.amount - x.amount);
    expect(podleCastky.slice(0, 2).map((r) => r.month).sort()).toEqual([43, 61]);
  });
});

describe("doporučení", () => {
  it("nepřekročí 48 měsíců, aby bylo použitelné při jednání", () => {
    for (const over of [
      { residualRate: 0, transferDelay: 0 },
      { residualRate: 40, transferDelay: 6 },
      { residualRate: 100, transferDelay: 0 },
    ]) {
      const a = analyze(over);
      expect(a.recommended).toBeLessThanOrEqual(48);
      expect(a.localOptimaWith).toContain(a.recommended);
    }
  });

  it("při výchozím nastavení doporučí 42", () => {
    expect(analyze({ residualRate: 40, transferDelay: 6 }).recommended).toBe(42);
  });

  it("při plné realizovatelnosti doporučí 48", () => {
    expect(analyze({ residualRate: 100, transferDelay: 0 }).recommended).toBe(
      48,
    );
  });
});

describe("lokalita bez hardwaru analýzu nerozbije", () => {
  it("vrátí konečná čísla", () => {
    const a = analyzeContractLength(
      { ...A, docks: 0 },
      catalog(),
      settings(),
      1,
    );
    expect(a.rows.every((r) => Number.isFinite(r.perMonthWith))).toBe(true);
    expect(a.renewals.length).toBeGreaterThanOrEqual(0);
  });
});
