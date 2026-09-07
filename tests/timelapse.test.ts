/**
 * Časosběrné kamery.
 *
 * `cameras` znamená nově POUZE bezpečnostní kamery. Tři položky, které mají
 * všechny typy kamer, přešly na driver `cameraAll`. Změna je zpětně
 * kompatibilní: dokud jsou obě časosběrná pole nula, `cameraAll` se rovná
 * `cameras` a kontrolní hodnoty ze SPEC §4 platí beze změny.
 */
import { describe, expect, it } from "vitest";
import { calc, qtyFor } from "../lib/calc";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";
import type { CalcLocation, CatalogItem, Settings } from "../lib/types";
import { specCatalog } from "./spec-catalog";

const catalog = (): CatalogItem[] => SEED_CATALOG.map((i) => ({ ...i }));
const settings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

const loc = (over: Partial<CalcLocation> = {}): CalcLocation => ({
  product: "cam",
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

const czk = (n: number) => Math.round(n);
const item = (id: string) => SEED_CATALOG.find((i) => i.id === id)!;

describe("katalog po změně driverů", () => {
  it("položky, které mají všechny typy kamer, jsou na cameraAll", () => {
    for (const id of ["cam_backplate", "cam_material", "cam_card"]) {
      expect(item(id).driver, id).toBe("cameraAll");
    }
  });

  it("mezikus a průchodka zůstávají jen u bezpečnostních kamer", () => {
    for (const id of ["cam_mezikus", "cam_pruchodka"]) {
      expect(item(id).driver, id).toBe("camera");
    }
  });

  it("kamera sama zůstává na driveru camera", () => {
    expect(item("cam_camera").driver).toBe("camera");
  });
});

describe("nové drivery počítají správné množství", () => {
  const l = loc({ cameras: 3, camerasTlBig: 2, camerasTlSmall: 1 });

  it("cameraAll je součet všech kamer", () => {
    expect(qtyFor({ ...item("cam_card") }, l)).toBe(6);
  });

  it("camera jsou jen bezpečnostní", () => {
    expect(qtyFor({ ...item("cam_mezikus") }, l)).toBe(3);
  });

  it("tlBig a tlSmall berou svůj typ", () => {
    expect(qtyFor({ ...item("cam_tl_big") }, l)).toBe(2);
    expect(qtyFor({ ...item("cam_tl_small") }, l)).toBe(1);
  });

  it("chybějící pole se chová jako nula", () => {
    const stary = {
      ...loc({ cameras: 4 }),
      camerasTlBig: undefined as unknown as number,
      camerasTlSmall: undefined as unknown as number,
    };
    expect(qtyFor({ ...item("cam_card") }, stary)).toBe(4);
    expect(qtyFor({ ...item("cam_tl_big") }, stary)).toBe(0);
  });
});

describe("zpětná kompatibilita — kontrolní hodnoty drží", () => {
  it("případ A: day0 521 565 a payback 15 (proti zafixovanému katalogu)", () => {
    const A = loc({
      product: "drone",
      docks: 1,
      km: 260,
      hours: 8,
      trips1: 10,
      trips2: 8,
      price: 50000,
    });
    const r = calc(A, specCatalog(), settings(), 1);
    expect(czk(r.day0)).toBe(521565);
    expect(r.payback).toBe(15);
    expect(r.fullMonthly).toBeCloseTo(25378.35, 2);
    expect(czk(r.flow[36])).toBe(720684);
  });

  it("případ B: day0 64 791 (proti zafixovanému katalogu ze SPEC §4)", () => {
    const B = loc({
      product: "cam",
      cameras: 5,
      poles: 3,
      km: 260,
      hours: 8,
      trips1: 2,
      trips2: 2,
      price: 18000,
    });
    const r = calc(B, specCatalog(), settings(), 2);
    expect(czk(r.day0)).toBe(64791);
    expect(r.monthlyCash).toBeCloseTo(2460.44, 2);
    expect(r.amortMonthly).toBeCloseTo(1517.58, 2);
    expect(r.fullMonthly).toBeCloseTo(3978.02, 2);
    expect(r.payback).toBe(5);
  });

  it("položky s ručním množstvím při nulových vstupech nic nepřidají", () => {
    const B = loc({ product: "cam", cameras: 5, poles: 3, km: 260, hours: 8 });
    const r = calc(B, catalog(), settings(), 2);
    // modem je driver site, ten se počítá vždy — proto tu není
    for (const id of [
      "cam_tl_big",
      "cam_tl_small",
      "cam_solar",
      "cam_sim_tmobile",
    ]) {
      expect(r.lines.some((l) => l.it.id === id), id).toBe(false);
    }
  });
});

describe("kontrolní hodnoty drží i s nenulovými časosběrnými vedle sebe", () => {
  /**
   * Tohle je jádro zpětné kompatibility: dvě lokality se stejným počtem
   * bezpečnostních kamer, jedna s časosběrnými a jedna bez. Rozdíl mezi nimi
   * musí být přesně to, co časosběrné kamery přidávají, a nic víc.
   */
  const zaklad = {
    product: "cam" as const,
    cameras: 5,
    poles: 3,
    km: 260,
    hours: 8,
    trips1: 2,
    trips2: 2,
    price: 18000,
  };

  it("lokalita bez časosběrných dál dává 64 791 i vedle lokality s nimi", () => {
    const bez = loc(zaklad);
    const s = loc({ ...zaklad, camerasTlBig: 2, camerasTlSmall: 3 });
    const cat = specCatalog();

    const rBez = calc(bez, cat, settings(), 2);
    const rS = calc(s, cat, settings(), 2);
    // druhý výpočet nesmí prvním hnout
    const rBezZnovu = calc(bez, cat, settings(), 2);

    expect(czk(rBezZnovu.day0)).toBe(czk(rBez.day0));
    expect(rBezZnovu.fullMonthly).toBe(rBez.fullMonthly);
    expect(rS.day0).toBeGreaterThan(rBez.day0);
  });

  it("rozdíl v day0 je přesně cena časosběrných kamer a jejich příslušenství", () => {
    const bez = calc(loc(zaklad), catalog(), settings(), 2);
    const s = calc(
      loc({ ...zaklad, camerasTlBig: 2, camerasTlSmall: 3 }),
      catalog(),
      settings(),
      2,
    );
    const ocekavano =
      2 * 40000 + // velké časosběrné
      3 * 20000 + // malé časosběrné
      5 * item("cam_backplate").price +
      5 * item("cam_material").price +
      5 * item("cam_card").price;
    expect(czk(s.day0 - bez.day0)).toBe(czk(ocekavano));
  });

  it("časosběrné kamery nedostanou mezikus ani průchodku", () => {
    const jenTl = calc(
      loc({ product: "cam", camerasTlSmall: 4, poles: 1 }),
      catalog(),
      settings(),
      1,
    );
    expect(jenTl.lines.some((l) => l.it.id === "cam_mezikus")).toBe(false);
    expect(jenTl.lines.some((l) => l.it.id === "cam_pruchodka")).toBe(false);
    // ale backplate, materiál a kartu mají
    for (const id of ["cam_backplate", "cam_material", "cam_card"]) {
      const line = jenTl.lines.find((l) => l.it.id === id);
      expect(line, id).toBeDefined();
      expect(line!.q).toBe(4);
    }
  });

  it("paměťová karta je povinná u všech kamer dohromady", () => {
    const r = calc(
      loc({ product: "cam", cameras: 2, camerasTlBig: 1, camerasTlSmall: 3 }),
      catalog(),
      settings(),
      1,
    );
    const karta = r.lines.find((l) => l.it.id === "cam_card")!;
    expect(karta.q).toBe(6);
    expect(karta.amount).toBe(6 * 1500);
  });
});

describe("nové položky katalogu", () => {
  it("mají očekávané parametry", () => {
    expect(item("cam_tl_big")).toMatchObject({
      price: 40000,
      life: 30,
      billing: "oneoff",
      driver: "tlBig",
      group: "cam",
    });
    expect(item("cam_tl_small")).toMatchObject({
      price: 20000,
      life: 30,
      billing: "oneoff",
      driver: "tlSmall",
    });
    expect(item("cam_solar")).toMatchObject({
      price: 500,
      life: 30,
      billing: "oneoff",
      driver: "qty",
    });
    expect(item("cam_sim_tmobile")).toMatchObject({
      price: 500,
      life: null,
      billing: "monthly",
      driver: "qty",
    });
    expect(item("cam_modem")).toMatchObject({
      price: 2500,
      life: 24,
      billing: "oneoff",
      driver: "site",
    });
  });

  it("katalog má 42 položek", () => {
    expect(SEED_CATALOG).toHaveLength(42);
  });

  it("modem s nulovou cenou se do rozpadu nedostane", () => {
    const cat = catalog().map((i) =>
      i.id === "cam_modem" ? { ...i, price: 0 } : i,
    );
    const r = calc(loc({ product: "cam", cameras: 3 }), cat, settings(), 1);
    expect(r.lines.some((l) => l.it.id === "cam_modem")).toBe(false);
  });

  it("modem se započítá jednou za lokalitu", () => {
    const cat = catalog();
    const r = calc(loc({ product: "cam", cameras: 3 }), cat, settings(), 1);
    const modem = r.lines.find((l) => l.it.id === "cam_modem")!;
    expect(modem.q).toBe(1);
    expect(modem.amount).toBe(2500);
  });

  it("solární panel a SIM se řídí ručním množstvím", () => {
    const r = calc(
      loc({
        product: "cam",
        camerasTlSmall: 2,
        qty: { cam_solar: 2, cam_sim_tmobile: 2 },
      }),
      catalog(),
      settings(),
      1,
    );
    expect(r.lines.find((l) => l.it.id === "cam_solar")!.amount).toBe(1000);
    expect(r.lines.find((l) => l.it.id === "cam_sim_tmobile")!.amount).toBe(
      1000,
    );
  });
});
