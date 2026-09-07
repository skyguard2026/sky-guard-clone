"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  categoryUsage,
  createCategory,
  createRule,
  patchCategory,
  patchRule,
  recalcRules,
  removeCategory,
  removeRule,
  testRule,
} from "@/app/actions/finance";
import type {
  CategoryKind,
  CategoryRule,
  ExpenseCategory,
  RuleField,
  RuleOp,
} from "@/lib/bank/types";
import type { TxListRow } from "@/lib/data";
import { money, plural } from "@/lib/format";
import { Modal } from "./ui";
import { useToast } from "./Toast";

const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Výdaj",
  income: "Příjem",
  transfer: "Převod mezi účty",
  ignore: "Ignorovat",
};

const FIELD_LABELS: Record<RuleField, string> = {
  counterName: "Protistrana",
  counterAccount: "Protiúčet",
  vs: "Variabilní symbol",
  message: "Zpráva pro příjemce",
  note: "Poznámka",
  txType: "Typ transakce",
  any: "Kdekoli",
};

const OP_LABELS: Record<RuleOp, string> = {
  contains: "obsahuje",
  equals: "rovná se",
  startsWith: "začíná na",
};

export function CategoriesClient({
  categories,
  rules,
  transactions,
}: {
  categories: ExpenseCategory[];
  rules: CategoryRule[];
  transactions: TxListRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [newCat, setNewCat] = useState("");
  const [ruleOpen, setRuleOpen] = useState(false);

  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  /** Kolik transakcí a peněz na kategorii visí. Bez toho je mazání střelba
   * naslepo — číslo je vidět dřív, než se na tlačítko sáhne. */
  const usage = useMemo(() => {
    const m = new Map<string, { count: number; volume: number }>();
    for (const t of transactions) {
      if (!t.categoryId) continue;
      const cur = m.get(t.categoryId) ?? { count: 0, volume: 0 };
      cur.count++;
      cur.volume += Math.abs(t.amount);
      m.set(t.categoryId, cur);
    }
    return m;
  }, [transactions]);

  function add() {
    const name = newCat.trim();
    if (!name) return;
    start(async () => {
      const res = await createCategory({ name });
      if (!res.ok) {
        toast(res.error);
        return;
      }
      setNewCat("");
      toast("Kategorie přidána");
      router.refresh();
    });
  }

  return (
    <>
      <div className="card">
        <h2>
          Kategorie
          <small>
            {categories.length} — druh rozhoduje, jestli částka vstupuje do
            výdajů, příjmů, nebo nikam
          </small>
          <span className="right">
            <button
              type="button"
              className="btn sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await recalcRules();
                  toast(
                    r.changed
                      ? `Přepočteno, změněno ${r.changed} ${plural(r.changed, "transakce", "transakce", "transakcí")}`
                      : "Přepočteno, nic se nezměnilo",
                  );
                  router.refresh();
                })
              }
            >
              Přepočítat pravidla
            </button>
          </span>
        </h2>
        <div className="body">
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Název</th>
                  <th>Druh</th>
                  <th className="n">Transakcí</th>
                  <th className="n hide-narrow">Objem</th>
                  <th className="hide-narrow">Poznámka</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const u = usage.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <span style={{ display: "flex", alignItems: "center" }}>
                          <span
                            className="cat-dot"
                            style={{ background: c.color }}
                          />
                          <input
                            className="cell-in"
                            defaultValue={c.name}
                            onBlur={(e) => {
                              const name = e.target.value.trim();
                              if (!name || name === c.name) {
                                e.target.value = c.name;
                                return;
                              }
                              start(async () => {
                                await patchCategory(c.id, { name });
                                router.refresh();
                              });
                            }}
                          />
                        </span>
                      </td>
                      <td>
                        <select
                          value={c.kind}
                          disabled={pending}
                          onChange={(e) =>
                            start(async () => {
                              await patchCategory(c.id, {
                                kind: e.target.value as CategoryKind,
                              });
                              router.refresh();
                            })
                          }
                        >
                          {(
                            Object.keys(KIND_LABELS) as CategoryKind[]
                          ).map((k) => (
                            <option key={k} value={k}>
                              {KIND_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="n tnum">{u?.count ?? 0}</td>
                      <td className="n tnum hide-narrow">
                        {money(u?.volume ?? 0)}
                      </td>
                      <td className="hide-narrow" style={{ color: "var(--tx-3)" }}>
                        {c.note}
                      </td>
                      <td className="n">
                        <button
                          type="button"
                          className="btn sm danger"
                          onClick={() =>
                            start(async () => {
                              const { count } = await categoryUsage(c.id);
                              const ok = window.confirm(
                                count
                                  ? `Smazat kategorii ${c.name}? ${count} ${plural(count, "transakce zůstane", "transakce zůstanou", "transakcí zůstane")} bez zařazení a pravidla, která na ni odkazují, zmizí s ní.`
                                  : `Smazat kategorii ${c.name}?`,
                              );
                              if (!ok) return;
                              await removeCategory(c.id);
                              toast("Kategorie smazána");
                              router.refresh();
                            })
                          }
                        >
                          Smazat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            className="body pad"
            style={{ display: "flex", gap: 10, alignItems: "center" }}
          >
            <input
              placeholder="Název nové kategorie"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              style={{ flex: "1 1 240px" }}
            />
            <button
              type="button"
              className="btn"
              disabled={pending || !newCat.trim()}
              onClick={add}
            >
              Přidat
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          Pravidla
          <small>
            vyhodnocují se shora dolů, vyhrává první vyhovující — ne
            nejpřesnější
          </small>
          <span className="right">
            <button
              type="button"
              className="btn sm"
              onClick={() => setRuleOpen(true)}
            >
              Nové pravidlo
            </button>
          </span>
        </h2>
        <div className="body">
          {rules.length ? (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th className="n">Pořadí</th>
                    <th>Když</th>
                    <th>Podmínka</th>
                    <th>Hodnota</th>
                    <th>Zařadí do</th>
                    <th className="n">Aktivní</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
                      <td className="n">
                        <input
                          className="cell-in tnum"
                          type="number"
                          defaultValue={r.priority}
                          style={{ width: 62 }}
                          onBlur={(e) => {
                            const priority = Number(e.target.value);
                            if (!Number.isFinite(priority) || priority === r.priority)
                              return;
                            start(async () => {
                              await patchRule(r.id, { priority });
                              router.refresh();
                            });
                          }}
                        />
                      </td>
                      <td>{FIELD_LABELS[r.field]}</td>
                      <td style={{ color: "var(--tx-3)" }}>{OP_LABELS[r.op]}</td>
                      <td>
                        <input
                          className="cell-in"
                          defaultValue={r.value}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (!value || value === r.value) {
                              e.target.value = r.value;
                              return;
                            }
                            start(async () => {
                              await patchRule(r.id, { value });
                              router.refresh();
                            });
                          }}
                        />
                      </td>
                      <td>
                        <span style={{ display: "flex", alignItems: "center" }}>
                          <span
                            className="cat-dot"
                            style={{
                              background: byId.get(r.categoryId)?.color ?? "var(--muted)",
                            }}
                          />
                          {byId.get(r.categoryId)?.name ?? "—"}
                        </span>
                      </td>
                      <td className="n">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          aria-label={`Pravidlo ${r.value} aktivní`}
                          onChange={(e) =>
                            start(async () => {
                              await patchRule(r.id, { enabled: e.target.checked });
                              router.refresh();
                            })
                          }
                        />
                      </td>
                      <td className="n">
                        <button
                          type="button"
                          className="btn sm danger"
                          onClick={() =>
                            start(async () => {
                              if (
                                !window.confirm(
                                  `Smazat pravidlo „${r.value}"? Transakce, které zařadilo, se vrátí mezi nezařazené — kromě těch, které jsi zařadil ručně.`,
                                )
                              )
                                return;
                              const res = await removeRule(r.id);
                              toast(
                                res.changed
                                  ? `Smazáno, uvolnilo ${res.changed} ${plural(res.changed, "transakci", "transakce", "transakcí")}`
                                  : "Pravidlo smazáno",
                              );
                              router.refresh();
                            })
                          }
                        >
                          Smazat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <b>Zatím tu není žádné pravidlo</b>
              Nejrychleji se zakládá z konkrétní transakce — v seznamu transakcí
              tlačítkem Pravidlo.
            </div>
          )}
        </div>
      </div>

      <NewRule
        open={ruleOpen}
        categories={categories}
        onClose={() => setRuleOpen(false)}
        onDone={() => {
          setRuleOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

/** Nové pravidlo s živým náhledem, kolik transakcí zabere. */
function NewRule({
  open,
  categories,
  onClose,
  onDone,
}: {
  open: boolean;
  categories: ExpenseCategory[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [field, setField] = useState<RuleField>("counterName");
  const [op, setOp] = useState<RuleOp>("contains");
  const [value, setValue] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [preview, setPreview] = useState<{ matches: number; manual: number } | null>(
    null,
  );

  function check() {
    if (!value.trim()) {
      setPreview(null);
      return;
    }
    start(async () => {
      setPreview(await testRule({ categoryId, field, op, value }));
    });
  }

  function save() {
    start(async () => {
      const res = await createRule({ categoryId, field, op, value, priority: 50 });
      if (!res.ok) {
        toast(res.error);
        return;
      }
      toast(
        res.changed
          ? `Pravidlo uloženo, zařadilo ${res.changed} ${plural(res.changed, "transakci", "transakce", "transakcí")}`
          : "Pravidlo uloženo",
      );
      setValue("");
      setPreview(null);
      onDone();
    });
  }

  return (
    <Modal open={open} title="Nové pravidlo" onClose={onClose}>
      <div className="field">
        <label htmlFor="nf">Když</label>
        <select
          id="nf"
          value={field}
          onChange={(e) => setField(e.target.value as RuleField)}
        >
          {(Object.keys(FIELD_LABELS) as RuleField[]).map((f) => (
            <option key={f} value={f}>
              {FIELD_LABELS[f]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="no">Podmínka</label>
        <select id="no" value={op} onChange={(e) => setOp(e.target.value as RuleOp)}>
          {(Object.keys(OP_LABELS) as RuleOp[]).map((o) => (
            <option key={o} value={o}>
              {OP_LABELS[o]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="nv">Hodnota</label>
        <input
          id="nv"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setPreview(null);
          }}
          onBlur={check}
        />
        <div className="hint">
          Porovnává se bez diakritiky a velikosti písmen.
          {preview ? (
            <>
              {" "}Zabere {preview.matches}{" "}
              {plural(preview.matches, "transakci", "transakce", "transakcí")}
              {preview.manual
                ? `, z toho ${preview.manual} zařazených ručně — na ty pravidlo nesáhne.`
                : "."}
            </>
          ) : null}
        </div>
      </div>
      <div className="field">
        <label htmlFor="nc">Zařadí do</label>
        <select
          id="nc"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={pending || !value.trim()}
          onClick={save}
        >
          {pending ? "Ukládám…" : "Uložit pravidlo"}
        </button>
      </div>
    </Modal>
  );
}
