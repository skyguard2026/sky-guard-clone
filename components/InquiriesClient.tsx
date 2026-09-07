"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteInquiry,
  setInquiryNote,
  setInquiryStatus,
} from "@/app/actions/inquiries";
import {
  interestLabel,
  objectTypeLabel,
  STATUS_LABEL,
  type Inquiry,
  type InquiryStatus,
} from "@/lib/inquiries";
import { useToast } from "./Toast";
import { ConfirmButton, Modal, Segmented } from "./ui";

type Filter = "all" | InquiryStatus;

const dt = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function InquiriesClient({ inquiries }: { inquiries: Inquiry[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [noteDlg, setNoteDlg] = useState<Inquiry | null>(null);
  const [noteText, setNoteText] = useState("");

  const counts = useMemo(() => {
    const c = { new: 0, contacted: 0, closed: 0 };
    for (const q of inquiries) c[q.status]++;
    return c;
  }, [inquiries]);

  const shown = useMemo(
    () => (filter === "all" ? inquiries : inquiries.filter((q) => q.status === filter)),
    [inquiries, filter],
  );

  const changeStatus = (q: Inquiry, status: InquiryStatus) =>
    startTransition(async () => {
      const res = await setInquiryStatus(q.id, status);
      if (!res.ok) return toast(res.error);
      toast(`Poptávka: ${STATUS_LABEL[status].toLowerCase()}`);
      router.refresh();
    });

  const remove = (q: Inquiry) =>
    startTransition(async () => {
      await deleteInquiry(q.id);
      toast("Poptávka smazána");
      router.refresh();
    });

  const openNote = (q: Inquiry) => {
    setNoteText(q.note);
    setNoteDlg(q);
  };
  const saveNote = () => {
    const q = noteDlg;
    if (!q) return;
    startTransition(async () => {
      await setInquiryNote(q.id, noteText);
      setNoteDlg(null);
      toast("Poznámka uložena");
      router.refresh();
    });
  };

  return (
    <>
      <div className="card">
        <div className="kpis">
          <div className="kpi">
            <label>Nové</label>
            <div className={`v ${counts.new > 0 ? "blue" : ""}`}>{counts.new}</div>
            <div className="sub">čekají na první kontakt</div>
          </div>
          <div className="kpi">
            <label>V řešení</label>
            <div className={`v ${counts.contacted > 0 ? "warn" : ""}`}>{counts.contacted}</div>
            <div className="sub">už jste se ozvali</div>
          </div>
          <div className="kpi">
            <label>Vyřízené</label>
            <div className={`v ${counts.closed > 0 ? "good" : ""}`}>{counts.closed}</div>
            <div className="sub">uzavřené poptávky</div>
          </div>
          <div className="kpi">
            <label>Celkem</label>
            <div className="v">{inquiries.length}</div>
            <div className="sub">od spuštění formuláře</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>
          <span className="tag" />
          Poptávky
          <span className="right">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { v: "all", label: "Vše" },
                { v: "new", label: "Nové" },
                { v: "contacted", label: "V řešení" },
                { v: "closed", label: "Vyřízené" },
              ]}
            />
          </span>
        </h2>

        {shown.length === 0 ? (
          <div className="empty">
            <b>
              {inquiries.length === 0
                ? "Zatím žádná poptávka"
                : "V tomhle filtru nic není"}
            </b>
            {inquiries.length === 0
              ? "Formulář „Domluvte si s námi ukázku“ na webu ukládá poptávky sem."
              : "Zkuste jiný stav."}
          </div>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Přijato</th>
                  <th>Kontakt</th>
                  <th className="hide-narrow">Objekt</th>
                  <th className="hide-narrow">Zajímá</th>
                  <th>Stav</th>
                  <th>Poznámka</th>
                  <th className="n">Akce</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((q) => (
                  <tr key={q.id}>
                    <td className="nw muted tnum">{dt(q.createdAt)}</td>
                    <td className="name">
                      <b style={{ fontWeight: q.status === "new" ? 700 : 500 }}>
                        {q.name}
                      </b>
                      {q.company ? <div className="muted">{q.company}</div> : null}
                      <div style={{ marginTop: 3, fontSize: 12.5 }}>
                        <a href={`mailto:${q.email}`} style={{ color: "var(--blue)" }}>
                          {q.email}
                        </a>
                        {q.phone ? (
                          <>
                            {" · "}
                            <a href={`tel:${q.phone.replace(/\s+/g, "")}`} style={{ color: "var(--blue)" }}>
                              {q.phone}
                            </a>
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="hide-narrow">{objectTypeLabel(q.objectType)}</td>
                    <td className="hide-narrow">{interestLabel(q.interest)}</td>
                    <td className="nw">
                      <span className={`pill st-${q.status}`}>{STATUS_LABEL[q.status]}</span>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      {q.note ? (
                        <span className="muted" style={{ fontSize: 13 }}>
                          {q.note.length > 90 ? q.note.slice(0, 90) + "…" : q.note}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="acts n">
                      <span>
                        <button type="button" className="btn sm" onClick={() => openNote(q)}>
                          Poznámka
                        </button>
                        {q.status === "new" ? (
                          <button
                            type="button"
                            className="btn sm primary"
                            onClick={() => changeStatus(q, "contacted")}
                          >
                            Řeším
                          </button>
                        ) : null}
                        {q.status !== "closed" ? (
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => changeStatus(q, "closed")}
                          >
                            Vyřízeno
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => changeStatus(q, "contacted")}
                          >
                            Otevřít znovu
                          </button>
                        )}
                        <ConfirmButton
                          question={`Smazat poptávku od ${q.name}? Nejde to vrátit.`}
                          onConfirm={() => remove(q)}
                        >
                          Smazat
                        </ConfirmButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="note">
          Poptávku odešle návštěvník webu formulářem v sekci Kontakt. Nová
          poptávka čeká na první kontakt; jakmile se ozvete, přepněte ji na
          „Řeším“, po uzavření na „Vyřízeno“. Poznámka je interní, klient ji
          nevidí.
        </div>
      </div>

      <Modal
        open={noteDlg !== null}
        title={noteDlg ? `Poznámka — ${noteDlg.name}` : "Poznámka"}
        onClose={() => setNoteDlg(null)}
      >
        {noteDlg ? (
          <>
            <div className="dbody">
              <div className="field">
                <label htmlFor="inq-note">Interní poznámka</label>
                <textarea
                  id="inq-note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={5}
                  placeholder="Co jste si domluvili, kdy se ozvat znovu…"
                />
                <div className="hint">
                  {noteDlg.company ? `${noteDlg.company} · ` : ""}
                  {noteDlg.email}
                  {noteDlg.phone ? ` · ${noteDlg.phone}` : ""}
                  {" · "}
                  {objectTypeLabel(noteDlg.objectType)}
                  {noteDlg.interest ? ` · ${interestLabel(noteDlg.interest)}` : ""}
                </div>
              </div>
            </div>
            <div className="dfoot">
              <button type="button" className="btn" onClick={() => setNoteDlg(null)}>
                Zrušit
              </button>
              <button type="button" className="btn primary" onClick={saveNote}>
                Uložit
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
