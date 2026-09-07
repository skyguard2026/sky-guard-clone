/** Číselníky a popisky. Hardware se pojmenovává obecně, bez značek výrobce. */
import type { Billing, Cat, Driver, Group, Product } from "./types";

export const CAT: Record<Cat, { n: string; c: string }> = {
  hw: { n: "Hardware", c: "var(--blue)" },
  sw: { n: "Software a platforma", c: "var(--violet)" },
  net: { n: "Konektivita", c: "var(--green)" },
  ops: { n: "Servis a pojištění", c: "var(--amber)" },
  lab: { n: "Práce a cesty", c: "var(--pink)" },
};

export const GROUP: Record<Group, string> = {
  cam: "Sky Cam",
  drone: "Sky Guard",
  shared: "Společné",
};

export const BILL: Record<Billing, string> = {
  oneoff: "Jednorázově",
  monthly: "Měsíčně",
  yearly: "Ročně",
};

export const PRODUCT: Record<Product, string> = {
  cam: "Sky Cam",
  drone: "Sky Guard",
  both: "Kombinace",
};

export const DRIVER: Record<Driver, { n: string; h: string }> = {
  site: {
    n: "Za lokalitu",
    h: "Účtuje se jednou bez ohledu na počet zařízení.",
  },
  camera: {
    n: "Za bezpečnostní kameru",
    h: "Násobí se počtem bezpečnostních kamer. Časosběrné nezahrnuje.",
  },
  cameraAll: {
    n: "Za kameru celkem",
    h: "Násobí se součtem všech kamer — bezpečnostních i časosběrných.",
  },
  tlBig: {
    n: "Za velkou časosběrnou",
    h: "Násobí se počtem velkých časosběrných kamer.",
  },
  tlSmall: {
    n: "Za malou časosběrnou",
    h: "Násobí se počtem malých časosběrných kamer.",
  },
  pole: { n: "Za sloup", h: "Násobí se počtem sloupů." },
  dock: { n: "Za dokovací stanici", h: "Násobí se počtem stanic." },
  km: { n: "Za kilometr", h: "Násobí se vzdáleností na lokalitu." },
  hour: { n: "Za hodinu práce", h: "Násobí se hodinami instalace." },
  trip: {
    n: "Za výjezd",
    h: "Ročně podle výjezdů roku 2+, v roce 1 se přidá rozdíl.",
  },
  tripKm: {
    n: "Za kilometr na výjezdech",
    h: "Jako driver za výjezd, ale navíc se násobí vzdáleností tam a zpět.",
  },
  pctHw: {
    n: "% z hodnoty HW",
    h: "Cena se zadává v procentech, ne v korunách.",
  },
  qty: {
    n: "Ruční množství",
    h: "Množství se zadává u každé lokality zvlášť.",
  },
};

export const PREPAY_HINT =
  "Zapnuto: platí se dopředu na celý rok a zvyšuje vstupní investici. " +
  "Vypnuto: vzniká průběžně během roku — tak se chová cestovné, mzdy, rezerva a marketing.";
