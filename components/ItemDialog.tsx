"use client";

import { useState } from "react";
import type { CatalogItemInput } from "@/app/actions/catalog";
import { Modal, Toggle } from "@/components/ui";
import { BILL, CAT, DRIVER, GROUP, PREPAY_HINT } from "@/lib/labels";
import type { Billing, Cat, CatalogItem, Driver, Group } from "@/lib/types";

const EMPTY: CatalogItemInput = {
  label: "",
  group: "shared",
  cat: "hw",
  price: 0,
  life: null,
  billing: "yearly",
  driver: "site",
  shared: false,
  prepay: true,
  note: "",
};

function ItemForm({
  item,
  onClose,
  onSave,
}: {
  item: CatalogItem | null;
  onClose: () => void;
  onSave: (v: CatalogItemInput) => void;
}) {
  const [v, setV] = useState<CatalogItemInput>(
    item
      ? {
          label: item.label,
          group: item.group,
          cat: item.cat,
          price: item.price,
          life: item.life,
          billing: item.billing,
          driver: item.driver,
          shared: item.shared,
          prepay: item.prepay,
          note: item.note,
        }
      : EMPTY,
  );
  const [error, setError] = useState("");

  const set = <K extends keyof CatalogItemInput>(
    k: K,
    val: CatalogItemInput[K],
  ) => setV((p) => ({ ...p, [k]: val }));

  return (
    <>
      <div className="dbody">
        <div className="field">
          <label htmlFor="i-label">Název</label>
          <input
            id="i-label"
            type="text"
            autoFocus
            value={v.label}
            onChange={(e) => set("label", e.target.value)}
          />
        </div>

        <div className="f2">
          <div className="field">
            <label htmlFor="i-group">Skupina</label>
            <select
              id="i-group"
              value={v.group}
              onChange={(e) => set("group", e.target.value as Group)}
            >
              {(Object.keys(GROUP) as Group[]).map((g) => (
                <option key={g} value={g}>
                  {GROUP[g]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="i-cat">Kategorie</label>
            <select
              id="i-cat"
              value={v.cat}
              onChange={(e) => set("cat", e.target.value as Cat)}
            >
              {(Object.keys(CAT) as Cat[]).map((c) => (
                <option key={c} value={c}>
                  {CAT[c].n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="f2">
          <div className="field">
            <label htmlFor="i-price">
              Cena {v.driver === "pctHw" ? "v procentech" : "v Kč"}
            </label>
            <input
              id="i-price"
              className="plain"
              type="number"
              step="0.01"
              value={v.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
            <div className="hint">Záporná hodnota znamená slevu.</div>
          </div>
          <div className="field">
            <label htmlFor="i-life">Životnost v měsících</label>
            <input
              id="i-life"
              className="plain"
              type="number"
              placeholder="—"
              value={v.life ?? ""}
              onChange={(e) =>
                set(
                  "life",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
            <div className="hint">Vyplněno = amortizuje se. Prázdné = ne.</div>
          </div>
        </div>

        <div className="f2">
          <div className="field">
            <label htmlFor="i-billing">Účtování</label>
            <select
              id="i-billing"
              value={v.billing}
              onChange={(e) => set("billing", e.target.value as Billing)}
            >
              {(Object.keys(BILL) as Billing[]).map((b) => (
                <option key={b} value={b}>
                  {BILL[b]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="i-driver">Driver množství</label>
            <select
              id="i-driver"
              value={v.driver}
              onChange={(e) => set("driver", e.target.value as Driver)}
            >
              {(Object.keys(DRIVER) as Driver[]).map((d) => (
                <option key={d} value={d}>
                  {DRIVER[d].n}
                </option>
              ))}
            </select>
            <div className="hint">{DRIVER[v.driver].h}</div>
          </div>
        </div>

        <div className="row">
          <div className="lbl">
            <b>Sdílené</b>
            <i>Dělí se mezi všechny lokality v portfoliu.</i>
          </div>
          <Toggle
            label="Sdílené"
            on={v.shared}
            onChange={(x) => set("shared", x)}
          />
        </div>

        <div className="row">
          <div className="lbl">
            <b>Platí se dopředu</b>
            <i>
              {v.billing === "yearly"
                ? PREPAY_HINT
                : "Týká se jen ročních položek."}
            </i>
          </div>
          <Toggle
            label="Platí se dopředu"
            on={v.prepay}
            onChange={(x) => set("prepay", x)}
          />
        </div>

        <div className="field">
          <label htmlFor="i-note">Poznámka</label>
          <textarea
            id="i-note"
            value={v.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>

        {error ? (
          <div style={{ color: "var(--red)", fontSize: 13 }}>{error}</div>
        ) : null}
      </div>
      <div className="dfoot">
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            if (!v.label.trim()) {
              setError("Vyplň název položky.");
              return;
            }
            onSave(v);
          }}
        >
          Uložit
        </button>
      </div>
    </>
  );
}

export function ItemDialog({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  /** null = nová položka */
  item: CatalogItem | null;
  onClose: () => void;
  onSave: (v: CatalogItemInput) => void;
}) {
  return (
    <Modal
      open={open}
      title={item ? "Úprava položky" : "Nová položka"}
      onClose={onClose}
    >
      <ItemForm
        key={item?.id ?? "nova"}
        item={item}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}
