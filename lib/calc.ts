/**
 * Výpočetní jádro — SPEC.md §3.
 *
 * Čistá funkce bez závislostí. Nesmí sem přijít import databáze, Reactu ani
 * ničeho z `app/`. Port referenční implementace z `reference/prototyp.html`;
 * na stejném vstupu musí dávat stejné výsledky do koruny (viz tests/calc.test.ts).
 */

import type {
  CalcLocation,
  Cat,
  CatalogItem,
  Settings,
} from "./types";

/** Jeden započítaný řádek rozpadu. */
export interface CalcLine {
  it: CatalogItem;
  /** Množství podle driveru. */
  q: number;
  /** Částka v Kč, u sdílených položek už podělená počtem lokalit. */
  amount: number;
  /** true, když se částka dělila mezi víc lokalit. */
  divided: boolean;
  /** Měsíční ekvivalent, jak vstupuje do agregátů. U ročních položek
   *  už zahrnuje průměrnou inflaci přes horizont. */
  monthly: number;
  /** true, když položka podléhá inflaci. */
  inflated: boolean;
}

export interface CalcResult {
  lines: CalcLine[];
  capex: CalcLine[];
  startup: CalcLine[];
  yearly: CalcLine[];
  monthly: CalcLine[];
  capexTotal: number;
  startupTotal: number;
  yearlyTotal: number;
  monthlyTotal: number;
  /** Roční položky placené dopředu. */
  preTotal: number;
  /** Roční položky vznikající průběžně (cesty, mzdy, rezerva, marketing). */
  accTotal: number;
  amortMonthly: number;
  monthlyCash: number;
  /** Cenová podlaha. */
  fullMonthly: number;
  day0: number;
  prepaid: number;
  /** Měsíční ekvivalent podle kategorie, pro barevný pruh. */
  byCat: Partial<Record<Cat, number>>;
  /** flow[0] = −day0 + setupFee, dál kumulativní hotovost po měsících. */
  flow: number[];
  /** Uplatněný poplatek za zřízení. Příjem, do nákladů nevstupuje. */
  setupFee: number;
  /** Měsíce, ve kterých nastala obnova, s popisem. */
  events: Record<number, string[]>;
  /** Totéž i s částkami, pro graf a kalendář obnov. */
  eventDetails: Record<number, { label: string; amount: number }[]>;
  payback: number | null;
  profit: number;
  margin: number;
  /** Hodnota hardwaru, ze které se počítají procentní položky. */
  hwValue: number;
  /**
   * Průměrný inflační faktor přes horizont. Při nulové sazbě přesně 1.
   * Do fullMonthly vstupuje průměr, ne hodnota prvního roku.
   */
  inflationFactor: number;
  divisor: number;
  horizon: number;
}

/** Životnost se počítá jen když je vyplněná a kladná. */
function hasLife(it: CatalogItem): boolean {
  return it.life != null && it.life > 0;
}

/**
 * Podléhá položka inflaci?
 *
 * Jen roční položky, a z nich ne ty s driverem pctHw — rezerva je procento
 * z hodnoty hardwaru, ne korunová částka. Kdyby inflatovala, rostla by
 * rychleji než majetek, ze kterého se počítá.
 */
function isInflated(it: CatalogItem): boolean {
  return it.billing === "yearly" && it.driver !== "pctHw";
}

/** Rok, do kterého měsíc spadá. Měsíce 1–12 jsou první rok. */
export function yearOf(month: number): number {
  return Math.ceil(month / 12);
}

/** Množství podle driveru — SPEC.md §2, tabulka driverů. */
export function qtyFor(item: CatalogItem, loc: CalcLocation): number {
  switch (item.driver) {
    case "site":
      return 1;
    case "camera":
      // Jen bezpečnostní kamery — mezikus a průchodka mají jen ty.
      return loc.cameras || 0;
    case "cameraAll":
      // Všechny kamery dohromady — backplate, instalační materiál
      // a paměťová karta jsou u každého typu.
      return (
        (loc.cameras || 0) +
        (loc.camerasTlBig || 0) +
        (loc.camerasTlSmall || 0)
      );
    case "tlBig":
      return loc.camerasTlBig || 0;
    case "tlSmall":
      return loc.camerasTlSmall || 0;
    case "pole":
      return loc.poles || 0;
    case "dock":
      return loc.docks || 0;
    case "km":
      return loc.km || 0;
    case "hour":
      return loc.hours || 0;
    case "trip":
      // Ročně podle výjezdů roku 2+, v roce 1 se jednorázově přidá rozdíl.
      return item.billing === "yearly"
        ? loc.trips2 || 0
        : Math.max(0, (loc.trips1 || 0) - (loc.trips2 || 0));
    case "tripKm":
      // Totéž, jen krát vzdálenost tam a zpět — doprava na výjezd roste
      // se vzdáleností, práce na místě ne.
      return (
        (item.billing === "yearly"
          ? loc.trips2 || 0
          : Math.max(0, (loc.trips1 || 0) - (loc.trips2 || 0))) * (loc.km || 0)
      );
    case "qty":
      return (loc.qty && loc.qty[item.id]) || 0;
    case "pctHw":
      return 1;
    default:
      return 1;
  }
}

