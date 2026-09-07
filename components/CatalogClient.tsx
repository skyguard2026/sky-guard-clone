"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createCatalogItem,
  deleteCatalogItem,
  patchCatalogItem,
  resetCatalog,
  updateCatalogItem,
  type CatalogItemInput,
} from "@/app/actions/catalog";
import { ItemDialog } from "@/components/ItemDialog";
import { useToast } from "@/components/Toast";
import { CellInput, ConfirmButton, Toggle } from "@/components/ui";
import { BILL, CAT, DRIVER, GROUP } from "@/lib/labels";
import type { CatalogItem, Group } from "@/lib/types";
import { useWriteQueue } from "@/lib/use-write-queue";

const FILTERS: { v: Group | "all"; label: string }[] = [
  { v: "all", label: "Vše" },
  { v: "cam", label: "Sky Cam" },
  { v: "drone", label: "Sky Guard" },
  { v: "shared", label: "Společné" },
];

export function CatalogClient({ catalog }: { catalog: CatalogItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const { push, pushNow } = useWriteQueue();
  const [, startTransition] = useTransition();

  // Lokální kopie, aby psaní do ceny neblikalo. Struktura přijde ze serveru.
  const [items, setItems] = useState(catalog);
  const [filter, setFilter] = useState<Group | "all">("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item: CatalogItem | null }>(
    { open: false, item: null },
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filter === "all" || i.group === filter) &&
        (!q ||
          i.label.toLowerCase().includes(q) ||
          (i.note || "").toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  const patchLocal = (id: string, patch: Partial<CatalogItem>) =>
    setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const setPrice = (id: string, price: number) => {
    patchLocal(id, { price });
    push(`cat:${id}:price`, () => patchCatalogItem(id, { price }));
  };

  const setEnabled = (id: string, enabled: boolean) => {
    patchLocal(id, { enabled });
    pushNow(`cat:${id}:enabled`, () => patchCatalogItem(id, { enabled }));
  };

  const save = (v: CatalogItemInput) => {
    const editing = dialog.item;
    startTransition(async () => {
      const res = editing
        ? await updateCatalogItem(editing.id, v)
        : await createCatalogItem(v);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      setDialog({ open: false, item: null });
      toast(editing ? "Položka upravena" : "Položka přidána");
      router.refresh();
    });
  };

  const remove = (item: CatalogItem) => {
    setItems((p) => p.filter((i) => i.id !== item.id));
    startTransition(async () => {
      await deleteCatalogItem(item.id);
      toast("Položka smazána");
      router.refresh();
    });
  };

  const doReset = () => {
    startTransition(async () => {
      await resetCatalog();
      toast("Ceník obnoven do výchozího stavu");
      router.refresh();
    });
  };

  return (
    <>
      <div className="card">
        <h2>
          <span className="tag" />
          Nákladové položky
          <div className="right">
            <ConfirmButton
              className="btn sm"
              question="Vrátit katalog do výchozího stavu? Přepíše to všechny ručně upravené ceny. Klienti a lokality zůstanou."
              onConfirm={doReset}
            >
              Obnovit ceník
            </ConfirmButton>
            <button
              type="button"
              className="btn sm primary"
              onClick={() => setDialog({ open: true, item: null })}
            >
              Přidat položku
            </button>
          </div>
        </h2>
        <div className="body pad">
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div className="seg">
              {FILTERS.map((f) => (
                <button
                  key={f.v}
                  type="button"
                  aria-pressed={filter === f.v}
                  onClick={() => setFilter(f.v)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Hledat v názvech a poznámkách"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
              aria-label="Hledat v katalogu"
            />
            <span className="muted" style={{ fontSize: 12.5 }}>
              {rows.length} z {items.length} položek
            </span>
          </div>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Položka</th>
                <th className="n">Cena</th>
                <th>Driver</th>
                <th>Účtování</th>
                <th className="n">Životnost</th>
                <th>Sdílené</th>
                <th>Dopředu</th>
                <th className="n">Akce</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((it) => (
                  <tr key={it.id}>
                    <td className="name">
                      <div className="namewrap">
                        <em style={{ background: CAT[it.cat].c }} />
                        <div>
                          <div>
                            {it.label}{" "}
                            <span className="pill">{GROUP[it.group]}</span>
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {CAT[it.cat].n}
                            {it.note ? ` · ${it.note}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="n">
                      <CellInput
                        allowNegative
                        step={0.01}
                        label={`Cena ${it.label}`}
                        value={it.price}
                        onChange={(v) => setPrice(it.id, v ?? 0)}
                      />{" "}
                      <span className="muted">
                        {it.driver === "pctHw" ? "%" : "Kč"}
                      </span>
                    </td>
                    <td className="muted nw">{DRIVER[it.driver].n}</td>
                    <td className="nw">{BILL[it.billing]}</td>
                    <td className="n muted">{it.life ? `${it.life} m` : "—"}</td>
                    <td>
                      {it.shared ? (
                        <span className="pill">ano</span>
                      ) : (
                        <span className="muted">ne</span>
                      )}
                    </td>
                    <td>
                      {it.billing !== "yearly" ? (
                        <span className="muted">—</span>
                      ) : it.prepay ? (
                        <span className="pill">ano</span>
                      ) : (
                        <span className="muted">průběžně</span>
                      )}
                    </td>
                    <td className="n acts">
                      <span>
                        <Toggle
                          small
                          label={`Zapnout ${it.label}`}
                          on={it.enabled}
                          onChange={(v) => setEnabled(it.id, v)}
                        />
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => setDialog({ open: true, item: it })}
                        >
                          Upravit
                        </button>
                        <ConfirmButton
                          question={`Smazat položku „${it.label}"? Zmizí ze všech lokalit.`}
                          onConfirm={() => remove(it)}
                        >
                          Smazat
                        </ConfirmButton>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty">
                    <b>Nic neodpovídá filtru</b>
                    {query
                      ? `Hledáš „${query}" ve skupině ${
                          FILTERS.find((f) => f.v === filter)!.label
                        }. Zkus jiné slovo nebo přepni skupinu na Vše.`
                      : "V téhle skupině zatím žádná položka není."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="note">
          Ceny jsou nákupní. Nikdy se nesmí dostat do výstupu, který jde
          klientovi. Smazání položky uklidí odkazy na ni u všech lokalit.
        </div>
      </div>

      <ItemDialog
        open={dialog.open}
        item={dialog.item}
        onClose={() => setDialog({ open: false, item: null })}
        onSave={save}
      />
    </>
  );
}
