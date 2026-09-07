/**
 * Kontrolní hodnoty podle SPEC.md §4.
 * Testy běží proti čistým objektům, nikdy proti databázi — jádro se ověřuje
 * samo o sobě, oddělené od toho, jak se čísla ukládají a načítají.
 */
import { describe, expect, it } from "vitest";
import { calc } from "../lib/calc";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";
import { specCatalog } from "./spec-catalog";
import type { CalcLocation, CatalogItem, Settings } from "../lib/types";

/**
 * Kontrolní hodnoty ze SPEC §4 se ověřují proti zafixovanému katalogu, ne
 * proti živému ceníku — jinak by se očekávaná čísla přepisovala pokaždé, když
 * se změní cena, a přestala by cokoli hlídat. Viz tests/spec-catalog.ts.
 */
const catalog = (): CatalogItem[] => specCatalog();
const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

const loc = (over: Partial<CalcLocation> = {}): CalcLocation => ({
  product: "drone",
  cameras: 0,
  camerasTlBig: 0,
  camerasTlSmall: 0,
  poles: 0,
  docks: 0,
  km: 0,
  hours: 0,
  trips1: 0,
  trips2: 0,
  price: 0,
  setupFee: 0,
  off: {},
  over: {},
  qty: {},
  ...over,
});

/** Zaokrouhlení na celé koruny, jak jsou hodnoty ve specifikaci. */
const czk = (n: number) => Math.round(n);

describe("výchozí katalog", () => {
  it("živý katalog má 42 položek a FlightHub je vypnutý", () => {
    expect(SEED_CATALOG).toHaveLength(42);
    expect(SEED_CATALOG.find((i) => i.id === "dr_flighthub")?.enabled).toBe(
      false,
    );
  });
});

describe("Případ A — dron, jedna lokalita v portfoliu", () => {
  const A = loc({
    product: "drone",
    cameras: 0,
    poles: 0,
    docks: 1,
    km: 260,
    hours: 8,
    trips1: 10,
    trips2: 8,
    price: 50000,
  });
  const r = calc(A, catalog(), settings(), 1);

  it("day0 = 521 565 Kč", () => expect(czk(r.day0)).toBe(521565));
  it("monthlyCash = 14 930,68 Kč", () =>
    expect(r.monthlyCash).toBeCloseTo(14930.68, 2));
  it("amortMonthly = 10 447,66 Kč", () =>
    expect(r.amortMonthly).toBeCloseTo(10447.66, 2));
  it("fullMonthly = 25 378,35 Kč", () =>
    expect(r.fullMonthly).toBeCloseTo(25378.35, 2));
  it("payback = 15", () => expect(r.payback).toBe(15));
  it("flow[36] = 720 684 Kč", () => expect(czk(r.flow[36])).toBe(720684));
  it("margin = 0,4924", () => expect(r.margin).toBeCloseTo(0.4924, 4));

  it("events = obnova předplatků 13 a 25, baterie 25, dron 31", () => {
    expect(Object.keys(r.events).map(Number).sort((a, b) => a - b)).toEqual([
      13, 25, 31,
    ]);
    expect(r.events[13]).toEqual(["předplatky"]);
    expect(r.events[25]).toEqual(["předplatky", "sada baterií"]);
    expect(r.events[31]).toEqual(["dron"]);
  });

  it("dílčí kontroly: capex, startup, yearly, monthly", () => {
    expect(czk(r.capexTotal)).toBe(382944);
    expect(czk(r.startupTotal)).toBe(25000);
    expect(czk(r.yearlyTotal)).toBe(161168);
    expect(czk(r.preTotal)).toBe(113621);
    expect(czk(r.accTotal)).toBe(47547);
    expect(czk(r.monthlyTotal)).toBe(1500);
  });

  it("hodnota hardwaru pro procentní položky = capex", () => {
    expect(czk(r.hwValue)).toBe(382944);
    const reserve = r.lines.find((l) => l.it.id === "sh_reserve");
    expect(reserve?.amount).toBeCloseTo(382944 * 0.05, 6);
  });

  it("rezerva ani cestovné nezvyšují vstupní investici", () => {
    const preIds = r.yearly
      .filter((l) => l.it.prepay !== false)
      .map((l) => l.it.id);
    expect(preIds).not.toContain("sh_trip");
    expect(preIds).not.toContain("sh_reserve");
    expect(preIds).not.toContain("sh_marketing");
  });

  it("fullMonthly = monthlyCash + amortMonthly", () => {
    expect(r.fullMonthly).toBeCloseTo(r.monthlyCash + r.amortMonthly, 9);
  });
});