/**
 * @param loc            vstupy lokality
 * @param catalog        celý katalog nákladových položek
 * @param settings       parametry modelu
 * @param locationCount  počet lokalit v portfoliu (dělitel sdílených položek)
 */
export function calc(
  loc: CalcLocation,
  catalog: CatalogItem[],
  settings: Settings,
  locationCount: number,
): CalcResult {
  const divisor = settings.share ? Math.max(1, locationCount) : 1;

  // §3.1 Výběr položek
  const inScope = (it: CatalogItem) =>
    it.enabled &&
    !(loc.off || {})[it.id] &&
    (it.group === "shared" ||
      loc.product === "both" ||
      it.group === loc.product);

  const items = catalog.filter(inScope);
  const priceOf = (it: CatalogItem) =>
    loc.over && loc.over[it.id] != null ? loc.over[it.id] : it.price;

  // §3.2 První průchod — bez procentních položek, ty potřebují hwValue.
  const lines: CalcLine[] = [];
  let hwValue = 0;
  for (const it of items) {
    if (it.driver === "pctHw") continue;
    const q = qtyFor(it, loc);
    if (!q) continue;
    let amount = priceOf(it) * q;
    if (it.shared) amount /= divisor;
    if (!amount) continue;
    lines.push({
      it,
      q,
      amount,
      divided: it.shared && divisor > 1,
      monthly: 0,
      inflated: isInflated(it),
    });
    if (it.billing === "oneoff" && hasLife(it)) hwValue += amount;
  }
  // Druhý průchod — procentní položky se do hwValue samy nezapočítávají.
  for (const it of items.filter((i) => i.driver === "pctHw")) {
    const amount = (hwValue * priceOf(it)) / 100;
    if (amount)
      lines.push({
        it,
        q: 1,
        amount,
        divided: false,
        monthly: 0,
        inflated: isInflated(it),
      });
  }

  // §3.3 Rozdělení do skupin
  const capex = lines.filter((l) => l.it.billing === "oneoff" && hasLife(l.it));
  const startup = lines.filter(
    (l) => l.it.billing === "oneoff" && !hasLife(l.it),
  );
  const yearly = lines.filter((l) => l.it.billing === "yearly");
  const monthly = lines.filter((l) => l.it.billing === "monthly");

  const sum = (a: CalcLine[]) => a.reduce((s, l) => s + l.amount, 0);
  const capexTotal = sum(capex);
  const startupTotal = sum(startup);
  const yearlyTotal = sum(yearly);
  const monthlyTotal = sum(monthly);

  // Předplatné vs. průběžně vznikající. Cestovné a mzdy nejsou předplatné
  // a nesmí zvyšovat vstupní investici.
  const yearlyPre = yearly.filter((l) => l.it.prepay !== false);
  const yearlyAcc = yearly.filter((l) => l.it.prepay === false);
  const preTotal = sum(yearlyPre);
  const accTotal = sum(yearlyAcc);

  // Inflace se týká jen ročních položek mimo pctHw, proto se každá roční
  // skupina rozpadá na inflatovanou a pevnou část.
  const horizon = settings.horizon || 36;
  const rate = (settings.inflation || 0) / 100;
  const factorAt = (m: number) => Math.pow(1 + rate, yearOf(m) - 1);

  let factorSum = 0;
  for (let m = 1; m <= horizon; m++) factorSum += factorAt(m);
  const inflationFactor = horizon > 0 ? factorSum / horizon : 1;

  const inflSum = (a: CalcLine[]) =>
    a.filter((l) => l.inflated).reduce((s, l) => s + l.amount, 0);
  const fixedSum = (a: CalcLine[]) =>
    a.filter((l) => !l.inflated).reduce((s, l) => s + l.amount, 0);

  const preInfl = inflSum(yearlyPre);
  const preFixed = fixedSum(yearlyPre);
  const accInfl = inflSum(yearlyAcc);
  const accFixed = fixedSum(yearlyAcc);
  const yearlyInfl = inflSum(yearly);
  const yearlyFixed = fixedSum(yearly);

  // §3.4 Agregáty
  const amortMonthly = capex.reduce((s, l) => s + l.amount / l.it.life!, 0);
  // Do měsíčního nákladu jde průměr přes horizont, ne hodnota prvního roku.
  const monthlyCash =
    monthlyTotal + (yearlyInfl * inflationFactor + yearlyFixed) / 12;
  const fullMonthly = monthlyCash + amortMonthly;

  // Měsíční ekvivalent každého řádku, ať se rozpad sečte na fullMonthly.
  for (const l of lines) {
    if (l.it.billing === "oneoff") {
      l.monthly = hasLife(l.it) ? l.amount / l.it.life! : 0;
    } else if (l.it.billing === "yearly") {
      l.monthly = (l.amount * (l.inflated ? inflationFactor : 1)) / 12;
    } else {
      l.monthly = l.amount;
    }
  }
  const prepaid = settings.prepay ? preTotal : 0;
  const day0 = capexTotal + startupTotal + prepaid;

  // §3.5 Rozpad podle kategorií. Startup se do rozpadu nezahrnuje.
  const byCat: Partial<Record<Cat, number>> = {};
  const add = (c: Cat, v: number) => {
    byCat[c] = (byCat[c] || 0) + v;
  };
  capex.forEach((l) => add(l.it.cat, l.monthly));
  yearly.forEach((l) => add(l.it.cat, l.monthly));
  monthly.forEach((l) => add(l.it.cat, l.monthly));

  // §3.6 Simulace hotovosti
  const flow: number[] = [];
  const events: Record<number, string[]> = {};
  const eventDetails: Record<number, { label: string; amount: number }[]> = {};
  // Poplatek za zřízení je příjem — snižuje jen to, co je v měsíci 0 v minusu.
  const setupFee = loc.setupFee || 0;
  let cum = -day0 + setupFee;
  flow.push(cum);
  for (let m = 1; m <= horizon; m++) {
    const f = factorAt(m);
    // Roční položky se v každém roce prodraží, měsíční ne.
    let out =
      monthlyTotal +
      (accInfl * f + accFixed) / 12 +
      (prepaid ? 0 : (preInfl * f + preFixed) / 12);
    const ev: string[] = [];
    const evd: { label: string; amount: number }[] = [];
    if (prepaid && m > 1 && (m - 1) % 12 === 0) {
      const castka = preInfl * f + preFixed;
      out += castka;
      ev.push("předplatky");
      evd.push({ label: "předplatky", amount: castka });
    }
    if (settings.renew) {
      for (const l of capex) {
        const L = l.it.life!;
        if (L < horizon && m > L && (m - 1) % L === 0) {
          out += l.amount;
          ev.push(l.it.label.toLowerCase());
          evd.push({ label: l.it.label.toLowerCase(), amount: l.amount });
        }
      }
    }
    if (ev.length) {
      events[m] = ev;
      eventDetails[m] = evd;
    }
    cum += (loc.price || 0) - out;
    flow.push(cum);
  }

  // §3.7 Návratnost — poslední měsíc se zápornou hotovostí plus jedna.
  const neg = flow.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
  const payback =
    neg.length && Math.max(...neg) < horizon ? Math.max(...neg) + 1 : null;

  // §3.8 Marže
  const profit = (loc.price || 0) - fullMonthly;
  const margin = loc.price > 0 ? profit / loc.price : 0;

  return {
    lines,
    capex,
    startup,
    yearly,
    monthly,
    capexTotal,
    startupTotal,
    yearlyTotal,
    monthlyTotal,
    preTotal,
    accTotal,
    amortMonthly,
    monthlyCash,
    fullMonthly,
    day0,
    prepaid,
    byCat,
    flow,
    setupFee,
    events,
    eventDetails,
    payback,
    profit,
    margin,
    hwValue,
    inflationFactor,
    divisor,
    horizon,
  };
}

/** Měsíční ekvivalent jednoho řádku, jak se zobrazuje v rozpadu. */
export function monthlyEquivalent(l: CalcLine): number {
  return l.monthly;
}
