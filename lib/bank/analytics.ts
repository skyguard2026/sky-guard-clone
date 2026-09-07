/**
 * Analytika nad transakcemi. Čistá funkce, žádná databáze.
 *
 * Znaménko určuje směr: záporná částka je výdaj, kladná příjem. Druh kategorie
 * to může přebít — převod mezi vlastními účty ani ignorovaná položka nesmí
 * do výdajů vstoupit, jinak by se každé přesunutí peněz tvářilo jako útrata.
 *
 * Bankovní poplatek ze sloupce „Poplatek" se do součtů **nepřičítá**. Banky ho
 * většinou strhávají samostatnou transakcí, která ve výpisu stojí vedle, takže
 * přičtení by ho započítalo dvakrát. Je proto vidět zvlášť.
 */
import { fold } from "./categorize";
import type { BankTx, CategoryKind, ExpenseCategory } from "./types";

export interface Range {
  /** ISO YYYY-MM-DD, včetně. Prázdné = bez omezení. */
  from?: string | null;
  to?: string | null;
}

export type Countable = Pick<
  BankTx,
  "bookedAt" | "amount" | "fee" | "counterName" | "counterAccount" | "categoryId"
>;

/** YYYY-MM z ISO data. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Český název měsíce pro popisky grafu. */
const MONTHS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export function inRange(iso: string, range: Range): boolean {
  if (range.from && iso < range.from) return false;
  if (range.to && iso > range.to) return false;
  return true;
}

export function filterRange<T extends { bookedAt: string }>(
  txs: T[],
  range: Range,
): T[] {
  return txs.filter((t) => inRange(t.bookedAt, range));
}

/** Mapa kategorií podle id, ať se v cyklech nehledá lineárně. */
function kindOf(
  tx: Countable,
  byId: Map<string, ExpenseCategory>,
): CategoryKind {
  if (tx.categoryId) {
    const c = byId.get(tx.categoryId);
    // Odkaz na smazanou kategorii se chová jako nezařazeno, ne jako chyba.
    if (c) return c.kind;
  }
  return tx.amount < 0 ? "expense" : "income";
}

/** Výdaj jako kladné číslo, nebo 0, když transakce výdaj není. */
function expenseOf(tx: Countable, byId: Map<string, ExpenseCategory>): number {
  const kind = kindOf(tx, byId);
  if (kind !== "expense") return 0;
  return tx.amount < 0 ? -tx.amount : 0;
}

function incomeOf(tx: Countable, byId: Map<string, ExpenseCategory>): number {
  const kind = kindOf(tx, byId);
  if (kind !== "income") return 0;
  return tx.amount > 0 ? tx.amount : 0;
}

export function categoryMap(
  categories: ExpenseCategory[],
): Map<string, ExpenseCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}

/* ------------------------------------------------------------------ */
/* Souhrn                                                              */
/* ------------------------------------------------------------------ */

export interface Summary {
  expense: number;
  income: number;
  /** Příjmy minus výdaje. Ne zůstatek na účtu — ten výpis neříká. */
  net: number;
  /** Součet sloupce s poplatky. Do výdajů se nepřičítá, viz hlavička souboru. */
  fees: number;
  txCount: number;
  /** Kolik transakcí nemá kategorii. */
  uncategorizedCount: number;
  /** Objem nezařazených výdajů v Kč. */
  uncategorizedExpense: number;
  /** Podíl nezařazených výdajů na celkových výdajích, 0–1. */
  uncategorizedShare: number;
  /** Kolik z objemu je převod mezi vlastními účty. Do výdajů nevstupuje. */
  transfers: number;
}

