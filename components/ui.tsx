"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Toggle({
  on,
  onChange,
  small,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  small?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`tgl${small ? " sm" : ""}`}
      aria-pressed={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Počty se zadávají tlačítky plus a minus, jak chce specifikace. */
export function Stepper({
  value,
  min = 0,
  max = 99,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  // Hodnota se odvozuje při renderu, ne v efektu — políčko si drží rozepsaný
  // text, ale jakmile se změní hodnota zvenčí, přepíše se.
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(String(value));
  }
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="step">
      <button
        type="button"
        aria-label={`${label} — ubrat`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <input
        type="number"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(clamp(Number(text) || 0))}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        type="button"
        aria-label={`${label} — přidat`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  );
}

/** Číselné pole s jednotkou. Hlásí změnu při psaní, ať se čísla přepočítají hned. */
export function NumberField({
  value,
  unit,
  onChange,
  label,
  step,
  width,
  style,
}: {
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  label: string;
  step?: number;
  width?: number;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <div className="num">
      <input
        type="number"
        aria-label={label}
        step={step}
        value={text}
        style={width ? { width, ...style } : style}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(String(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(0, n));
        }}
      />
      {unit ? <span>{unit}</span> : null}
    </div>
  );
}

/** Editovatelná buňka v tabulce. Prázdná hodnota může znamenat „nevyplněno". */
export function CellInput({
  value,
  onChange,
  width60,
  placeholder,
  allowEmpty,
  allowNegative,
  step,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  width60?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  allowNegative?: boolean;
  step?: number;
  label: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      className={`cell-in${width60 ? " w60" : ""}`}
      type="number"
      step={step}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(value == null ? "" : String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === "") {
          if (allowEmpty) onChange(null);
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        onChange(allowNegative ? n : Math.max(0, n));
      }}
    />
  );
}

/**
 * Modální dialog nad nativním <dialog>.
 *
 * Obsah se vykresluje jen když je otevřený, takže se formulář při každém
 * otevření namontuje znovu a načte si výchozí hodnoty z props. Díky tomu
 * není potřeba stav resetovat efektem.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <>
          <h3 id={titleId}>{title}</h3>
          {children}
        </>
      ) : null}
    </dialog>
  );
}

/** Tlačítko s potvrzením. Každá destruktivní akce ho musí mít. */
export function ConfirmButton({
  question,
  onConfirm,
  children,
  className = "btn sm danger",
  disabled,
  style,
}: {
  question: string;
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      style={style}
      onClick={() => {
        if (window.confirm(question)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}
