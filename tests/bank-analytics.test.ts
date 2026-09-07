/**
 * Analytika nad transakcemi.
 *
 * Nejcitlivější místo je, co se počítá jako výdaj. Převod mezi vlastními účty
 * ani ignorovaná položka do výdajů nesmí — jinak by se přesun peněz z účtu
 * na účet tvářil jako útrata a součet by lhal směrem nahoru.
 */
import { describe, expect, it } from "vitest";
import {
  byCategory,
  monthLabel,
  monthlySeries,
  recurringPayments,
  summarize,
  topCounterparties,
  filterRange,
} from "../lib/bank/analytics";
import type { Countable } from "../lib/bank/analytics";
import type { ExpenseCategory } from "../lib/bank/types";

const cats: ExpenseCategory[] = [
  { id: "hw", name: "Hardware", kind: "expense", color: "#1", note: "", sort: 10 },
  { id: "sw", name: "Software", kind: "expense", color: "#2", note: "", sort: 20 },
  { id: "prijem", name: "Tržby", kind: "income", color: "#3", note: "", sort: 30 },
  { id: "prevod", name: "Převod mezi účty", kind: "transfer", color: "#4", note: "", sort: 40 },
  { id: "ignor", name: "Ignorovat", kind: "ignore", color: "#5", note: "", sort: 50 },
];

function tx(p: Partial<Countable> & { bookedAt: string; amount: number }): Countable {
  return {
    fee: 0,
    counterName: "",
    counterAccount: "",
    categoryId: null,
    ...p,
  };
}

describe("souhrn", () => {
  it("výdaje a příjmy se sčítají podle druhu kategorie", () => {
    const s = summarize(
      [
        tx({ bookedAt: "2026-08-01", amount: -1000, categoryId: "hw" }),
        tx({ bookedAt: "2026-08-02", amount: -500, categoryId: "sw" }),
        tx({ bookedAt: "2026-08-03", amount: 50000, categoryId: "prijem" }),
      ],
      cats,
    );
    expect(s.expense).toBe(1500);
    expect(s.income).toBe(50000);
    expect(s.net).toBe(48500);
  });

  it("převod mezi vlastními účty není výdaj ani příjem", () => {
    const s = summarize(
      [
        tx({ bookedAt: "2026-08-01", amount: -100000, categoryId: "prevod" }),
        tx({ bookedAt: "2026-08-01", amount: 100000, categoryId: "prevod" }),
        tx({ bookedAt: "2026-08-02", amount: -1000, categoryId: "hw" }),
      ],
      cats,
    );
    expect(s.expense).toBe(1000);
    expect(s.income).toBe(0);
    expect(s.transfers).toBe(200000);
  });

  it("ignorovaná položka nevstupuje nikam", () => {
    const s = summarize(
      [tx({ bookedAt: "2026-08-01", amount: -9999, categoryId: "ignor" })],
      cats,
    );
    expect(s.expense).toBe(0);
    expect(s.income).toBe(0);
  });

  it("bez kategorie rozhoduje znaménko", () => {
    const s = summarize(
      [
        tx({ bookedAt: "2026-08-01", amount: -1000 }),
        tx({ bookedAt: "2026-08-02", amount: 300 }),
      ],
      cats,
    );
    expect(s.expense).toBe(1000);
    expect(s.income).toBe(300);
    expect(s.uncategorizedCount).toBe(2);
  });

  it("odkaz na smazanou kategorii se chová jako nezařazeno", () => {
    const s = summarize(
      [tx({ bookedAt: "2026-08-01", amount: -1000, categoryId: "uz-neexistuje" })],
      cats,
    );
    expect(s.expense).toBe(1000);
    expect(s.uncategorizedCount).toBe(1);
  });

  it("podíl nezařazeného ukazuje, jak moc se dá číslům věřit", () => {
    const s = summarize(
      [
        tx({ bookedAt: "2026-08-01", amount: -750, categoryId: "hw" }),
        tx({ bookedAt: "2026-08-02", amount: -250 }),
      ],
      cats,
    );
    expect(s.uncategorizedExpense).toBe(250);
    expect(s.uncategorizedShare).toBeCloseTo(0.25, 10);
  });

  it("poplatek je vidět zvlášť a do výdajů se nepřičítá", () => {
    const s = summarize(
      [tx({ bookedAt: "2026-08-01", amount: -1000, fee: 12, categoryId: "hw" })],
      cats,
    );
    expect(s.expense).toBe(1000);
    expect(s.fees).toBe(12);
  });

  it("prázdný vstup dá nuly, ne dělení nulou", () => {
    const s = summarize([], cats);
    expect(s.expense).toBe(0);
    expect(s.uncategorizedShare).toBe(0);
  });
});

