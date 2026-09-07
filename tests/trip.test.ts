/**
 * Výjezd rozdělený na práci a dopravu.
 *
 * Plochých 3 300 Kč za výjezd na vzdálenosti nezáviselo, což u lokality
 * dvě stě kilometrů daleko podhodnocovalo náklad o víc než polovinu.
 * Práce je fixní, doprava se počítá z kilometrů tam i zpět.
 */
import { describe, expect, it } from "vitest";
import { calc, qtyFor } from "../lib/calc";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";
import type { CalcLocation, CatalogItem, Settings } from "../lib/types";
import { specCatalog } from "./spec-catalog";

const catalog = (): CatalogItem[] => SEED_CATALOG.map((i) => ({ ...i }));
const settings = (o: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...o,
});
const loc = (o: Partial<CalcLocation> = {}): CalcLocation => ({
  product: "cam", cameras: 0, camerasTlBig: 0, camerasTlSmall: 0, poles: 0,
  docks: 0, km: 0, hours: 0, trips1: 0, trips2: 0, price: 0, setupFee: 0,
  off: {}, over: {}, qty: {}, ...o,
});
const item = (id: string) => SEED_CATALOG.find((i) => i.id === id)!;

/** Roční náklad výjezdů — práce i doprava dohromady. */
const vyjezdyRocne = (l: CalcLocation, cat = catalog()) =>
  calc(l, cat, settings(), 1)
    .lines.filter((x) => ["sh_trip_work", "sh_trip_km"].includes(x.it.id))
    .reduce((s, x) => s + x.amount, 0);

describe("položky v katalogu", () => {
  it("práce na výjezdu je fixní za výjezd", () => {
    expect(item("sh_trip_work")).toMatchObject({
      label: "Práce na výjezdu", group: "shared", cat: "lab",
      price: 2400, billing: "yearly", driver: "trip", prepay: false,
    });
  });

  it("doprava na výjezd se počítá z kilometrů", () => {
    expect(item("sh_trip_km")).toMatchObject({
      label: "Doprava na výjezd", group: "shared", cat: "lab",
      price: 10.33, billing: "yearly", driver: "tripKm", prepay: false,
    });
  });

  it("stará plochá položka už neexistuje", () => {
    expect(SEED_CATALOG.some((i) => i.id === "sh_trip")).toBe(false);
  });

  it("katalog obsahuje přesně tyhle položky a nic navíc", () => {
    // Úplný výčet je záměr: chytí nejen chybějící položku, ale i takovou,
    // která se do ceníku vrátí, aniž by o tom někdo rozhodl.
    expect(SEED_CATALOG.map((i) => i.id).sort()).toEqual([
      "cam_backplate", "cam_box", "cam_camera", "cam_card", "cam_install_hr",
      "cam_install_km", "cam_material", "cam_mezikus", "cam_modem", "cam_pole",
      "cam_pruchodka", "cam_sim_tmobile", "cam_socket", "cam_solar",
      "cam_starlink", "cam_switch", "cam_tl_big", "cam_tl_small",
      "dr_battery", "dr_care", "dr_discount", "dr_dock", "dr_dongle",
      "dr_drone", "dr_flighthub", "dr_flytbase", "dr_infra", "dr_install",
      "dr_insurance", "dr_rotors", "dr_rtk", "dr_sensors", "dr_service",
      "dr_setup", "dr_sim", "sh_hub", "sh_marketing", "sh_reserve",
      "sh_server", "sh_storage", "sh_trip_km", "sh_trip_work",
    ]);
  });
});

describe("driver tripKm zrcadlí driver trip", () => {
  const l = loc({ km: 260, trips1: 10, trips2: 8 });

  it("ročně bere výjezdy roku 2+ krát kilometry", () => {
    expect(qtyFor(item("sh_trip_km"), l)).toBe(8 * 260);
    expect(qtyFor(item("sh_trip_work"), l)).toBe(8);
  });

  it("jednorázově bere rozdíl prvního roku krát kilometry", () => {
    const jednorazovy = { ...item("sh_trip_km"), billing: "oneoff" as const };
    const prace = { ...item("sh_trip_work"), billing: "oneoff" as const };
    expect(qtyFor(jednorazovy, l)).toBe((10 - 8) * 260);
    expect(qtyFor(prace, l)).toBe(10 - 8);
  });

  it("nikdy nejde do záporu", () => {
    const m = loc({ km: 260, trips1: 2, trips2: 8 });
    const jednorazovy = { ...item("sh_trip_km"), billing: "oneoff" as const };
    expect(qtyFor(jednorazovy, m)).toBe(0);
  });

  it("nulové kilometry znamenají nulovou dopravu", () => {
    expect(qtyFor(item("sh_trip_km"), loc({ km: 0, trips2: 8 }))).toBe(0);
  });

  it("chybějící pole se chovají jako nula", () => {
    const prazdna = {
      ...loc(),
      km: undefined as unknown as number,
      trips2: undefined as unknown as number,
    };
    expect(qtyFor(item("sh_trip_km"), prazdna)).toBe(0);
  });
});

describe("kontrolní součet ze zadání", () => {
  it("8 výjezdů a 260 km dělá 40 686,40 Kč ročně", () => {
    const l = loc({ km: 260, trips1: 8, trips2: 8 });
    expect(vyjezdyRocne(l)).toBeCloseTo(40686.4, 6);
  });

  it("jeden výjezd na 260 km stojí 5 085,80 Kč", () => {
    const l = loc({ km: 260, trips1: 1, trips2: 1 });
    expect(vyjezdyRocne(l)).toBeCloseTo(5085.8, 6);
    expect(2400 + 260 * 10.33).toBeCloseTo(5085.8, 6);
  });

  it("rozpad na práci a dopravu sedí zvlášť", () => {
    const l = loc({ km: 260, trips2: 8 });
    const r = calc(l, catalog(), settings(), 1);
    expect(r.lines.find((x) => x.it.id === "sh_trip_work")!.amount).toBe(
      8 * 2400,
    );
    expect(
      r.lines.find((x) => x.it.id === "sh_trip_km")!.amount,
    ).toBeCloseTo(8 * 260 * 10.33, 6);
  });
});

