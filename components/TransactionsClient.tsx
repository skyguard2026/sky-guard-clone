"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  assignCategory,
  createRule,
  setTxNote,
  txDetail,
  type TxDetail,
} from "@/app/actions/finance";
import { fold } from "@/lib/bank/categorize";
import type { ExpenseCategory, RuleField } from "@/lib/bank/types";
import type { TxListRow } from "@/lib/data";
import { money, plural } from "@/lib/format";
import { useEffect } from "react";
import { Modal } from "./ui";
import { UnassignedCard } from "./UnassignedCard";
import { useToast } from "./Toast";

type Filter = "vse" | "vydaje" | "prijmy" | "nezarazene";

/**
 * Kolik řádků se vykreslí naráz. Za pár let provozu je transakcí přes deset
 * tisíc a vykreslit je všechny znamená stejně dlouhý DOM — prohlížeč pak
 * trhá i při obyčejném rolování.
 */
const PAGE = 200;

const FIELD_OPTIONS: { v: RuleField; label: string }[] = [
  { v: "counterName", label: "Protistrana" },
  { v: "counterAccount", label: "Protiúčet" },
  { v: "vs", label: "Variabilní symbol" },
  { v: "message", label: "Zpráva pro příjemce" },
  { v: "txType", label: "Typ transakce" },
  { v: "any", label: "Kdekoli" },
];

