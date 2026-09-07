/**
 * Citlivostní analýza.
 *
 * Ukazuje, jak se hne marže, návratnost a kumulativ, když se změní jedna
 * veličina. Nejužitečnější sloupec ale není marže při pevné ceně — je to
 * obrácený pohled: jakou cenu si musíš říct, abys cílovou marži udržel.
 */
import { calc } from "./calc";
import type { CalcLocation, CatalogItem, Settings } from "./types";

export type SensitivityVariable =
  | "price"
  | "km"
  | "locationCount"
  | "cameras"
  | "docks";

export interface SensitivityPoint {
  value: number;
  /** Bod odpovídající současnému nastavení. */
  current: boolean;
  fullMonthly: number;
  margin: number;
  payback: number | null;
  /** Kumulativní hotovost na konci horizontu. */
  cumulative: number;
  /** Cena, při které vyjde cílová marže. */
  priceForTarget: number;
}

export interface SensitivityRow {
  variable: SensitivityVariable;
  label: string;
  unit: string;
  hint: string;
  currentValue: number;
  points: SensitivityPoint[];
}

/** Cena, při které vyjde cílová marže. */
export function priceForMargin(fullMonthly: number, target: number): number {
  if (fullMonthly <= 0) return 0;
  const zbytek = 1 - target;
  // Stoprocentní marže nejde, cena by musela být nekonečná — vracíme
  // nejbližší smysluplnou hodnotu místo Infinity.
  if (zbytek <= 0.01) return fullMonthly / 0.01;
  return fullMonthly / zbytek;
}

/** Pět bodů kolem současné hodnoty, bez duplicit a nikdy záporných. */
function stepsAround(
  current: number,
  step: number,
  opts: { min?: number; round?: number } = {},
): number[] {
  const min = opts.min ?? 0;
  const round = opts.round ?? 1;
  const raw = [-2, -1, 0, 1, 2].map((k) =>
    Math.max(min, Math.round((current + k * step) / round) * round),
  );
  const uniq = Array.from(new Set(raw)).sort((a, b) => a - b);
  // Když se body slily u dolní hranice, doplníme řadu nahoru.
  let next = uniq[uniq.length - 1];
  while (uniq.length < 5) {
    next += step;
    uniq.push(Math.max(min, Math.round(next / round) * round));
  }
  return uniq.slice(0, 5);
}

export function sensitivity(
  loc: CalcLocation,
  catalog: CatalogItem[],
  settings: Settings,
  locationCount: number,
  targetMargin = 0.4,
): SensitivityRow[] {
  const bod = (
    value: number,
    current: boolean,
    upravy: {
      loc?: Partial<CalcLocation>;
      catalog?: CatalogItem[];
      count?: number;
    },
  ): SensitivityPoint => {
    const r = calc(
      { ...loc, ...(upravy.loc ?? {}) },
      upravy.catalog ?? catalog,
      settings,
      upravy.count ?? locationCount,
    );
    return {
      value,
      current,
      fullMonthly: r.fullMonthly,
      margin: r.margin,
      payback: r.payback,
      cumulative: r.flow[r.horizon],
      priceForTarget: priceForMargin(r.fullMonthly, targetMargin),
    };
  };

  const cenaKrok = Math.max(1000, Math.round((loc.price || 50000) * 0.1));
  const priceValues = stepsAround(loc.price, cenaKrok, { round: 1000 });

  // Vzdálenost mění náklad přes dopravu na výjezdech, proto se hodí sledovat.
  const kmKrok = loc.km > 0 ? Math.max(10, Math.round(loc.km / 2)) : 50;

  const rows: SensitivityRow[] = [
    {
      variable: "price",
      label: "Cena klientovi",
      unit: "Kč / měsíc",
      hint: "Podlaha ceny na ceně nezávisí — mění se jen to, kolik nad ní jsi.",
      currentValue: loc.price,
      points: priceValues.map((v) =>
        bod(v, v === loc.price, { loc: { price: v } }),
      ),
    },
    {
      variable: "km",
      label: "Vzdálenost tam a zpět",
      unit: "km",
      hint: "Doprava na výjezdech se násobí vzdáleností, práce na místě ne.",
      currentValue: loc.km,
      points: stepsAround(loc.km, kmKrok, { min: 0, round: 10 }).map((v) =>
        bod(v, v === loc.km, { loc: { km: v } }),
      ),
    },
    {
      variable: "locationCount",
      label: "Lokalit v portfoliu",
      unit: "lokalit",
      hint: "Každá další lokalita zlevní sdílenou režii těm ostatním.",
      currentValue: locationCount,
      points: stepsAround(locationCount, 1, { min: 1 }).map((v) =>
        bod(v, v === locationCount, { count: v }),
      ),
    },
    {
      variable: "cameras",
      label: "Bezpečnostních kamer",
      unit: "ks",
      hint: "Časosběrné kamery se počítají zvlášť. Platí u Sky Cam a kombinace.",
      currentValue: loc.cameras,
      points: stepsAround(loc.cameras, 2, { min: 0 }).map((v) =>
        bod(v, v === loc.cameras, { loc: { cameras: v } }),
      ),
    },
    {
      variable: "docks",
      label: "Dokovacích stanic",
      unit: "ks",
      hint: "Platí jen u Sky Guard a kombinace.",
      currentValue: loc.docks,
      points: stepsAround(loc.docks, 1, { min: 0 }).map((v) =>
        bod(v, v === loc.docks, { loc: { docks: v } }),
      ),
    },
  ];

  return rows;
}
