"use client";

import { useState } from "react";
import type { NewOfferInput } from "@/app/actions/offers";
import { Modal } from "@/components/ui";
import { money } from "@/lib/format";
import { defaultScope } from "@/lib/offer";
import { OFFER_VALID_DAYS } from "@/lib/defaults";
import type { OfferTextWarning } from "@/lib/offer-guard";
import type { Offer } from "@/lib/offer-types";
import type { LocationWithClient } from "@/lib/types";

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function OfferForm({
  location,
  previous,
  warnings,
  onClose,
  onSave,
}: {
  location: LocationWithClient;
  /** Vyplněné, když se dělá nová verze. */
  previous: Offer | null;
  /** Zakázané výrazy nalezené serverem v textu nabídky. */
  warnings: OfferTextWarning[];
  onClose: () => void;
  onSave: (
    v: Omit<NewOfferInput, "locationId">,
    acknowledge: boolean,
  ) => void;
}) {
  // Z předchozí nabídky se přebírá jen text a doba závazku.
  // Cena a poplatek se berou z lokality, aby verze 2 odrážela nový výpočet.
  const [scope, setScope] = useState(
    previous?.scope ??
      defaultScope(location.product, {
        cameras: location.cameras,
        camerasTlBig: location.camerasTlBig,
        camerasTlSmall: location.camerasTlSmall,
        poles: location.poles,
        docks: location.docks,
      }),
  );
  const [note, setNote] = useState(previous?.note ?? "");
  const [commitment, setCommitment] = useState(
    previous?.commitmentMonths ?? location.commitmentMonths,
  );
  const [validUntil, setValidUntil] = useState(isoPlusDays(OFFER_VALID_DAYS));
  const [error, setError] = useState("");

  return (
    <>
      <div className="dbody">
        <div
          className="note"
          style={{
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "12px 14px",
            marginTop: 4,
          }}
        >
          Do nabídky se zamrazí aktuální stav lokality a katalogu. Měsíční cena{" "}
          <b style={{ color: "var(--tx)" }}>{money(location.price)}</b> a
          poplatek za zřízení{" "}
          <b style={{ color: "var(--tx)" }}>{money(location.setupFee)}</b> se
          berou z Kalkulace — pozdější změny už s hotovou nabídkou nehnou.
        </div>

        <div className="field">
          <label htmlFor="o-scope">Rozsah služby</label>
          <textarea
            id="o-scope"
            style={{ minHeight: 150 }}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
          <div className="hint">
            Tenhle text uvidí klient v PDF. Nepiš do něj značky ani modelová
            označení techniky.
          </div>
        </div>

        <div className="f2">
          <div className="field">
            <label htmlFor="o-commitment">Doba závazku v měsících</label>
            <input
              id="o-commitment"
              className="plain"
              type="number"
              min={0}
              value={commitment}
              onChange={(e) => setCommitment(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="o-valid">Platnost do</label>
            <input
              id="o-valid"
              className="plain"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="o-note">Poznámka pro klienta</label>
          <textarea
            id="o-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="hint">
            Volitelné. Objeví se pod cenou. Interní poznámky sem nepatří.
          </div>
        </div>

        {warnings.length ? (
          <div className="note alarm" style={{ borderRadius: 8, border: "1px solid rgba(245,181,68,.35)" }}>
            Tohle by nemělo jít klientovi:
            <ul>
              {warnings.map((w) => (
                <li key={w.field}>
                  <b>{w.fieldLabel}</b> — {w.terms.join(", ")}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 8 }}>
              Hardware se pojmenovává obecně, bez značky a modelu. Přepiš text,
              nebo pokračuj vědomě tlačítkem vpravo.
            </div>
          </div>
        ) : null}

        {error ? (
          <div style={{ color: "var(--red)", fontSize: 13, marginTop: 10 }}>
            {error}
          </div>
        ) : null}
      </div>
      <div className="dfoot">
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
        <button
          type="button"
          className={warnings.length ? "btn" : "btn primary"}
          onClick={() => {
            if (!scope.trim()) {
              setError("Vyplň rozsah služby.");
              return;
            }
            onSave(
              {
                scope,
                note,
                commitmentMonths: commitment,
                validUntil: new Date(`${validUntil}T12:00:00`).toISOString(),
                baseNumber: previous?.number,
              },
              warnings.length > 0,
            );
          }}
        >
          {warnings.length
            ? "Vytvořit i tak"
            : previous
              ? "Vytvořit novou verzi"
              : "Vytvořit nabídku"}
        </button>
      </div>
    </>
  );
}

export function OfferDialog({
  open,
  location,
  previous,
  warnings,
  onClose,
  onSave,
}: {
  open: boolean;
  location: LocationWithClient;
  previous: Offer | null;
  warnings: OfferTextWarning[];
  onClose: () => void;
  onSave: (
    v: Omit<NewOfferInput, "locationId">,
    acknowledge: boolean,
  ) => void;
}) {
  return (
    <Modal
      open={open}
      title={
        previous
          ? `Nová verze nabídky ${previous.number}`
          : "Nová cenová nabídka"
      }
      onClose={onClose}
    >
      <OfferForm
        key={previous?.id ?? "nova"}
        location={location}
        previous={previous}
        warnings={warnings}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}
