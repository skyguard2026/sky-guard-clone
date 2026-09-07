/**
 * Zbytková hodnota hardwaru na konci kontraktu.
 *
 * Schválně mimo `calc` — do hotovosti ani do marže vstoupit nesmí. Je to
 * samostatný ukazatel: kolik z hardwaru se dá po odchodu klienta ještě
 * zpeněžit nebo přenést jinam.
 *
 * Koeficient realizovatelnosti je nízký záměrně. Dokovací stanice je vázaná
 * na povolení konkrétní lokality, takže přesun jinam znamená celé nové
 * povolovací kolo — účetní zůstatek a to, co za techniku reálně dostaneš,
 * jsou dvě různá čísla.
 */
import type { CalcLine, CalcResult } from "./calc";
import type { CatalogItem, Settings } from "./types";

export interface ResidualLine {
  it: CatalogItem;
  /** Částka, za kterou byl kus pořízen. */
  amount: number;
  life: number;
  /** Měsíc poslední výměny, 0 = původní kus. */
  lastReplaced: number;
  /** Stáří kusu v měsících. */
  age: number;
  remainingLife: number;
  /** Účetní zůstatek po uplatnění koeficientu. */
  gross: number;
  /** Kolik sežere prodleva, než kus začne zase vydělávat. */
  delayCost: number;
  /** Výsledek pro tuhle položku. */
  value: number;
}

export interface ResidualResult {
  /** Součet přes položky, nikdy záporný. */
  total: number;
  lines: ResidualLine[];
  atMonth: number;
  rate: number;
  delay: number;
}

/**
 * @param atMonth  konec kontraktu; výchozí je konec horizontu
 */
export function residualValue(
  r: CalcResult,
  settings: Settings,
  atMonth: number = r.horizon,
): ResidualResult {
  const rate = Math.max(0, settings.residualRate ?? 0) / 100;
  const delay = Math.max(0, settings.transferDelay ?? 0);

  const lines: ResidualLine[] = r.capex.map((l: CalcLine) => {
    const life = l.it.life!;
    // Obnovy sledují stejné pravidlo jako simulace hotovosti, jinak by
    // zůstatek popisoval jiný svět než graf vedle něj.
    const renews = settings.renew && life < r.horizon;
    let lastReplaced = 0;
    if (renews) {
      for (let m = life + 1; m <= atMonth; m += life) lastReplaced = m;
    }
    const age = atMonth - lastReplaced;
    const remainingLife = Math.max(0, life - age);

    const gross = l.amount * (remainingLife / life) * rate;
    const delayCost = delay * (l.amount / life);

    // Prodleva je náklad na stěhování skutečné techniky. Sleva dealera žádná
    // technika není, je to úprava ceny doku — proto se u záporných položek
    // neuplatňuje a nezaokrouhlují se na nulu. Kdyby se ořízly, zůstatek by
    // se tiše nafoukl o jejich podíl.
    const value =
      l.amount >= 0 ? Math.max(0, gross - delayCost) : gross;

    return {
      it: l.it,
      amount: l.amount,
      life,
      lastReplaced,
      age,
      remainingLife,
      gross,
      delayCost: l.amount >= 0 ? delayCost : 0,
      value,
    };
  });

  const total = Math.max(
    0,
    lines.reduce((s, l) => s + l.value, 0),
  );

  return { total, lines, atMonth, rate: rate * 100, delay };
}
