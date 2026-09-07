"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2100);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className={`toast${msg ? " on" : ""}`} role="status" aria-live="polite">
        {msg ?? ""}
      </div>
    </Ctx.Provider>
  );
}