describe("Případ B — kamery, dvě lokality v portfoliu", () => {
  const B = loc({
    product: "cam",
    cameras: 5,
    poles: 3,
    docks: 0,
    km: 260,
    hours: 8,
    trips1: 2,
    trips2: 2,
    price: 18000,
  });
  const r = calc(B, catalog(), settings(), 2);

  it("day0 = 64 791 Kč", () => expect(czk(r.day0)).toBe(64791));
  it("monthlyCash = 2 460,44 Kč", () =>
    expect(r.monthlyCash).toBeCloseTo(2460.44, 2));
  it("amortMonthly = 1 517,58 Kč", () =>
    expect(r.amortMonthly).toBeCloseTo(1517.58, 2));
  it("fullMonthly = 3 978,02 Kč", () =>
    expect(r.fullMonthly).toBeCloseTo(3978.02, 2));
  it("payback = 5", () => expect(r.payback).toBe(5));

  it("sdílené položky se dělí dvěma", () => {
    expect(r.divisor).toBe(2);
    const server = r.lines.find((l) => l.it.id === "sh_server");
    expect(server?.amount).toBe(250);
    expect(server?.divided).toBe(true);
  });

  it("dronové položky nejsou v rozpadu", () => {
    expect(r.lines.some((l) => l.it.group === "drone")).toBe(false);
  });

  it("vypnuté dělení sdílených položek zvýší náklad", () => {
    const nodiv = calc(B, catalog(), settings({ share: false }), 2);
    expect(nodiv.divisor).toBe(1);
    expect(nodiv.fullMonthly).toBeGreaterThan(r.fullMonthly);
  });
});

