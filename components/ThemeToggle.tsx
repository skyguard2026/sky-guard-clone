"use client";

import { useSyncExternalStore } from "react";
import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

/**
 * Přepínač světlý/tmavý ve stylu iOS. Zapnutý stav = tmavý režim.
 *
 * Zdrojem pravdy je atribut data-theme na <html>: server ho nastaví z cookie,
 * úvodní skript případně z localStorage, a tenhle přepínač ho jen čte a
 * mění. Sleduje se přes MutationObserver, takže se přepínač srovná i tehdy,
 * když režim změní jiná záložka nebo skript.
 */
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => mo.disconnect();
}

export function ThemeToggle({ initial }: { initial: Theme }) {
  const theme = useSyncExternalStore(
    subscribe,
    () => parseTheme(document.documentElement.dataset.theme),
    () => initial,
  );

  const apply = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_COOKIE, t);
    } catch {
      /* soukromé okno bez úložiště — cookie stačí */
    }
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  };

  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      title={dark ? "Světlý režim" : "Tmavý režim"}
      className="theme-tgl"
      onClick={() => apply(dark ? "light" : "dark")}
    >
      <svg className="ic sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
      <svg className="ic moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M14.5 2.5a9.5 9.5 0 1 0 7 15.2A8 8 0 0 1 14.5 2.5Z" />
      </svg>
      <span className="knob" aria-hidden />
    </button>
  );
}
