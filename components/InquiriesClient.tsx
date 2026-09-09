"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
import {
  inquiriesCsv,
  selectInquiries,
  type InquiryFilter,
  type InquirySort,
} from "@/lib/inquiry-view";
import { useToast } from "./Toast";
import { ConfirmButton, Modal, Segmented } from "./ui";

const dt = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function InquiriesClient({ inquiries }: { inquiries: Inquiry[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [filter, setFilter] = useState<InquiryFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<InquirySort>("newest");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [error, setError] = useState("");
  const detail = inquiries.find((q) => q.id === detailId);
  const counts = useMemo(() => {
    const c = { new: 0, contacted: 0, closed: 0, all: inquiries.length };
    for (const q of inquiries) c[q.status]++;
    return c;
  }, [inquiries]);
  const shown = useMemo(
    () => selectInquiries(inquiries, filter, query, sort),
    [inquiries, filter, query, sort],
  );
  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    message: string,
    close = false,
  ) => {
    if (busy.current) return;
    busy.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok)
          throw new Error(result.error || "Změnu se nepodařilo uložit.");
        toast(message);
        if (close) setDetailId(null);
        router.refresh();
      } catch {
        setError(
          "Změnu se nepodařilo uložit. Zkontrolujte připojení a zkuste to znovu. Rozepsaná poznámka zůstala zachovaná.",
        );
      } finally {
        busy.current = false;
      }
    });
  };
  const changeStatus = (q: Inquiry, status: InquiryStatus) =>
    run(
      () => setInquiryStatus(q.id, status),
      `Poptávka: ${STATUS_LABEL[status].toLowerCase()}`,
    );
  const openDetail = (q: Inquiry) => {
    setNoteText(q.note);
    setDetailId(q.id);
    setError("");
  };
  const closeDetail = () => {
    if (pending) return;
    if (
      detail &&
      noteText !== detail.note &&
      !window.confirm("Zavřít bez uložení poznámky?")
    )
      return;
    setDetailId(null);
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([inquiriesCsv(shown)], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `poptavky-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exportováno: ${shown.length} poptávek`);
  };
  return (
    <>
      <div className="inquiry-intro">
        <div>
          <span className="eyebrow">OBCHODNÍ PŘEHLED</span>
          <h2>Každá poptávka má svůj další krok.</h2>
          <p>
            Kontaktujte nové zájemce, zapište domluvu a mějte přehled o
            rozpracovaných příležitostech.
          </p>
        </div>
        <span className="inquiry-total">
          {counts.new}
          <small>čeká na kontakt</small>
        </span>
      </div>
      <div className="card">
        <div className="kpis inquiry-kpis">
          {(
            [
              {
                key: "new",
                title: "Nové",
                sub: "čekají na první kontakt",
                color: "blue",
              },
              {
                key: "contacted",
                title: "V řešení",
                sub: "rozpracované příležitosti",
                color: "warn",
              },
              {
                key: "closed",
                title: "Vyřízené",
                sub: "uzavřené poptávky",
                color: "good",
              },
              {
                key: "all",
                title: "Celkem",
                sub: "všechny přijaté poptávky",
                color: "",
              },
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.key}
              className="kpi"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              <span className="kpi-label">
                {item.title}
                <span aria-hidden="true">↗</span>
              </span>
              <div className={`v ${item.color}`}>{counts[item.key]}</div>
              <div className="sub">{item.sub}</div>
            </button>
          ))}
        </div>
      </div>
      <section className="card inquiry-panel" aria-label="Seznam poptávek">
        <div className="inquiry-toolbar">
          <div className="inquiry-search">
            <input
              type="search"
              aria-label="Hledat v poptávkách"
              placeholder="Hledat jméno, firmu, e-mail nebo zprávu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Řazení poptávek"
            value={sort}
            onChange={(e) => setSort(e.target.value as InquirySort)}
          >
            <option value="newest">Od nejnovějších</option>
            <option value="oldest">Od nejstarších</option>
          </select>
          <button
            type="button"
            className="btn"
            onClick={exportCsv}
            disabled={!shown.length}
          >
            Export CSV ↓
          </button>
        </div>
        <div className="inquiry-filters">
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
          <span className="muted" role="status">
            Zobrazeno {shown.length} z {inquiries.length}
          </span>
        </div>
        {error && !detail && (
          <div className="inquiry-error" role="alert">
            {error}
          </div>
        )}
        {!shown.length ? (
          <div className="empty inquiry-empty">
            <span className="empty-symbol" aria-hidden="true">
              ↗
            </span>
            <b>
              {inquiries.length
                ? "Žádná odpovídající poptávka"
                : "Tady začínají nové příležitosti"}
            </b>
            <p>
              {inquiries.length
                ? "Zkuste jiné hledání nebo zobrazte všechny stavy."
                : "Poptávky z kontaktního formuláře se zde objeví automaticky."}
            </p>
            {inquiries.length > 0 && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Zrušit filtry
              </button>
            )}
          </div>
        ) : (
          <div className="inquiry-list">
            {shown.map((q) => (
              <article
                className={`inquiry-row${q.status === "new" ? " is-new" : ""}`}
                key={q.id}
              >
                <div className="inquiry-avatar" aria-hidden="true">
                  {q.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="inquiry-person">
                  <button
                    type="button"
                    className="inquiry-name"
                    onClick={() => openDetail(q)}
                  >
                    {q.name}
                  </button>
                  <span>{q.company || objectTypeLabel(q.objectType)}</span>
                  <a href={`mailto:${q.email}`}>{q.email}</a>
                </div>
                <div className="inquiry-summary">
                  <span>{interestLabel(q.interest)}</span>
                  <p>{q.message || q.note || "Bez doplňující zprávy"}</p>
                </div>
                <div className="inquiry-meta">
                  <span className={`pill st-${q.status}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                  <time dateTime={q.createdAt}>{dt(q.createdAt)}</time>
                </div>
                <div className="inquiry-actions">
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => openDetail(q)}
                  >
                    Detail ↗
                  </button>
                  {q.status === "new" && (
                    <button
                      className="btn sm primary"
                      type="button"
                      disabled={pending}
                      onClick={() => changeStatus(q, "contacted")}
                    >
                      Řeším
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="note">
          Poznámky jsou interní. Klient je nevidí. Export obsahuje pouze právě
          zobrazené poptávky.
        </div>
      </section>
      <Modal
        open={Boolean(detail)}
        title={detail ? `Poptávka — ${detail.name}` : "Detail poptávky"}
        onClose={closeDetail}
      >
        {detail && (
          <>
            <div className="dbody inquiry-detail">
              <div className="detail-heading">
                <span className={`pill st-${detail.status}`}>
                  {STATUS_LABEL[detail.status]}
                </span>
                <time dateTime={detail.createdAt}>{dt(detail.createdAt)}</time>
              </div>
              <dl className="contact-grid">
                <div>
                  <dt>E-mail</dt>
                  <dd>
                    <a href={`mailto:${detail.email}`}>{detail.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>Telefon</dt>
                  <dd>
                    {detail.phone ? (
                      <a href={`tel:${detail.phone.replace(/[^+\d]/g, "")}`}>
                        {detail.phone}
                      </a>
                    ) : (
                      "Neuveden"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Společnost / objekt</dt>
                  <dd>
                    {detail.company || "Neuvedena"}
                    <small>{objectTypeLabel(detail.objectType)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Zájem</dt>
                  <dd>{interestLabel(detail.interest)}</dd>
                </div>
              </dl>
              <div className="inquiry-message">
                <h4>Zpráva od zájemce</h4>
                <p>
                  {detail.message || "Zájemce nepřipojil doplňující zprávu."}
                </p>
              </div>
              <div className="field">
                <label htmlFor="inq-status">Stav poptávky</label>
                <select
                  id="inq-status"
                  value={detail.status}
                  disabled={pending}
                  onChange={(e) =>
                    changeStatus(detail, e.target.value as InquiryStatus)
                  }
                >
                  <option value="new">Nová</option>
                  <option value="contacted">V řešení</option>
                  <option value="closed">Vyřízená</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="inq-note">Interní poznámka</label>
                <textarea
                  id="inq-note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  disabled={pending}
                  rows={5}
                  maxLength={4000}
                  placeholder="Co jste si domluvili a kdy se ozvat znovu…"
                />
                <div className="hint">
                  {noteText.length} / 4 000 znaků · vidí pouze váš tým
                </div>
              </div>
              {error && (
                <div className="inquiry-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="dfoot inquiry-detail-footer">
              <ConfirmButton
                disabled={pending}
                question={`Smazat poptávku od ${detail.name}? Nejde to vrátit.`}
                onConfirm={() =>
                  run(() => deleteInquiry(detail.id), "Poptávka smazána", true)
                }
              >
                Smazat
              </ConfirmButton>
              <span className="spacer" />
              <button
                className="btn"
                type="button"
                disabled={pending}
                onClick={closeDetail}
              >
                Zavřít
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={pending || noteText === detail.note}
                onClick={() =>
                  run(
                    () => setInquiryNote(detail.id, noteText),
                    "Poznámka uložena",
                    true,
                  )
                }
              >
                {pending ? "Ukládám…" : "Uložit poznámku"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