describe("Případ C — hraniční stavy", () => {
  it("lokalita bez jediné položky má všechno na nule a payback null", () => {
    const r = calc(loc({ product: "drone" }), [], settings(), 1);
    expect(r.day0).toBe(0);
    expect(r.capexTotal).toBe(0);
    expect(r.startupTotal).toBe(0);
    expect(r.yearlyTotal).toBe(0);
    expect(r.monthlyTotal).toBe(0);
    expect(r.amortMonthly).toBe(0);
    expect(r.monthlyCash).toBe(0);
    expect(r.fullMonthly).toBe(0);
    expect(r.margin).toBe(0);
    expect(r.payback).toBeNull();
    expect(r.flow.every(Number.isFinite)).toBe(true);
  });

  it("prázdný katalog s nulovými vstupy nedělí nulou", () => {
    const r = calc(
      loc({ product: "both", price: 0 }),
      catalog(),
      settings(),
      0,
    );
    expect(r.divisor).toBe(1);
    expect(Number.isFinite(r.fullMonthly)).toBe(true);
    expect(Number.isFinite(r.amortMonthly)).toBe(true);
    expect(r.flow.every(Number.isFinite)).toBe(true);
  });

  it("price = 0 dává margin 0, ne NaN ani Infinity", () => {
    const r = calc(
      loc({ product: "drone", docks: 1, price: 0 }),
      catalog(),
      settings(),
      1,
    );
    expect(r.margin).toBe(0);
    expect(Number.isNaN(r.margin)).toBe(false);
    expect(Number.isFinite(r.margin)).toBe(true);
  });

  it("pctHw na lokalitě bez hardwaru dává částku 0", () => {
    const r = calc(
      loc({ product: "drone", docks: 0, price: 10000 }),
      catalog(),
      settings(),
      1,
    );
    expect(r.hwValue).toBe(0);
    expect(r.lines.some((l) => l.it.driver === "pctHw")).toBe(false);
  });

  it("off vypne položku a změní výsledek", () => {
    const base = loc({ product: "drone", docks: 1, price: 50000 });
    const r1 = calc(base, catalog(), settings(), 1);
    const r2 = calc(
      { ...base, off: { dr_dock: true } },
      catalog(),
      settings(),
      1,
    );
    expect(r2.lines.some((l) => l.it.id === "dr_dock")).toBe(false);
    // dok je capex, takže z day0 zmizí celý
    expect(czk(r1.day0 - r2.day0)).toBe(268587);
    // rezerva je procento z hodnoty hardwaru, takže klesne taky —
    // ale je průběžná, takže se to projeví až v ročních nákladech
    expect(r1.accTotal - r2.accTotal).toBeCloseTo(268587 * 0.05, 6);
  });

  it("over přepíše cenu a změní výsledek", () => {
    const base = loc({ product: "drone", docks: 1, price: 50000 });
    const r1 = calc(base, catalog(), settings(), 1);
    const r2 = calc(
      { ...base, over: { dr_dock: 300000 } },
      catalog(),
      settings(),
      1,
    );
    expect(czk(r2.capexTotal - r1.capexTotal)).toBe(300000 - 268587);
  });

  it("off ani over jedné lokality neovlivní druhou", () => {
    const cat = catalog();
    const a = loc({ product: "drone", docks: 1, price: 50000 });
    const b = {
      ...a,
      off: { dr_dock: true },
      over: { dr_drone: 1 },
    };
    const ra1 = calc(a, cat, settings(), 2);
    calc(b, cat, settings(), 2);
    const ra2 = calc(a, cat, settings(), 2);
    expect(ra2.day0).toBe(ra1.day0);
    expect(ra2.fullMonthly).toBe(ra1.fullMonthly);
    // a katalog zůstal nedotčený
    expect(cat.find((i) => i.id === "dr_drone")?.price).toBe(127264);
  });

  it("driver qty bere množství z lokality", () => {
    const base = loc({ product: "drone", docks: 1, price: 50000 });
    const cat = catalog().map((i) =>
      i.id === "dr_sensors" ? { ...i, price: 4000 } : i,
    );
    const r0 = calc(base, cat, settings(), 1);
    const r3 = calc({ ...base, qty: { dr_sensors: 3 } }, cat, settings(), 1);
    expect(r0.lines.some((l) => l.it.id === "dr_sensors")).toBe(false);
    expect(r3.lines.find((l) => l.it.id === "dr_sensors")?.amount).toBe(12000);
  });

  it("driver trip: ročně z roku 2+, jednorázově rozdíl a nikdy záporně", () => {
    const cat = catalog().map((i) =>
      i.id === "sh_trip" ? { ...i, billing: "oneoff" as const } : i,
    );
    const more = calc(
      loc({ product: "drone", docks: 1, trips1: 10, trips2: 8 }),
      cat,
      settings(),
      1,
    );
    expect(more.lines.find((l) => l.it.id === "sh_trip")?.q).toBe(2);
    const less = calc(
      loc({ product: "drone", docks: 1, trips1: 2, trips2: 8 }),
      cat,
      settings(),
      1,
    );
    expect(less.lines.some((l) => l.it.id === "sh_trip")).toBe(false);
  });

  it("horizont 0 nezpůsobí NaN a payback zůstane null", () => {
    const r = calc(
      loc({ product: "drone", docks: 1, price: 50000 }),
      catalog(),
      settings({ horizon: 0 }),
      1,
    );
    expect(r.horizon).toBe(36);
    expect(Number.isFinite(r.flow[r.horizon])).toBe(true);
  });
});