export function summarize(
  txs: Countable[],
  categories: ExpenseCategory[],
): Summary {
  const byId = categoryMap(categories);
  let expense = 0;
  let income = 0;
  let fees = 0;
  let uncategorizedCount = 0;
  let uncategorizedExpense = 0;
  let transfers = 0;

  for (const tx of txs) {
    const e = expenseOf(tx, byId);
    const i = incomeOf(tx, byId);
    expense += e;
    income += i;
    fees += tx.fee || 0;
    if (kindOf(tx, byId) === "transfer") transfers += Math.abs(tx.amount);
    if (!tx.categoryId || !byId.has(tx.categoryId)) {
      uncategorizedCount++;
      uncategorizedExpense += e;
    }
  }

  return {
    expense,
    income,
    net: income - expense,
    fees,
    txCount: txs.length,
    uncategorizedCount,
    uncategorizedExpense,
    uncategorizedShare: expense > 0 ? uncategorizedExpense / expense : 0,
    transfers,
  };
}

/* ------------------------------------------------------------------ */
/* Měsíční řada                                                        */
/* ------------------------------------------------------------------ */

export interface MonthPoint {
  key: string;
  label: string;
  expense: number;
  income: number;
  net: number;
}

/**
 * Měsíční řada od nejstarší po nejnovější transakci.
 *
 * Měsíce bez jediné transakce se doplní nulami. Bez toho by graf spojil
 * červen se zářím a mezera by se ztratila — vypadalo by to, že se tři měsíce
 * utrácelo rovnoměrně, místo aby bylo vidět, že chybí výpis.
 */
