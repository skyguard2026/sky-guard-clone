/**
 * Zařazování transakcí do kategorií.
 *
 * Nejdůležitější věc tady dole: přepočet pravidel nesmí sáhnout na to, co
 * uživatel zařadil ručně. Kdyby to udělal, přepsal by mu vlastní práci
 * pokaždé, když přidá pravidlo — a pravidla by se přestala používat.
 */
import { describe, expect, it } from "vitest";
import { categorize, fold, recategorize, ruleMatches } from "../lib/bank/categorize";
import type { CategoryRule } from "../lib/bank/types";

function rule(p: Partial<CategoryRule> & { id: string; categoryId: string }): CategoryRule {
  return {
    field: "counterName",
    op: "contains",
    value: "",
    priority: 100,
    enabled: true,
    ...p,
  };
}

function tx(p: Partial<Parameters<typeof categorize>[0]> = {}) {
  return {
    counterName: "",
    counterAccount: "",
    vs: "",
    message: "",
    note: "",
    txType: "",
    ...p,
  };
}

describe("porovnání ignoruje diakritiku i velikost písmen", () => {
  it("Česká pojišťovna sedne na ceska pojistovna", () => {
    expect(fold("Česká pojišťovna")).toBe("ceska pojistovna");
    const r = rule({ id: "r1", categoryId: "c1", value: "ceska pojistovna" });
    expect(ruleMatches(tx({ counterName: "ČESKÁ POJIŠŤOVNA a.s." }), r)).toBe(true);
  });
});

describe("operace pravidla", () => {
  it("obsahuje, rovná se a začíná na dělají, co slibují", () => {
    const t = tx({ counterName: "Alza.cz a.s." });
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", value: "alza", op: "contains" }))).toBe(true);
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", value: "alza", op: "equals" }))).toBe(false);
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", value: "alza.cz a.s.", op: "equals" }))).toBe(true);
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", value: "alza", op: "startsWith" }))).toBe(true);
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", value: "cz", op: "startsWith" }))).toBe(false);
  });

  it("pole any prohledá protistranu, symbol i zprávu naráz", () => {
    const t = tx({ message: "Faktura za paměťové karty" });
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", field: "any", value: "pametove karty" }))).toBe(true);
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", field: "counterName", value: "pametove karty" }))).toBe(false);
  });

  it("pravidlo podle variabilního symbolu funguje na přesnou shodu", () => {
    const t = tx({ vs: "20260807" });
    expect(ruleMatches(t, rule({ id: "r", categoryId: "c", field: "vs", op: "equals", value: "20260807" }))).toBe(true);
  });
});

describe("pravidlo, které by spolklo všechno", () => {
  it("prázdná hodnota nesedne na nic", () => {
    expect(ruleMatches(tx({ counterName: "Alza" }), rule({ id: "r", categoryId: "c", value: "" }))).toBe(false);
    expect(ruleMatches(tx({ counterName: "Alza" }), rule({ id: "r", categoryId: "c", value: "   " }))).toBe(false);
  });

  it("vypnuté pravidlo nesedne, i když by sedlo", () => {
    const r = rule({ id: "r", categoryId: "c", value: "alza", enabled: false });
    expect(ruleMatches(tx({ counterName: "Alza" }), r)).toBe(false);
  });

  it("prázdné pole transakce nesedne na nic", () => {
    expect(ruleMatches(tx({ counterName: "" }), rule({ id: "r", categoryId: "c", value: "alza" }))).toBe(false);
  });
});

describe("pořadí rozhoduje první vyhovující pravidlo", () => {
  const rules: CategoryRule[] = [
    rule({ id: "b", categoryId: "sw", value: "microsoft", priority: 20 }),
    rule({ id: "a", categoryId: "hw", value: "microsoft store", priority: 10 }),
  ];

  it("vyhrává nižší priorita, ne delší shoda", () => {
    const hit = categorize(tx({ counterName: "Microsoft Store" }), rules);
    expect(hit?.categoryId).toBe("hw");
    expect(hit?.ruleId).toBe("a");
  });

  it("při shodné prioritě rozhoduje id, aby bylo pořadí stabilní", () => {
    const same: CategoryRule[] = [
      rule({ id: "z", categoryId: "druha", value: "alza", priority: 50 }),
      rule({ id: "a", categoryId: "prvni", value: "alza", priority: 50 }),
    ];
    expect(categorize(tx({ counterName: "Alza" }), same)?.categoryId).toBe("prvni");
    expect(categorize(tx({ counterName: "Alza" }), [...same].reverse())?.categoryId).toBe("prvni");
  });

  it("když nesedne nic, kategorie zůstane prázdná", () => {
    expect(categorize(tx({ counterName: "Někdo neznámý" }), rules)).toBeNull();
  });
});

describe("přepočet pravidel nad existujícími transakcemi", () => {
  const rules: CategoryRule[] = [
    rule({ id: "r1", categoryId: "doprava", value: "benzina", priority: 10 }),
  ];

  it("automaticky zařazenou transakci přeřadí", () => {
    const txs = [
      { ...tx({ counterName: "Benzina s.r.o." }), categoryId: "ostatni", categorySource: "rule" as const },
    ];
    const out = recategorize(txs, rules);
    expect(out[0].categoryId).toBe("doprava");
    expect(out[0].changed).toBe(true);
  });

  it("ručně zařazenou transakci nechá být", () => {
    const txs = [
      { ...tx({ counterName: "Benzina s.r.o." }), categoryId: "mzdy", categorySource: "manual" as const },
    ];
    const out = recategorize(txs, rules);
    expect(out[0].categoryId).toBe("mzdy");
    expect(out[0].changed).toBe(false);
  });

  it("nezařazenou transakci zařadí", () => {
    const txs = [
      { ...tx({ counterName: "Benzina s.r.o." }), categoryId: null, categorySource: null },
    ];
    const out = recategorize(txs, rules);
    expect(out[0].categoryId).toBe("doprava");
    expect(out[0].changed).toBe(true);
  });

  it("smazané pravidlo zařazení zase uvolní, ale ruční ne", () => {
    const txs = [
      { ...tx({ counterName: "Benzina s.r.o." }), categoryId: "doprava", categorySource: "rule" as const },
      { ...tx({ counterName: "Benzina s.r.o." }), categoryId: "doprava", categorySource: "manual" as const },
    ];
    const out = recategorize(txs, []);
    expect(out[0].categoryId).toBeNull();
    expect(out[1].categoryId).toBe("doprava");
  });

  it("opakovaný přepočet už nic nemění", () => {
    const txs = [
      { ...tx({ counterName: "Benzina s.r.o." }), categoryId: null, categorySource: null as string | null },
    ];
    const first = recategorize(txs, rules);
    const applied = first.map((r) => ({
      ...r.tx,
      categoryId: r.categoryId,
      categorySource: "rule" as string | null,
    }));
    const second = recategorize(applied, rules);
    expect(second.every((r) => !r.changed)).toBe(true);
  });
});
