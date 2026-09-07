/**
 * Ekonomika kontraktu podle jeho délky.
 *
 * Pozor na rozdíl mezi lokálním a globálním optimem. Vstupní investice se
 * rozpouští do počtu měsíců, takže delší kontrakt vyhrává skoro vždycky
 * a globální maximum je vždy nejdelší uvažovaná délka. Užitečná jsou lokální
 * optima — leží vždy měsíc před velkou obnovou, tedy tam, kde jsi ještě
 * nezaplatil výměnu, ze které bys nic nevytěžil.
 */
import { calc, type CalcResult } from "./calc";
import { residualValue } from "./residual";
import type { CalcLocation, CatalogItem, Settings } from "./types";

export const MIN_MONTHS = 24;
export const MAX_MONTHS = 72;
/** Nad tuhle délku už se s klientem reálně nevyjednává. */
export const RECOMMEND_CEILING = 48;

export interface ContractRow {
  months: number;
  /** Kumulativní hotovost na konci kontraktu. */
  cash: number;
  residual: number;
  perMonthWith: number;
  perMonthWithout: number;
}

export interface RenewalEntry {
  month: number;
  amount: number;
  labels: string[];
}

export interface ContractAnalysis {
  rows: ContractRow[];
  renewals: RenewalEntry[];
  localOptimaWith: number[];
  localOptimaWithout: number[];
  /** Nejlepší lokální optimum do stropu doporučení. */
  bestWith: number;
  bestWithout: number;
  /** Argmax přes celý rozsah — vždy nejdelší délka. */
  globalWith: number;
  globalWithout: number;
  /** Doporučení pro jednání. */
  recommended: number;
  /** O kolik procent je nejdelší délka lepší než doporučená. */
  globalGainPct: number;
  /** Výpočet nad plným rozsahem, ze kterého se všechno odečítá. */
  result: CalcResult;
}

/** Lokální maxima uvnitř řady. */
function localMaxima(rows: ContractRow[], value: (r: ContractRow) => number) {
  const out: number[] = [];
  for (let i = 1; i < rows.length - 1; i++) {
    if (value(rows[i]) > value(rows[i - 1]) && value(rows[i]) >= value(rows[i + 1])) {
      out.push(rows[i].months);
    }
  }
  return out;
}

function argmax(rows: ContractRow[], value: (r: ContractRow) => number) {
  return rows.reduce((a, b) => (value(b) > value(a) ? b : a)).months;
}

export function analyzeContractLength(
  loc: CalcLocation,
  catalog: CatalogItem[],
  settings: Settings,
  locationCount: number,
): ContractAnalysis {
  // Jeden výpočet nad plným rozsahem a odečty po indexech — počítat
  // devětačtyřicetkrát znovu by dalo stejná čísla za víc práce.
  const result = calc(
    loc,
    catalog,
    { ...settings, horizon: MAX_MONTHS + 12 },
    locationCount,
  );

  const rows: ContractRow[] = [];
  for (let m = MIN_MONTHS; m <= MAX_MONTHS; m++) {
    const cash = result.flow[m];
    const residual = residualValue(result, settings, m).total;
    rows.push({
      months: m,
      cash,
      residual,
      perMonthWith: (cash + residual) / m,
      perMonthWithout: cash / m,
    });
  }

  const renewals: RenewalEntry[] = Object.entries(result.eventDetails)
    .map(([month, list]) => ({
      month: Number(month),
      amount: list.reduce((s, x) => s + x.amount, 0),
      labels: list.map((x) => x.label),
    }))
    .sort((a, b) => a.month - b.month);

  const localOptimaWith = localMaxima(rows, (r) => r.perMonthWith);
  const localOptimaWithout = localMaxima(rows, (r) => r.perMonthWithout);

  const bestOf = (optima: number[], value: (r: ContractRow) => number) => {
    const kandidati = optima.filter((m) => m <= RECOMMEND_CEILING);
    const pool = kandidati.length ? kandidati : optima;
    if (!pool.length) return Math.min(RECOMMEND_CEILING, MAX_MONTHS);
    return pool.reduce((a, b) =>
      value(rows.find((r) => r.months === b)!) >
      value(rows.find((r) => r.months === a)!)
        ? b
        : a,
    );
  };

  const bestWith = bestOf(localOptimaWith, (r) => r.perMonthWith);
  const bestWithout = bestOf(localOptimaWithout, (r) => r.perMonthWithout);
  const globalWith = argmax(rows, (r) => r.perMonthWith);
  const globalWithout = argmax(rows, (r) => r.perMonthWithout);

  // Doporučení jde podle nastaveného koeficientu: když se zůstatek nedá
  // realizovat, je zbytečné doporučovat délku, která na něj spoléhá.
  const recommended = (settings.residualRate ?? 0) > 0 ? bestWith : bestWithout;

  const hodnota = (m: number) =>
    rows.find((r) => r.months === m)!.perMonthWith;
  const zaklad = hodnota(recommended);
  const globalGainPct =
    zaklad > 0 ? ((hodnota(globalWith) - zaklad) / zaklad) * 100 : 0;

  return {
    rows,
    renewals,
    localOptimaWith,
    localOptimaWithout,
    bestWith,
    bestWithout,
    globalWith,
    globalWithout,
    recommended,
    globalGainPct,
    result,
  };
}
