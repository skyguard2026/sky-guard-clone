"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createOfferAction,
  deleteOfferAction,
  renderOfferPdfAction,
  setOfferStatusAction,
  type NewOfferInput,
} from "@/app/actions/offers";
import { OfferDialog } from "@/components/OfferDialog";
import { useToast } from "@/components/Toast";
import { ConfirmButton } from "@/components/ui";
import { money } from "@/lib/format";
import type { OfferTextWarning } from "@/lib/offer-guard";
import { OFFER_STATUS_LABEL, type Offer, type OfferStatus } from "@/lib/offer-types";
import type { LocationWithClient } from "@/lib/types";

const STATUS_COLOR: Record<OfferStatus, string> = {
  draft: "var(--tx-3)",
  odeslana: "var(--blue)",
  prijata: "var(--green)",
  odmitnuta: "var(--red)",
};

const dateCs = (iso: string) =>
  new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

function download(base64: string, fileName: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function OffersCard({
  location,
  offers,
}: {
  location: LocationWithClient;
  offers: Offer[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{
    open: boolean;
    previous: Offer | null;
    warnings: OfferTextWarning[];
  }>({ open: false, previous: null, warnings: [] });
  const [busy, setBusy] = useState<string | null>(null);

  const openDialog = (previous: Offer | null) =>
    setDialog({ open: true, previous, warnings: [] });
  const closeDialog = () =>
    setDialog({ open: false, previous: null, warnings: [] });

  const save = (
    v: Omit<NewOfferInput, "locationId">,
    acknowledge: boolean,
  ) => {
    startTransition(async () => {
      const res = await createOfferAction({
        ...v,
        locationId: location.id,
        acknowledgeWarnings: acknowledge,
      });
      if (!res.ok) {
        // Server našel v textu značku nebo interní výraz. Ukážeme nález
        // v dialogu a necháme uživatele pokračovat vědomě.
        if ("warnings" in res && res.warnings?.length) {
          setDialog((d) => ({ ...d, warnings: res.warnings }));
        }
        return toast(res.error);
      }
      closeDialog();
      toast(
        res.version > 1
          ? `Nabídka ${res.number} verze ${res.version} vytvořena`
          : `Nabídka ${res.number} vytvořena`,
      );
      router.refresh();
    });
  };

  const changeStatus = (id: string, status: OfferStatus) => {
    startTransition(async () => {
      const res = await setOfferStatusAction(id, status);
      if (!res.ok) return toast(res.error);
      router.refresh();
    });
  };

  const pdf = async (o: Offer, acknowledge = false) => {
    setBusy(o.id);
    try {
      const res = await renderOfferPdfAction(o.id, acknowledge);
      if (!res.ok) {
        // Kontrola běží znovu těsně před tiskem — nabídka mohla vzniknout
        // dřív, než se seznam zakázaných výrazů doplnil.
        if ("warnings" in res && res.warnings?.length) {
          const nalez = res.warnings
            .map((w) => `${w.fieldLabel}: ${w.terms.join(", ")}`)
            .join("\n");
          const dal = window.confirm(
            `V nabídce ${o.number} je značka nebo interní výraz:\n\n${nalez}\n\n` +
              "Tenhle dokument jde klientovi. Vygenerovat i tak?",
          );
          if (dal) {
            setBusy(null);
            return pdf(o, true);
          }
          return;
        }
        toast(res.error);
        return;
      }
      download(res.base64, res.fileName);
      toast("PDF staženo");
    } catch {
      toast("PDF se nepodařilo vygenerovat");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="card">
        <h2>
          <span className="tag" style={{ background: "var(--amber)" }} />
          Nabídky
          <div className="right">
            <span className="muted" style={{ fontSize: 12.5 }}>
              {offers.length ? `${offers.length} nabídek` : "zatím žádná"}
            </span>
            <button
              type="button"
              className="btn sm primary"
              disabled={pending}
              onClick={() => openDialog(null)}
            >
              Nová nabídka
            </button>
          </div>
        </h2>

        {offers.length ? (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Číslo</th>
                  <th>Stav</th>
                  <th className="n">Měsíčně</th>
                  <th className="n">Zřízení</th>
                  <th className="n">Závazek</th>
                  <th>Vystaveno</th>
                  <th>Platí do</th>
                  <th className="n">Akce</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td className="nw">
                      <b>{o.number}</b>
                      {o.version > 1 ? (
                        <span className="pill" style={{ marginLeft: 6 }}>
                          v{o.version}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <select
                        aria-label={`Stav nabídky ${o.number}`}
                        value={o.status}
                        style={{
                          padding: "4px 8px",
                          width: "auto",
                          fontSize: 12.5,
                          color: STATUS_COLOR[o.status],
                        }}
                        onChange={(e) =>
                          changeStatus(o.id, e.target.value as OfferStatus)
                        }
                      >
                        {(
                          Object.keys(OFFER_STATUS_LABEL) as OfferStatus[]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {OFFER_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="n">{money(o.monthlyPrice)}</td>
                    <td className="n">{money(o.setupFee)}</td>
                    <td className="n">{o.commitmentMonths} m</td>
                    <td className="nw muted">{dateCs(o.createdAt)}</td>
                    <td className="nw muted">{dateCs(o.validUntil)}</td>
                    <td className="n acts">
                      <span>
                        <button
                          type="button"
                          className="btn sm"
                          disabled={busy === o.id}
                          onClick={() => pdf(o)}
                        >
                          {busy === o.id ? "Generuji…" : "PDF"}
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          disabled={pending}
                          onClick={() => openDialog(o)}
                        >
                          Nová verze
                        </button>
                        {o.status === "draft" ? (
                          <ConfirmButton
                            question={`Smazat rozpracovanou nabídku ${o.number}?`}
                            onConfirm={() =>
                              startTransition(async () => {
                                const res = await deleteOfferAction(o.id);
                                if (!res.ok) return toast(res.error);
                                toast("Nabídka smazána");
                                router.refresh();
                              })
                            }
                          >
                            Smazat
                          </ConfirmButton>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <b>Zatím žádná nabídka</b>
            Nabídka zamrazí aktuální čísla, takže pozdější změny katalogu s ní
            už nehnou.
          </div>
        )}

        <div className="note">
          PDF obsahuje jen měsíční cenu, poplatek za zřízení, dobu závazku
          a rozsah služby. Nákupní ceny, marže ani návratnost se do něj
          nedostanou.
        </div>
      </div>

      <OfferDialog
        open={dialog.open}
        location={location}
        previous={dialog.previous}
        warnings={dialog.warnings}
        onClose={closeDialog}
        onSave={save}
      />
    </>
  );
}