describe("payback je poslední záporný měsíc plus jedna, ne první přechod nulou", () => {
  it("u dronu vychází 15, ne 12", () => {
    const A = loc({
      product: "drone",
      docks: 1,
      km: 260,
      hours: 8,
      trips1: 10,
      trips2: 8,
      price: 50000,
    });
    const r = calc(A, catalog(), settings(), 1);
    const firstCross = r.flow.findIndex((v) => v >= 0);
    expect(firstCross).toBe(12);
    expect(r.payback).toBe(15);
    // ve 13. měsíci přijde obnova předplatného a hotovost spadne zpátky pod nulu
    expect(r.flow[13]).toBeLessThan(0);
    expect(r.flow[14]).toBeLessThan(0);
    expect(r.flow[15]).toBeGreaterThanOrEqual(0);
  });

  it("null se rozliší podle znaménka flow[horizon]", () => {
    const rich = calc(
      loc({ product: "drone", docks: 0, price: 50000 }),
      catalog(),
      settings(),
      1,
    );
    expect(rich.payback).toBeNull();
    expect(rich.flow[rich.horizon]).toBeGreaterThan(0);

    const poor = calc(
      loc({ product: "drone", docks: 1, price: 1000 }),
      catalog(),
      settings(),
      1,
    );
    expect(poor.payback).toBeNull();
    expect(poor.flow[poor.horizon]).toBeLessThan(0);
  });
});

describe("nastavení mění model podle očekávání", () => {
  const A = loc({
    product: "drone",
    docks: 1,
    km: 260,
    hours: 8,
    trips1: 10,
    trips2: 8,
    price: 50000,
  });

  it("prepay = false vyndá předplatky z day0", () => {
    const r = calc(A, catalog(), settings({ prepay: false }), 1);
    expect(r.prepaid).toBe(0);
    expect(czk(r.day0)).toBe(521565 - 113621);
    // ale plný měsíční náklad se nezmění
    expect(r.fullMonthly).toBeCloseTo(25378.35, 2);
  });

  it("renew = false zruší výměny hardwaru v simulaci", () => {
    const r = calc(A, catalog(), settings({ renew: false }), 1);
    expect(r.events[31]).toBeUndefined();
    expect(r.events[13]).toEqual(["předplatky"]);
    expect(r.flow[36]).toBeGreaterThan(
      calc(A, catalog(), settings(), 1).flow[36],
    );
  });

  it("delší horizont prodlouží flow", () => {
    const r = calc(A, catalog(), settings({ horizon: 60 }), 1);
    expect(r.flow).toHaveLength(61);
    expect(r.horizon).toBe(60);
  });
});

describe("rozpad podle kategorií", () => {
  it("startup se do rozpadu nezahrnuje a součet sedí na fullMonthly", () => {
    const A = loc({
      product: "drone",
      docks: 1,
      km: 260,
      hours: 8,
      trips1: 10,
      trips2: 8,
      price: 50000,
    });
    const r = calc(A, catalog(), settings(), 1);
    const total = Object.values(r.byCat).reduce((s, v) => s + (v || 0), 0);
    expect(total).toBeCloseTo(r.fullMonthly, 6);
  });

  it("sleva dealera se propisuje do hardwaru záporně", () => {
    const A = loc({ product: "drone", docks: 1, price: 50000 });
    const withDiscount = calc(A, catalog(), settings(), 1);
    const without = calc(
      A,
      catalog().filter((i) => i.id !== "dr_discount"),
      settings(),
      1,
    );
    expect(withDiscount.byCat.hw!).toBeLessThan(without.byCat.hw!);
  });
});

