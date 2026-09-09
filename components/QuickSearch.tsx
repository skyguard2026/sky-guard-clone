"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationWithClient } from "@/lib/types";
import { hub } from "@/lib/hub-path";
import { Modal } from "./ui";

export function QuickSearch({
  pages,
  locations,
  pick,
}: {
  pages: { href: string; label: string }[];
  locations: LocationWithClient[];
  pick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const show = () => {
    setQuery("");
    setOpen(true);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        setQuery("");
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const term = normalize(query.trim());
  const matches = [
    ...pages.map((p) => ({ ...p, type: "Sekce", id: p.href, location: false })),
    ...locations.map((l) => ({
      href: hub("/"),
      label: `${l.clientName} — ${l.name}`,
      type: "Lokalita",
      id: l.id,
      location: true,
    })),
  ].filter((p) => normalize(p.label + " " + p.href).includes(term));
  const go = (item: (typeof matches)[number]) => {
    setOpen(false);
    if (item.location) pick(item.id);
    router.push(item.href);
  };
  return (
    <>
      <button
        type="button"
        className="hub-search"
        onClick={show}
        aria-label="Hledat v Hubu"
      >
        <svg
          aria-hidden="true"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <circle cx="10" cy="10" r="6" />
          <path d="m15 15 5 5" />
        </svg>
        <span>Hledat v Hubu</span>
        <kbd>⌘ / Ctrl K</kbd>
      </button>
      <Modal
        open={open}
        title="Kam chcete přejít?"
        onClose={() => setOpen(false)}
      >
        <div className="dbody quick-search-body">
          <input
            autoFocus
            type="search"
            aria-label="Název sekce nebo lokality"
            placeholder="Sekce, klient nebo lokalita…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) {
                e.preventDefault();
                go(matches[0]);
              }
            }}
          />
          <div className="quick-results" aria-label="Výsledky hledání">
            {matches.map((item) => (
              <button
                className="quick-result"
                type="button"
                key={`${item.type}-${item.id}`}
                onClick={() => go(item)}
              >
                <span>
                  {item.label}
                  <small>{item.type}</small>
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
            {!matches.length && (
              <div className="empty">
                <b>Nic jsme nenašli</b>Zkuste jiný název sekce nebo lokality.
              </div>
            )}
          </div>
        </div>
        <div className="dfoot">
          <span className="muted">Enter otevře první výsledek</span>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Zavřít
          </button>
        </div>
      </Modal>
    </>
  );
}
