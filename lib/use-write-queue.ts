"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fronta zápisů na server.
 *
 * Psaní do políčka nemá spustit zápis po každém znaku, ale ani se nesmí ztratit
 * poslední změna, když uživatel zavře tab. Proto debounce + vyprázdnění fronty
 * na visibilitychange a pagehide.
 *
 * Fronta je klíčovaná: stejný klíč se přepíše, takže z deseti úhozů do ceny
 * odejde jeden zápis s poslední hodnotou, ale změna v jiném poli se nezahodí.
 * Každý zápis nese jen svoje pole — nikdy celý objekt lokality, aby si dva lidé
 * pracující současně nepřepsali to, do čeho nesáhli.
 */
export function useWriteQueue(delay = 500) {
  const pending = useRef(new Map<string, () => Promise<unknown>>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(0);

  const run = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!pending.current.size) return;
    const jobs = Array.from(pending.current.values());
    pending.current.clear();
    setSaving((n) => n + jobs.length);
    for (const job of jobs) {
      Promise.resolve()
        .then(job)
        .catch((e) => console.error("Zápis selhal:", e))
        .finally(() => setSaving((n) => Math.max(0, n - 1)));
    }
  }, []);

  /** Naplánuje zápis s debouncem. */
  const push = useCallback(
    (key: string, job: () => Promise<unknown>) => {
      pending.current.set(key, job);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, delay);
    },
    [delay, run],
  );

  /** Zapíše hned — pro kliknutí, přepínače a výběry, kde není co sdružovat. */
  const pushNow = useCallback(
    (key: string, job: () => Promise<unknown>) => {
      pending.current.set(key, job);
      run();
    },
    [run],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") run();
    };
    const onPageHide = () => run();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      run();
    };
  }, [run]);

  return { push, pushNow, flush: run, saving };
}