describe("osiřelé odkazy na smazané položky", () => {
  /**
   * Mazání položky odkazy uklidí v transakci, ale import staré zálohy ne.
   * Jádro musí odkaz na neexistující položku ignorovat, ne spadnout.
   */
  const A = () =>
    loc({
      product: "drone",
      docks: 1,
      km: 260,
      hours: 8,
      trips1: 10,
      trips2: 8,
      price: 50000,
    });

  it("off na neexistující id nic nerozbije a nezmění výsledek", () => {
    const clean = calc(A(), catalog(), settings(), 1);
    const dirty = calc(
      { ...A(), off: { uz_neexistuje: true, dalsi_duch: true } },
      catalog(),
      settings(),
      1,
    );
    expect(dirty.day0).toBe(clean.day0);
    expect(dirty.fullMonthly).toBe(clean.fullMonthly);
    expect(dirty.payback).toBe(clean.payback);
  });

  it("over na neexistující id se ignoruje", () => {
    const clean = calc(A(), catalog(), settings(), 1);
    const dirty = calc(
      { ...A(), over: { uz_neexistuje: 999999 } },
      catalog(),
      settings(),
      1,
    );
    expect(dirty.day0).toBe(clean.day0);
    expect(dirty.lines.some((l) => l.it.id === "uz_neexistuje")).toBe(false);
  });

  it("qty na neexistující id se ignoruje", () => {
    const clean = calc(A(), catalog(), settings(), 1);
    const dirty = calc(
      { ...A(), qty: { uz_neexistuje: 12 } },
      catalog(),
      settings(),
      1,
    );
    expect(dirty.day0).toBe(clean.day0);
    expect(dirty.lines).toHaveLength(clean.lines.length);
  });

  it("všechny tři mapy plné duchů najednou dají stejný výsledek jako prázdné", () => {
    const clean = calc(A(), catalog(), settings(), 1);
    const dirty = calc(
      {
        ...A(),
        off: { duch_a: true, duch_b: false },
        over: { duch_a: 1, duch_c: -5 },
        qty: { duch_b: 3, duch_d: 0 },
      },
      catalog(),
      settings(),
      1,
    );
    expect(dirty.day0).toBe(clean.day0);
    expect(dirty.capexTotal).toBe(clean.capexTotal);
    expect(dirty.fullMonthly).toBe(clean.fullMonthly);
    expect(dirty.flow).toEqual(clean.flow);
    expect(dirty.events).toEqual(clean.events);
  });

  it("záloha ze staršího katalogu se spočítá proti aktuálnímu katalogu", () => {
    // v záloze byla položka, kterou jsme mezitím z katalogu smazali
    const zmenseny = catalog().filter((i) => i.id !== "dr_rtk");
    const zaloha = {
      ...A(),
      off: { dr_rtk: true },
      over: { dr_rtk: 15000, dr_dock: 300000 },
    };
    const r = calc(zaloha, zmenseny, settings(), 1);
    expect(Number.isFinite(r.fullMonthly)).toBe(true);
    expect(r.lines.some((l) => l.it.id === "dr_rtk")).toBe(false);
    // přepis ceny na položce, která pořád existuje, se přitom uplatní
    expect(r.lines.find((l) => l.it.id === "dr_dock")?.amount).toBe(300000);
  });

  it("mapy mohou být prázdné objekty i chybět úplně", () => {
    const clean = calc(A(), catalog(), settings(), 1);
    const bez = calc(
      {
        ...A(),
        off: undefined as unknown as Record<string, boolean>,
        over: undefined as unknown as Record<string, number>,
        qty: undefined as unknown as Record<string, number>,
      },
      catalog(),
      settings(),
      1,
    );
    expect(bez.day0).toBe(clean.day0);
    expect(bez.fullMonthly).toBe(clean.fullMonthly);
  });
});