export function monthlySeries(
  txs: Countable[],
  categories: ExpenseCategory[],
): MonthPoint[] {
  if (!txs.length) return [];
  const byId = categoryMap(categories);
  const acc = new Map<string, { expense: number; income: number }>();
  for (const tx of txs) {
    const k = monthKey(tx.bookedAt);
    const cur = acc.get(k) ?? { expense: 0, income: 0 };
    cur.expense += expenseOf(tx, byId);
    cur.income += incomeOf(tx, byId);
    acc.set(k, cur);
  }

  const keys = [...acc.keys()].sort();
  const out: MonthPoint[] = [];
  let [y, m] = keys[0].split("-").map(Number);
  const [endY, endM] = keys[keys.length - 1].split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    const v = acc.get(k) ?? { expense: 0, income: 0 };
    out.push({
      key: k,
      label: monthLabel(k),
      expense: v.expense,
      income: v.income,
      net: v.income - v.expense,
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rozpad podle kategorií                                              */
/* ------------------------------------------------------------------ */

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string;
  expense: number;
  txCount: number;
  /** Podíl na celkových výdajích, 0–1. */
  share: number;
}

/** Nezařazené se ukazují jako vlastní řádek, ne že by se schovaly do Ostatní. */
export const UNCATEGORIZED_LABEL = "Nezařazeno";

export function byCategory(
  txs: Countable[],
  categories: ExpenseCategory[],
): CategorySlice[] {
  const byId = categoryMap(categories);
  const acc = new Map<string | null, { expense: number; txCount: number }>();

  for (const tx of txs) {
    const e = expenseOf(tx, byId);
    if (e <= 0) continue;
    const key =
      tx.categoryId && byId.has(tx.categoryId) ? tx.categoryId : null;
    const cur = acc.get(key) ?? { expense: 0, txCount: 0 };
    cur.expense += e;
    cur.txCount++;
    acc.set(key, cur);
  }

  const total = [...acc.values()].reduce((s, v) => s + v.expense, 0);
  const out: CategorySlice[] = [...acc.entries()].map(([id, v]) => {
    const c = id ? byId.get(id) : undefined;
    return {
      categoryId: id,
      name: c?.name ?? UNCATEGORIZED_LABEL,
      color: c?.color ?? "var(--muted)",
      expense: v.expense,
      txCount: v.txCount,
      share: total > 0 ? v.expense / total : 0,
    };
  });

  // Nezařazené vždy naspod, jinak se sortem propadají a přehlédnou se.
  return out.sort((a, b) => {
    if (a.categoryId === null) return 1;
    if (b.categoryId === null) return -1;
    return b.expense - a.expense;
  });
}

/* ------------------------------------------------------------------ */
/* Protistrany                                                         */
/* ------------------------------------------------------------------ */

export interface CounterpartySlice {
  key: string;
  name: string;
  expense: number;
  txCount: number;
  share: number;
}

/** Klíč protistrany. Když chybí název, drží se účet — ať se to nesloučí. */
function counterKey(tx: Countable): string {
  const name = fold(tx.counterName);
  if (name) return `n:${name}`;
  const acc = (tx.counterAccount ?? "").trim();
  return acc ? `a:${acc}` : "n:";
}

export function topCounterparties(
  txs: Countable[],
  categories: ExpenseCategory[],
  limit = 10,
): CounterpartySlice[] {
  const byId = categoryMap(categories);
  const acc = new Map<
    string,
    { name: string; expense: number; txCount: number }
  >();

  for (const tx of txs) {
    const e = expenseOf(tx, byId);
    if (e <= 0) continue;
    const key = counterKey(tx);
    const cur = acc.get(key) ?? {
      name: tx.counterName || tx.counterAccount || "Neuvedeno",
      expense: 0,
      txCount: 0,
    };
    cur.expense += e;
    cur.txCount++;
    acc.set(key, cur);
  }

  const total = [...acc.values()].reduce((s, v) => s + v.expense, 0);
  return [...acc.entries()]
    .map(([key, v]) => ({
      key,
      name: v.name,
      expense: v.expense,
      txCount: v.txCount,
      share: total > 0 ? v.expense / total : 0,
    }))
    .sort((a, b) => b.expense - a.expense)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Opakované platby                                                    */
/* ------------------------------------------------------------------ */

export interface Recurring {
  key: string;
  name: string;
  /** V kolika různých měsících platba proběhla. */
  months: number;
  txCount: number;
  total: number;
  /** Medián jedné platby. Odolnější než průměr, když jednou přišlo vyúčtování. */
  median: number;
  /** Průměr na měsíc přes rozsah, ve kterém platba běží. */
  monthlyAvg: number;
  /**
   * true, když se všechny částky drží do 20 % od mediánu. Nestabilní platba
   * se pořád hlásí — jen je vidět, že se s ní nedá počítat jako s paušálem.
   */
  stable: boolean;
  firstAt: string;
  lastAt: string;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Pravidelné výdaje — protistrana, které se platilo alespoň ve třech různých
 * měsících. Tohle je odpověď na „za co utrácíme pravidelně", kterou jednorázový
 * součet za období nedá: velký jednorázový nákup a malý měsíční paušál se
 * v ročním součtu můžou rovnat, ale v rozhodování to jsou opačné věci.
 */
export function recurringPayments(
  txs: Countable[],
  categories: ExpenseCategory[],
  minMonths = 3,
): Recurring[] {
  const byId = categoryMap(categories);
  const acc = new Map<
    string,
    { name: string; amounts: number[]; months: Set<string>; dates: string[] }
  >();

  for (const tx of txs) {
    const e = expenseOf(tx, byId);
    if (e <= 0) continue;
    const key = counterKey(tx);
    const cur = acc.get(key) ?? {
      name: tx.counterName || tx.counterAccount || "Neuvedeno",
      amounts: [],
      months: new Set<string>(),
      dates: [],
    };
    cur.amounts.push(e);
    cur.months.add(monthKey(tx.bookedAt));
    cur.dates.push(tx.bookedAt);
    acc.set(key, cur);
  }

  const out: Recurring[] = [];
  for (const [key, v] of acc) {
    if (v.months.size < minMonths) continue;
    const total = v.amounts.reduce((s, x) => s + x, 0);
    const med = median(v.amounts);
    const dates = v.dates.sort();
    out.push({
      key,
      name: v.name,
      months: v.months.size,
      txCount: v.amounts.length,
      total,
      median: med,
      monthlyAvg: total / v.months.size,
      stable:
        med > 0 && v.amounts.every((a) => Math.abs(a - med) <= med * 0.2),
      firstAt: dates[0],
      lastAt: dates[dates.length - 1],
    });
  }
  return out.sort((a, b) => b.monthlyAvg - a.monthlyAvg);
}