export function TransactionsClient({
  transactions,
  categories,
}: {
  transactions: TxListRow[];
  categories: ExpenseCategory[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [filter, setFilter] = useState<Filter>(
    params.get("jen") === "nezarazene" ? "nezarazene" : "vse",
  );
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ruleFor, setRuleFor] = useState<TxListRow | null>(null);
  const [detailFor, setDetailFor] = useState<TxListRow | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const shown = useMemo(() => {
    const needle = fold(q);
    return transactions.filter((t) => {
      if (filter === "vydaje" && t.amount >= 0) return false;
      if (filter === "prijmy" && t.amount <= 0) return false;
      if (filter === "nezarazene" && t.categoryId) return false;
      if (catFilter && t.categoryId !== catFilter) return false;
      if (!needle) return true;
      return (
        fold(t.counterName).includes(needle) ||
        fold(t.message).includes(needle) ||
        fold(t.counterAccount).includes(needle) ||
        fold(t.vs).includes(needle)
      );
    });
  }, [transactions, filter, catFilter, q]);

  /**
   * Po změně filtru se seznam ořezává znovu od začátku — jinak by uživatel
   * po zúžení hledání koukal na „zobrazeno 200 z 12", což nedává smysl.
   *
   * Srovnává se během renderu, ne v efektu: efekt by seznam nejdřív vykreslil
   * v dlouhé podobě a hned překreslil v krátké.
   */
  const filterKey = `${q}|${filter}|${catFilter}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setLimit(PAGE);
  }

  const page = shown.slice(0, limit);
  const hidden = shown.length - page.length;

  const allShownSelected =
    page.length > 0 && page.every((t) => selected.has(t.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function assign(ids: string[], categoryId: string | null) {
    if (!ids.length) return;
    start(async () => {
      const res = await assignCategory(ids, categoryId);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      toast(
        categoryId
          ? `Zařazeno ${res.updated} ${plural(res.updated, "transakce", "transakce", "transakcí")}`
          : "Zařazení zrušeno, rozhodnou zase pravidla",
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  const nezarazenych = transactions.filter((t) => !t.categoryId).length;

  return (
    <>
      <UnassignedCard transactions={transactions} categories={categories} />

      <div className="card">
        <h2>
          Filtr
          <small>
            {shown.length} z {transactions.length}{" "}
            {plural(transactions.length, "transakce", "transakcí", "transakcí")}
            {nezarazenych ? ` · ${nezarazenych} bez kategorie` : ""}
          </small>
        </h2>
        <div className="body pad">
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="search"
              placeholder="Hledat protistranu, zprávu nebo VS…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: "1 1 260px", minWidth: 200 }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
            >
              <option value="vse">Vše</option>
              <option value="vydaje">Jen výdaje</option>
              <option value="prijmy">Jen příjmy</option>
              <option value="nezarazene">Jen nezařazené</option>
            </select>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="">Všechny kategorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selected.size ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div
            className="body pad"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <b>
              Označeno {selected.size}{" "}
              {plural(selected.size, "transakce", "transakce", "transakcí")}
            </b>
            <select
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                if (!e.target.value) return;
                assign([...selected], e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Zařadit do kategorie…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn sm"
              disabled={pending}
              onClick={() => assign([...selected], null)}
            >
              Zrušit zařazení
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => setSelected(new Set())}
            >
              Odznačit
            </button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="body">
          {shown.length ? (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        checked={allShownSelected}
                        aria-label="Označit vše"
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? new Set(page.map((t) => t.id))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    <th>Datum</th>
                    <th>Protistrana</th>
                    <th className="hide-narrow">Zpráva</th>
                    <th className="n">Částka</th>
                    <th>Kategorie</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {page.map((t) => {
                    const cat = t.categoryId ? byId.get(t.categoryId) : null;
                    return (
                      <tr key={t.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(t.id)}
                            aria-label={`Označit ${t.counterName || t.bookedAt}`}
                            onChange={() => toggle(t.id)}
                          />
                        </td>
                        <td className="tnum">{t.bookedAt}</td>
                        <td>
                          {t.counterName || t.counterAccount || "—"}
                          {t.vs ? (
                            <span
                              className="tnum"
                              style={{
                                color: "var(--tx-3)",
                                marginLeft: 8,
                                fontSize: 12,
                              }}
                            >
                              VS {t.vs}
                            </span>
                          ) : null}
                        </td>
                        <td className="hide-narrow" style={{ color: "var(--tx-3)" }}>
                          {t.message}
                        </td>
                        <td
                          className="n tnum"
                          style={{
                            color: t.amount < 0 ? "var(--tx)" : "var(--green)",
                          }}
                        >
                          {money(t.amount)}
                        </td>
                        <td>
                          <span
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            {cat ? (
                              <span
                                className="cat-dot"
                                style={{ background: cat.color }}
                              />
                            ) : null}
                            <select
                              value={t.categoryId ?? ""}
                              disabled={pending}
                              onChange={(e) =>
                                assign([t.id], e.target.value || null)
                              }
                            >
                              <option value="">— nezařazeno —</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            {t.categorySource === "manual" ? (
                              <span
                                className="pill off"
                                style={{ marginLeft: 8 }}
                                title="Zařazeno ručně. Přepočet pravidel na tuhle transakci nesáhne."
                              >
                                ručně
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="n" style={{ whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => setDetailFor(t)}
                          >
                            Detail
                          </button>{" "}
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => setRuleFor(t)}
                          >
                            Pravidlo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <b>Filtru nevyhovuje žádná transakce</b>
              Zkus jiné hledání nebo přepni filtr na Vše.
            </div>
          )}
        </div>
        {hidden > 0 ? (
          <div
            className="body pad"
            style={{ display: "flex", gap: 12, alignItems: "center" }}
          >
            {/* Ořez je vidět, ne tichý. Seznam, který mlčky končí na dvoustovce,
                vypadá jako úplný. */}
            <span className="muted">
              Zobrazeno {page.length} z {shown.length}, skryto {hidden}.
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={() => setLimit((n) => n + PAGE)}
            >
              Zobrazit dalších {Math.min(PAGE, hidden)}
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => setLimit(shown.length)}
            >
              Zobrazit vše
            </button>
          </div>
        ) : null}
      </div>

      {detailFor ? (
        <TxDetailModal tx={detailFor} onClose={() => setDetailFor(null)} />
      ) : null}

      {ruleFor ? (
        <RuleFromTx
          tx={ruleFor}
          categories={categories}
          onClose={() => setRuleFor(null)}
          onDone={() => {
            setRuleFor(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Pravidlo z konkrétní transakce.
 *
 * Předvyplní se protistranou, protože to je v devíti z deseti případů to,
 * podle čeho se zařazuje. Zbytek jde přepsat.
 */
function RuleFromTx({
  tx,
  categories,
  onClose,
  onDone,
}: {
  tx: TxListRow;
  categories: ExpenseCategory[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [field, setField] = useState<RuleField>("counterName");
  const [value, setValue] = useState(tx.counterName || tx.counterAccount || "");
  const [categoryId, setCategoryId] = useState(
    tx.categoryId || categories[0]?.id || "",
  );

  function save() {
    start(async () => {
      const res = await createRule({ categoryId, field, value, priority: 50 });
      if (!res.ok) {
        toast(res.error);
        return;
      }
      toast(
        res.changed
          ? `Pravidlo uloženo, zařadilo ${res.changed} ${plural(res.changed, "transakci", "transakce", "transakcí")}`
          : "Pravidlo uloženo",
      );
      onDone();
    });
  }

  return (
    <Modal open title="Nové pravidlo" onClose={onClose}>
      <div className="field">
        <label htmlFor="rf">Když</label>
        <select
          id="rf"
          value={field}
          onChange={(e) => setField(e.target.value as RuleField)}
        >
          {FIELD_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rv">obsahuje</label>
        <input id="rv" value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="hint">
          Porovnává se bez diakritiky a velikosti písmen.
        </div>
      </div>
      <div className="field">
        <label htmlFor="rc">zařaď do</label>
        <select
          id="rc"
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
      <p className="note">
        Transakce, které jsi zařadil ručně, pravidlo nepřepíše.
      </p>
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

/**
 * Detail transakce včetně původního řádku výpisu.
 *
 * Původní řádek je tu schválně celý a syrový. Když se někdo diví, proč platba
 * spadla do téhle kategorie nebo proč má tuhle částku, tohle je jediné místo,
 * kde se dá dohledat, co přesně banka poslala — bez otevírání CSV v editoru.
 */
function TxDetailModal({
  tx,
  onClose,
}: {
  tx: TxListRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<TxDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    txDetail(tx.id).then((d) => {
      if (!live) return;
      if (!d) {
        setMissing(true);
        return;
      }
      setDetail(d);
      setNote(d.note);
    });
    return () => {
      live = false;
    };
  }, [tx.id]);

  function saveNote() {
    start(async () => {
      await setTxNote(tx.id, note);
      toast("Poznámka uložena");
      router.refresh();
    });
  }

  return (
    <Modal open title="Detail transakce" onClose={onClose}>
      <table style={{ marginBottom: 14 }}>
        <tbody>
          <tr>
            <th style={{ width: "40%" }}>Datum zaúčtování</th>
            <td className="tnum">{tx.bookedAt}</td>
          </tr>
          {tx.valueDate && tx.valueDate !== tx.bookedAt ? (
            <tr>
              <th>Datum provedení</th>
              <td className="tnum">{tx.valueDate}</td>
            </tr>
          ) : null}
          <tr>
            <th>Částka</th>
            <td
              className="tnum"
              style={{ color: tx.amount < 0 ? "var(--tx)" : "var(--green)" }}
            >
              {money(tx.amount)} {tx.currency !== "CZK" ? tx.currency : ""}
            </td>
          </tr>
          {tx.fee ? (
            <tr>
              <th>Poplatek</th>
              <td className="tnum">{money(tx.fee)}</td>
            </tr>
          ) : null}
          <tr>
            <th>Protistrana</th>
            <td>{tx.counterName || "—"}</td>
          </tr>
          <tr>
            <th>Protiúčet</th>
            <td className="tnum">{tx.counterAccount || "—"}</td>
          </tr>
          {tx.vs || tx.ks || tx.ss ? (
            <tr>
              <th>Symboly</th>
              <td className="tnum">
                {[
                  tx.vs && `VS ${tx.vs}`,
                  tx.ks && `KS ${tx.ks}`,
                  tx.ss && `SS ${tx.ss}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </td>
            </tr>
          ) : null}
          {tx.message ? (
            <tr>
              <th>Zpráva pro příjemce</th>
              <td style={{ whiteSpace: "pre-wrap" }}>{tx.message}</td>
            </tr>
          ) : null}
          {tx.txType ? (
            <tr>
              <th>Typ transakce</th>
              <td>{tx.txType}</td>
            </tr>
          ) : null}
          <tr>
            <th>Zařazení</th>
            <td>
              {tx.categorySource === "manual"
                ? "ručně"
                : tx.categorySource === "rule"
                  ? "pravidlem"
                  : "nezařazeno"}
            </td>
          </tr>
          {detail ? (
            <tr>
              <th>Z výpisu</th>
              <td>
                {detail.importFilename}
                <span className="muted">
                  {" "}
                  ({new Date(detail.importedAt).toLocaleDateString("cs-CZ")})
                </span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="field">
        <label htmlFor="txnote">Poznámka</label>
        <textarea
          id="txnote"
          rows={2}
          value={note}
          disabled={!detail}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="hint">
          Interní. Do žádného výstupu pro klienta se nedostane.
        </div>
      </div>

      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", color: "var(--tx-2)" }}>
          Původní řádek výpisu
        </summary>
        {missing ? (
          <p className="note">
            Transakci se nepodařilo načíst — nejspíš ji mezitím smazal vrácený
            import.
          </p>
        ) : detail ? (
          <div className="scroll-x" style={{ marginTop: 8 }}>
            <table>
              <tbody>
                {Object.entries(detail.raw).map(([k, v]) => (
                  <tr key={k}>
                    <th style={{ width: "40%" }}>{k}</th>
                    <td style={{ whiteSpace: "pre-wrap" }}>{v || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">Načítám…</p>
        )}
      </details>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onClose}>
          Zavřít
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={pending || !detail || note === detail.note}
          onClick={saveNote}
        >
          {pending ? "Ukládám…" : "Uložit poznámku"}
        </button>
      </div>
    </Modal>
  );
}