describe("měsíční řada", () => {
  it("měsíc bez transakcí se doplní nulou, aby v grafu nezmizel", () => {
    const series = monthlySeries(
      [
        tx({ bookedAt: "2026-06-10", amount: -1000, categoryId: "hw" }),
        tx({ bookedAt: "2026-09-10", amount: -2000, categoryId: "hw" }),
      ],
      cats,
    );
    expect(series.map((p) => p.key)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(series[1].expense).toBe(0);
    expect(series[3].expense).toBe(2000);
  });

  it("řada přechází přes konec roku", () => {
    const series = monthlySeries(
      [
        tx({ bookedAt: "2026-11-10", amount: -1 }),
        tx({ bookedAt: "2027-02-10", amount: -1 }),
      ],
      cats,
    );
    expect(series.map((p) => p.key)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("popisek měsíce je česky", () => {
    expect(monthLabel("2026-08")).toBe("srpen 2026");
  });

  it("prázdný vstup dá prázdnou řadu", () => {
    expect(monthlySeries([], cats)).toEqual([]);
  });
});

describe("rozpad podle kategorií", () => {
  const txs = [
    tx({ bookedAt: "2026-08-01", amount: -6000, categoryId: "hw" }),
    tx({ bookedAt: "2026-08-02", amount: -3000, categoryId: "sw" }),
    tx({ bookedAt: "2026-08-03", amount: -1000 }),
    tx({ bookedAt: "2026-08-04", amount: 50000, categoryId: "prijem" }),
  ];

  it("sečte výdaje po kategoriích a spočítá podíl", () => {
    const slices = byCategory(txs, cats);
    expect(slices[0].name).toBe("Hardware");
    expect(slices[0].expense).toBe(6000);
    expect(slices[0].share).toBeCloseTo(0.6, 10);
    expect(slices[1].name).toBe("Software");
  });

  it("nezařazené je vlastní řádek a je vždycky poslední", () => {
    const slices = byCategory(txs, cats);
    const last = slices[slices.length - 1];
    expect(last.categoryId).toBeNull();
    expect(last.name).toBe("Nezařazeno");
    expect(last.expense).toBe(1000);
  });

  it("příjmy se do rozpadu výdajů nepletou", () => {
    const slices = byCategory(txs, cats);
    expect(slices.some((s) => s.name === "Tržby")).toBe(false);
    expect(slices.reduce((s, x) => s + x.expense, 0)).toBe(10000);
  });
});

describe("protistrany", () => {
  it("sloučí platby téže protistraně bez ohledu na diakritiku a velikost písmen", () => {
    const top = topCounterparties(
      [
        tx({ bookedAt: "2026-08-01", amount: -1000, counterName: "Alza.cz a.s.", categoryId: "hw" }),
        tx({ bookedAt: "2026-08-02", amount: -2000, counterName: "ALZA.CZ A.S.", categoryId: "hw" }),
        tx({ bookedAt: "2026-08-03", amount: -500, counterName: "Benzina", categoryId: "hw" }),
      ],
      cats,
    );
    expect(top[0].name).toBe("Alza.cz a.s.");
    expect(top[0].expense).toBe(3000);
    expect(top[0].txCount).toBe(2);
    expect(top[1].name).toBe("Benzina");
  });

  it("platby bez názvu se drží podle účtu, nesloučí se do jedné hromady", () => {
    const top = topCounterparties(
      [
        tx({ bookedAt: "2026-08-01", amount: -100, counterAccount: "111/0100", categoryId: "hw" }),
        tx({ bookedAt: "2026-08-02", amount: -200, counterAccount: "222/0100", categoryId: "hw" }),
      ],
      cats,
    );
    expect(top).toHaveLength(2);
  });

  it("omezí počet řádků", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      tx({ bookedAt: "2026-08-01", amount: -(i + 1), counterName: `Dodavatel ${i}`, categoryId: "hw" }),
    );
    expect(topCounterparties(many, cats, 5)).toHaveLength(5);
  });
});

describe("opakované platby", () => {
  const monthly = (name: string, amounts: number[]) =>
    amounts.map((a, i) =>
      tx({
        bookedAt: `2026-0${i + 1}-15`,
        amount: -a,
        counterName: name,
        categoryId: "sw",
      }),
    );

  it("najde platbu, která proběhla ve třech a víc měsících", () => {
    const r = recurringPayments(monthly("T-Mobile", [1250, 1250, 1250]), cats);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("T-Mobile");
    expect(r[0].months).toBe(3);
    expect(r[0].monthlyAvg).toBe(1250);
    expect(r[0].stable).toBe(true);
  });

  it("jednorázový velký nákup mezi opakované nepatří", () => {
    const r = recurringPayments(
      [tx({ bookedAt: "2026-03-01", amount: -268587, counterName: "Dodavatel stanice", categoryId: "hw" })],
      cats,
    );
    expect(r).toHaveLength(0);
  });

  it("dvě platby v jednom měsíci nejsou dva měsíce", () => {
    const r = recurringPayments(
      [
        tx({ bookedAt: "2026-08-01", amount: -100, counterName: "X", categoryId: "sw" }),
        tx({ bookedAt: "2026-08-15", amount: -100, counterName: "X", categoryId: "sw" }),
        tx({ bookedAt: "2026-08-28", amount: -100, counterName: "X", categoryId: "sw" }),
      ],
      cats,
    );
    expect(r).toHaveLength(0);
  });

  it("kolísavou platbu ohlásí, ale označí jako nestabilní", () => {
    const r = recurringPayments(monthly("Energie", [1000, 4000, 1200]), cats);
    expect(r).toHaveLength(1);
    expect(r[0].stable).toBe(false);
    expect(r[0].median).toBe(1200);
  });

  it("řadí podle měsíčního průměru, ne podle celkového součtu", () => {
    const r = recurringPayments(
      [...monthly("Malá", [100, 100, 100]), ...monthly("Velká", [5000, 5000, 5000])],
      cats,
    );
    expect(r[0].name).toBe("Velká");
  });
});

describe("omezení obdobím", () => {
  const txs = [
    tx({ bookedAt: "2026-07-31", amount: -1 }),
    tx({ bookedAt: "2026-08-01", amount: -2 }),
    tx({ bookedAt: "2026-08-31", amount: -3 }),
    tx({ bookedAt: "2026-09-01", amount: -4 }),
  ];

  it("hranice jsou včetně", () => {
    const out = filterRange(txs, { from: "2026-08-01", to: "2026-08-31" });
    expect(out.map((t) => t.amount)).toEqual([-2, -3]);
  });

  it("prázdný rozsah nechá všechno", () => {
    expect(filterRange(txs, {})).toHaveLength(4);
  });
});