describe("škálování s kilometry", () => {
  it("dvojnásobná vzdálenost zdvojnásobí dopravu a nechá práci", () => {
    const blizko = calc(loc({ km: 130, trips2: 8 }), catalog(), settings(), 1);
    const daleko = calc(loc({ km: 260, trips2: 8 }), catalog(), settings(), 1);

    const prace = (r: typeof blizko) =>
      r.lines.find((x) => x.it.id === "sh_trip_work")!.amount;
    const doprava = (r: typeof blizko) =>
      r.lines.find((x) => x.it.id === "sh_trip_km")!.amount;

    expect(prace(daleko)).toBe(prace(blizko));
    expect(doprava(daleko)).toBeCloseTo(doprava(blizko) * 2, 6);
  });

  it("víc výjezdů zvýší obě složky stejným poměrem", () => {
    const malo = calc(loc({ km: 260, trips2: 4 }), catalog(), settings(), 1);
    const hodne = calc(loc({ km: 260, trips2: 12 }), catalog(), settings(), 1);
    const soucet = (r: typeof malo) =>
      r.lines
        .filter((x) => ["sh_trip_work", "sh_trip_km"].includes(x.it.id))
        .reduce((s, x) => s + x.amount, 0);
    expect(soucet(hodne)).toBeCloseTo(soucet(malo) * 3, 6);
  });

  it("vzdálená lokalita stojí víc než blízká se stejným počtem výjezdů", () => {
    const blizko = calc(
      loc({ km: 20, trips2: 12, cameras: 3 }), catalog(), settings(), 1);
    const daleko = calc(
      loc({ km: 300, trips2: 12, cameras: 3 }), catalog(), settings(), 1);
    expect(daleko.fullMonthly).toBeGreaterThan(blizko.fullMonthly);
    expect(daleko.fullMonthly - blizko.fullMonthly).toBeCloseTo(
      (12 * (300 - 20) * 10.33) / 12,
      4,
    );
  });
});

describe("kontrolní hodnoty ze SPEC §4", () => {
  const A = loc({
    product: "drone", docks: 1, km: 260, hours: 8,
    trips1: 10, trips2: 8, price: 50000,
  });
  const B = loc({
    product: "cam", cameras: 5, poles: 3, km: 260, hours: 8,
    trips1: 2, trips2: 2, price: 18000,
  });

  it("kotva drží obě beze změny", () => {
    const a = calc(A, specCatalog(), settings(), 1);
    expect(Math.round(a.day0)).toBe(521565);
    expect(a.fullMonthly).toBeCloseTo(25378.35, 2);
    expect(a.payback).toBe(15);
    const b = calc(B, specCatalog(), settings(), 2);
    expect(Math.round(b.day0)).toBe(64791);
    expect(b.fullMonthly).toBeCloseTo(3978.02, 2);
    expect(b.payback).toBe(5);
  });

  it("kotva má starou plochou položku výjezdu", () => {
    const stary = specCatalog().find((i) => i.id === "sh_trip")!;
    expect(stary.price).toBe(3300);
    expect(stary.driver).toBe("trip");
    expect(specCatalog().some((i) => i.id === "sh_trip_work")).toBe(false);
  });

  it("proti živému katalogu se případ A liší přesně o rozdíl ve výjezdech", () => {
    const kotva = calc(A, specCatalog(), settings(), 1);
    const dnes = calc(A, catalog(), settings(), 1);
    // dřív 8 × 3 300 = 26 400, teď 8 × (2 400 + 260 × 10,33) = 40 686,40
    const drive = 8 * 3300;
    const ted = 8 * (2400 + 260 * 10.33);
    expect(ted).toBeCloseTo(40686.4, 6);
    expect(dnes.fullMonthly - kotva.fullMonthly).toBeCloseTo(
      (ted - drive) / 12,
      6,
    );
    // výjezdy jsou průběžné, do jednorázové investice nevstupují
    expect(dnes.day0).toBeCloseTo(kotva.day0, 6);
  });

  it("proti živému katalogu se případ B liší o výjezdy, modem a rezervu", () => {
    const kotva = calc(B, specCatalog(), settings(), 2);
    const dnes = calc(B, catalog(), settings(), 2);
    const vyjezdy = (2 * (2400 + 260 * 10.33) - 2 * 3300) / 12;
    // kamerová lokalita má navíc modem, který v kotvě není
    const modem = 2500 / 24;
    // a rezerva roste s hodnotou hardwaru, tedy i s modemem
    const rezerva = (2500 * 0.05) / 12;
    expect(dnes.fullMonthly - kotva.fullMonthly).toBeCloseTo(
      vyjezdy + modem + rezerva,
      6,
    );
    expect(dnes.day0 - kotva.day0).toBeCloseTo(2500, 6);
  });
});

describe("lidský náklad je jen ve výjezdech", () => {
  it("v katalogu není žádná další mzdová položka za lokalitu", () => {
    const lab = SEED_CATALOG.filter((i) => i.cat === "lab");
    expect(lab.map((i) => i.id).sort()).toEqual([
      "cam_install_hr",
      "cam_install_km",
      "dr_install",
      "dr_setup",
      "sh_trip_km",
      "sh_trip_work",
    ]);
  });
});
