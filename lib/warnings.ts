/**
 * Upozornění na kalkulaci.
 *
 * Čistá funkce mimo komponentu, aby se pravidla dala testovat — text vedle
 * čísla je stejně důležitý jako číslo samo a stejně snadno se rozejde
 * s realitou.
 */
import type { CalcResult } from "./calc";
import { num, perc } from "./format";
import type { CalcLocation, CatalogItem } from "./types";

export function locationWarnings(
  loc: CalcLocation & { commitmentMonths?: number },
  catalog: CatalogItem[],
  r: CalcResult,
): string[] {
  const w: string[] = [];

  const isCam = loc.product === "cam" || loc.product === "both";
  const kamerCelkem =
    (loc.cameras || 0) + (loc.camerasTlBig || 0) + (loc.camerasTlSmall || 0);

  if (loc.price > 0 && loc.price < r.fullMonthly) {
    w.push("Cena je pod plným měsíčním nákladem.");
  }

  const platformy = r.lines.filter((l) =>
    ["dr_flytbase", "dr_flighthub"].includes(l.it.id),
  );
  if (platformy.length > 1) {
    w.push(
      "Obě dronové platformy jsou zapnuté zároveň. Vyber jednu v katalogu, jinak se počítají obě.",
    );
  }

  // Na sloupu visí i časosběrná kamera, proto se počítají všechny.
  if (isCam && loc.poles > 0 && kamerCelkem > 0 && kamerCelkem / loc.poles < 1.5) {
    w.push(
      `Méně než 1,5 kamery na sloup (${num(kamerCelkem / loc.poles)}). Sloup stojí měsíčně víc než kamera na něm.`,
    );
  }

  const zavazek = loc.commitmentMonths ?? 0;
  if (zavazek > 0 && loc.price > 0) {
    if (r.payback === null && r.flow[r.horizon] < 0) {
      w.push(
        `Investice se nevrátí ani za ${r.horizon} měsíců, natož uvnitř závazku na ${zavazek} měsíců.`,
      );
    } else if (r.payback !== null && r.payback > zavazek) {
      w.push(
        `Návratnost ${r.payback} měsíců je za hranicí závazku na ${zavazek} měsíců. Když klient po skončení odejde, investice se nevrátí.`,
      );
    }
  }

  return w;
}

/** Vysvětlení, které se ukáže, když není co hlásit. */
export const NO_WARNINGS_HINT =
  "Návratnost je poslední měsíc se zápornou hotovostí plus jedna, takže obnovy předplatků i výměny hardwaru jsou v ní započítané.";

export { perc };