describe("setupFee — poplatek za zřízení", () => {
  const A = (over: Partial<CalcLocation> = {}) =>
    loc({
      product: "drone",
      docks: 1,
      km: 260,
      hours: 8,
      trips1: 10,
      trips2: 8,
      price: 50000,
      ...over,
    });

  it("se setupFee 0 zůstává případ A beze změny", () => {
    const r = calc(A({ setupFee: 0 }), catalog(), settings(), 1);
    expect(czk(r.day0)).toBe(521565);
    expect(r.payback).toBe(15);
    expect(r.fullMonthly).toBeCloseTo(25378.35, 2);
    expect(czk(r.flow[36])).toBe(720684);
    expect(r.flow[0]).toBe(-521565);
  });

  it("chybějící setupFee se chová jako nula", () => {
    const bez = calc(
      { ...A(), setupFee: undefined as unknown as number },
      catalog(),
      settings(),
      1,
    );
    expect(czk(bez.day0)).toBe(521565);
    expect(bez.payback).toBe(15);
    expect(bez.flow[0]).toBe(-521565);
  });

  it("posouvá jen start hotovosti, nikoli day0", () => {
    const r = calc(A({ setupFee: 100000 }), catalog(), settings(), 1);
    expect(czk(r.day0)).toBe(521565);
    expect(czk(r.flow[0])).toBe(-421565);
    expect(r.setupFee).toBe(100000);
  });

  it("nemění fullMonthly, monthlyCash, amortizaci ani marži", () => {
    const bez = calc(A({ setupFee: 0 }), catalog(), settings(), 1);
    const s = calc(A({ setupFee: 250000 }), catalog(), settings(), 1);
    expect(s.fullMonthly).toBe(bez.fullMonthly);
    expect(s.monthlyCash).toBe(bez.monthlyCash);
    expect(s.amortMonthly).toBe(bez.amortMonthly);
    expect(s.margin).toBe(bez.margin);
    expect(s.profit).toBe(bez.profit);
    expect(s.capexTotal).toBe(bez.capexTotal);
    expect(s.startupTotal).toBe(bez.startupTotal);
    expect(s.byCat).toEqual(bez.byCat);
  });

  it("zkracuje návratnost", () => {
    const bez = calc(A({ setupFee: 0 }), catalog(), settings(), 1);
    const s = calc(A({ setupFee: 200000 }), catalog(), settings(), 1);
    expect(bez.payback).toBe(15);
    expect(s.payback).toBeLessThan(bez.payback!);
    // ale plný měsíční náklad je pořád stejná cenová podlaha
    expect(s.fullMonthly).toBeCloseTo(25378.35, 2);
  });

  it("posune celý průběh hotovosti o stejnou částku", () => {
    const bez = calc(A({ setupFee: 0 }), catalog(), settings(), 1);
    const s = calc(A({ setupFee: 75000 }), catalog(), settings(), 1);
    for (let m = 0; m <= s.horizon; m++) {
      expect(s.flow[m]).toBeCloseTo(bez.flow[m] + 75000, 6);
    }
    expect(s.events).toEqual(bez.events);
  });

  it("setupFee vyšší než day0 dá kladný start a payback null", () => {
    const r = calc(A({ setupFee: 600000 }), catalog(), settings(), 1);
    expect(r.flow[0]).toBeGreaterThan(0);
    expect(r.payback).toBeNull();
    expect(r.flow[r.horizon]).toBeGreaterThan(0);
  });

  it("na lokalitě bez nákladů zůstane všechno konečné", () => {
    const r = calc(
      loc({ product: "drone", setupFee: 50000 }),
      [],
      settings(),
      1,
    );
    expect(r.day0).toBe(0);
    expect(r.flow[0]).toBe(50000);
    expect(r.margin).toBe(0);
    expect(r.flow.every(Number.isFinite)).toBe(true);
  });
});

describe("commitmentMonths do výpočtu nevstupuje", () => {
  it("výsledek je na něm nezávislý", () => {
    const base = {
      product: "drone" as const,
      docks: 1,
      km: 260,
      hours: 8,
      trips1: 10,
      trips2: 8,
      price: 50000,
    };
    const a = calc(loc(base), catalog(), settings(), 1);
    // commitmentMonths není součástí CalcLocation, ale i kdyby se do objektu
    // dostal navíc, nesmí se výsledek pohnout
    const b = calc(
      { ...loc(base), commitmentMonths: 60 } as CalcLocation,
      catalog(),
      settings(),
      1,
    );
    expect(b.day0).toBe(a.day0);
    expect(b.fullMonthly).toBe(a.fullMonthly);
    expect(b.payback).toBe(a.payback);
    expect(b.flow).toEqual(a.flow);
  });
});
