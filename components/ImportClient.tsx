"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeImport, saveStatement } from "@/app/actions/finance";
import { decodeStatement } from "@/lib/bank/decode";
import { parseBankStatement, type ParsedStatement } from "@/lib/bank/parse";
import type { BankImport } from "@/lib/bank/types";
import { money, plural } from "@/lib/format";
import { ConfirmButton } from "./ui";
import { useToast } from "./Toast";

interface Picked {
  filename: string;
  text: string;
  encoding: string;
  statement: ParsedStatement;
}

const FIELD_LABELS: Record<string, string> = {
  bookedAt: "Datum zaúčtování",
  valueDate: "Datum provedení",
  account: "Vlastní účet",
  accountName: "Název účtu",
  amount: "Částka",
  currency: "Měna",
  counterAccount: "Protiúčet",
  counterName: "Protistrana",
  vs: "Variabilní symbol",
  ks: "Konstantní symbol",
  ss: "Specifický symbol",
  message: "Zpráva pro příjemce",
  note: "Poznámka",
  txType: "Typ transakce",
  fee: "Poplatek",
  externalId: "ID transakce",
};

export function ImportClient({ imports }: { imports: BankImport[] }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  /**
   * Soubor se čte a parsuje **v prohlížeči**, protože parser je čistá funkce
   * bez závislostí. Náhled je tím okamžitý a na server nejde nic, dokud
   * uživatel nepotvrdí. Při potvrzení se posílá text výpisu, ne hotové řádky —
   * server si ho parsuje znovu a klientovi nevěří.
   */
  async function pick(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const d = decodeStatement(bytes);
      setPicked({
        filename: file.name,
        text: d.text,
        encoding: d.encoding,
        statement: parseBankStatement(d.text),
      });
    } catch {
      toast("Soubor se nepodařilo přečíst.");
    }
  }

  function save() {
    if (!picked) return;
    startSave(async () => {
      const res = await saveStatement(picked.filename, picked.text);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      toast(
        res.newCount
          ? `Uloženo ${res.newCount} ${plural(res.newCount, "transakce", "transakce", "transakcí")}` +
              (res.dupeCount ? `, ${res.dupeCount} už bylo v databázi` : "")
          : "Všechny transakce už v databázi byly",
      );
      setPicked(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  const s = picked?.statement;
  const mapped = s
    ? (Object.entries(s.mapping) as [string, string | null][]).filter(
        ([, v]) => v,
      )
    : [];

  return (
    <>
      <div className="card">
        <h2>
          Vyber soubor
          <small>výpis z internetového bankovnictví — XML (camt.053) nebo CSV</small>
        </h2>
        <div className="body pad">
          <div
            className={`drop${dragging ? " on" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pick(f);
            }}
          >
            <p style={{ marginBottom: 12 }}>
              Přetáhni sem výpis, nebo ho vyber tlačítkem. Z Raiffeisenbank
              stáhni formát XML.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xml,.csv,text/xml,application/xml,text/csv,text/plain"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f);
              }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => fileRef.current?.click()}
            >
              Vybrat soubor
            </button>
            <p className="hint" style={{ marginTop: 14, fontSize: 12 }}>
              Nic se neuloží, dokud si náhled neprohlédneš a nepotvrdíš ho.
            </p>
          </div>
        </div>
      </div>

      {picked && s ? (
        <>
          <div className="card" style={{ marginTop: 18 }}>
            <h2>
              Náhled
              <small>
                {picked.filename} · {s.format === "camt053" ? "camt.053 (XML)" : "CSV"}
                {s.format === "csv"
                  ? ` · kódování ${picked.encoding} · oddělovač ${s.delimiter === "\t" ? "tabulátor" : s.delimiter}`
                  : ""}
              </small>
              <span className="right">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPicked(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Zahodit
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!s.ok || saving}
                  onClick={save}
                >
                  {saving
                    ? "Ukládám…"
                    : `Uložit ${s.rows.length} ${plural(s.rows.length, "transakci", "transakce", "transakcí")}`}
                </button>
              </span>
            </h2>

            {!s.ok ? (
              <div className="body">
                <div className="empty">
                  <b>Tenhle soubor se naimportovat nedá</b>
                  {s.problems[0]?.detail ??
                    "Soubor nevypadá jako bankovní výpis."}
                </div>
              </div>
            ) : (
              <>
                <div className="map-grid">
                  {mapped.map(([field, header]) => (
                    <div key={field}>
                      <span>{FIELD_LABELS[field] ?? field}</span>
                      <b>{header}</b>
                    </div>
                  ))}
                </div>
                {s.unmapped.length ? (
                  <p className="note" style={{ margin: "0 14px 14px" }}>
                    Nepoužité sloupce: {s.unmapped.join(", ")}. Uloží se
                    do původního záznamu, jen se z nich nic nepočítá.
                  </p>
                ) : null}
              </>
            )}
          </div>

          {s.problems.length ? (
            <div className="card" style={{ marginTop: 18 }}>
              <h2>
                Řádky, které se nenaimportují
                <small>
                  {s.problems.length}{" "}
                  {plural(s.problems.length, "řádek", "řádky", "řádků")} —
                  projdi je ve výpisu, než potvrdíš
                </small>
              </h2>
              <div className="body">
                <ul className="problems">
                  {s.problems.map((p, i) => (
                    <li key={i}>
                      <span className="ln tnum">řádek {p.line}</span>
                      {p.detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {s.ok ? (
            <div className="card" style={{ marginTop: 18 }}>
              <h2>
                První řádky
                <small>
                  {s.periodFrom} – {s.periodTo}
                  {s.account ? ` · účet ${s.account}` : ""}
                </small>
              </h2>
              <div className="body">
                <div className="scroll-x">
                  <table>
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Protistrana</th>
                        <th className="hide-narrow">Zpráva</th>
                        <th className="n">Částka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.slice(0, 12).map((r, i) => (
                        <tr key={i}>
                          <td className="tnum">{r.bookedAt}</td>
                          <td>{r.counterName || "—"}</td>
                          <td className="hide-narrow" style={{ color: "var(--tx-3)" }}>
                            {r.message}
                          </td>
                          <td
                            className="n tnum"
                            style={{
                              color: r.amount < 0 ? "var(--tx)" : "var(--green)",
                            }}
                          >
                            {money(r.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {s.rows.length > 12 ? (
                  <p className="note" style={{ margin: 14 }}>
                    …a dalších {s.rows.length - 12}.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          Nahrané výpisy
          <small>historie importů</small>
        </h2>
        <div className="body">
          {imports.length ? (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Soubor</th>
                    <th className="hide-narrow">Období</th>
                    <th className="n">Nových</th>
                    <th className="n">Duplicit</th>
                    <th className="n hide-narrow">Odmítnuto</th>
                    <th className="hide-narrow">Nahráno</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {imports.map((i) => (
                    <tr key={i.id}>
                      <td>{i.filename}</td>
                      <td className="tnum hide-narrow" style={{ color: "var(--tx-3)" }}>
                        {i.periodFrom && i.periodTo
                          ? `${i.periodFrom} – ${i.periodTo}`
                          : "—"}
                      </td>
                      <td className="n tnum">{i.newCount}</td>
                      <td className="n tnum" style={{ color: "var(--tx-3)" }}>
                        {i.dupeCount}
                      </td>
                      <td className="n tnum hide-narrow" style={{ color: "var(--tx-3)" }}>
                        {i.problemCount}
                      </td>
                      <td className="tnum hide-narrow" style={{ color: "var(--tx-3)" }}>
                        {new Date(i.importedAt).toLocaleDateString("cs-CZ")}
                      </td>
                      <td className="n">
                        <ConfirmButton
                          className="btn sm danger"
                          question={`Vrátit import ${i.filename}? Smaže to ${i.newCount} ${plural(i.newCount, "transakci", "transakce", "transakcí")} včetně jejich ručního zařazení.`}
                          onConfirm={async () => {
                            await removeImport(i.id);
                            toast("Import vrácen");
                            router.refresh();
                          }}
                        >
                          Vrátit
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <b>Zatím tu není žádný výpis</b>
              Vyber CSV soubor nahoře a nahraj první.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
