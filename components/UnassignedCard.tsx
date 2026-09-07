"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRule } from "@/app/actions/finance";
import { fold } from "@/lib/bank/categorize";
import type { ExpenseCategory, RuleField } from "@/lib/bank/types";
import type { TxListRow } from "@/lib/data";
import { money, perc, plural } from "@/lib/format";
import { useToast } from "./Toast";

/**
 * Největší nezařazené protistrany.
 *
 * Bez tohohle je první pohled na čerstvě nahraný výpis k ničemu: transakcí
 * jsou stovky, ale objem drží pár desítek protistran. Zařazovat je po jedné
 * transakci znamená stovky rozhodnutí místo desítek, a to nikdo neudělá —
 * takže by sekce zůstala navždy z devadesáti procent nezařazená.
 *
 * Vyrábí se pravidlo, ne jednorázové zařazení. Příští výpis se pak zařadí sám.
 */
interface Group {
  key: string;
  name: string;
  /** Podle čeho pravidlo hledat — u plateb bez jména zbývá jen účet. */
  field: RuleField;
  value: string;
  expense: number;
  txCount: number;
}

const SHOW = 12;

export function UnassignedCard({
  transactions,
  categories,
}: {
  transactions: TxListRow[];
  categories: ExpenseCategory[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [limit, setLimit] = useState(SHOW);
  const [done, setDone] = useState<Set<string>>(new Set());

  const { groups, totalExpense, unassignedExpense } = useMemo(() => {
    const acc = new Map<string, Group>();
    let total = 0;
    let un = 0;
    for (const t of transactions) {
      if (t.amount >= 0) continue;
      const value = -t.amount;
      total += value;
      if (t.categoryId) continue;
      un += value;

      // Bez jména se dá pravidlo postavit jedině na čísle účtu. Je to horší
      // klíč, ale pořád lepší než transakci nechat napospas ručnímu klikání.
      const named = !!t.counterName.trim();
      const key = named ? `n:${fold(t.counterName)}` : `a:${t.counterAccount}`;
      if (!named && !t.counterAccount) continue;

      const g = acc.get(key) ?? {
        key,
        name: named ? t.counterName : t.counterAccount,
        field: named ? ("counterName" as RuleField) : ("counterAccount" as RuleField),
        value: named ? t.counterName : t.counterAccount,
        expense: 0,
        txCount: 0,
      };
      g.expense += value;
      g.txCount++;
      acc.set(key, g);
    }
    return {
      groups: [...acc.values()].sort((a, b) => b.expense - a.expense),
      totalExpense: total,
      unassignedExpense: un,
    };
  }, [transactions]);

  const pending_groups = groups.filter((g) => !done.has(g.key));
  if (!pending_groups.length) return null;

  const shown = pending_groups.slice(0, limit);
  const covered = shown.reduce((s, g) => s + g.expense, 0);

  function assign(g: Group, categoryId: string) {
    start(async () => {
      const res = await createRule({
        categoryId,
        field: g.field,
        op: g.field === "counterAccount" ? "equals" : "contains",
        value: g.value,
        priority: 50,
      });
      if (!res.ok) {
        toast(res.error);
        return;
      }
      setDone((prev) => new Set(prev).add(g.key));
      toast(
        res.changed
          ? `Pravidlo zařadilo ${res.changed} ${plural(res.changed, "transakci", "transakce", "transakcí")}`
          : "Pravidlo uloženo",
      );
      router.refresh();
    });
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h2>
        Nezařazené protistrany
        <small>
          {pending_groups.length}{" "}
          {plural(pending_groups.length, "protistrana", "protistrany", "protistran")}{" "}
          drží {perc(totalExpense ? unassignedExpense / totalExpense : 0)} výdajů
          — zařaď je odshora, objem ubývá rychle
        </small>
      </h2>
      <div className="body">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Protistrana</th>
                <th className="n">Výdaje</th>
                <th className="n hide-narrow">Plateb</th>
                <th>Zařadit do kategorie</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.key}>
                  <td>
                    {g.name}
                    {g.field === "counterAccount" ? (
                      <span className="pill off" style={{ marginLeft: 8 }}>
                        bez názvu
                      </span>
                    ) : null}
                  </td>
                  <td className="n tnum">{money(g.expense)}</td>
                  <td className="n tnum hide-narrow">{g.txCount}</td>
                  <td>
                    <select
                      defaultValue=""
                      disabled={pending}
                      onChange={(e) => {
                        if (e.target.value) assign(g, e.target.value);
                      }}
                    >
                      <option value="">— vyber —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          className="body pad"
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          <span className="muted">
            Těchhle {shown.length} pokrývá {money(covered)} z{" "}
            {money(unassignedExpense)} nezařazených výdajů.
          </span>
          {pending_groups.length > limit ? (
            <button
              type="button"
              className="btn sm"
              onClick={() => setLimit((n) => n + SHOW)}
            >
              Zobrazit další
            </button>
          ) : null}
        </div>
        <p className="note" style={{ margin: "0 14px 14px" }}>
          Zakládá se pravidlo, ne jednorázové zařazení — příští výpis se podle
          něj zařadí sám. Upravit ho jde v Kategoriích a pravidlech.
        </p>
      </div>
    </div>
  );
}
