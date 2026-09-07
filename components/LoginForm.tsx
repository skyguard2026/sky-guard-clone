"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "@/app/actions/auth";

type Classes = { field?: string; label?: string; input?: string; button?: string; error?: string };
type Labels = { email?: string; password?: string; submit?: string; pending?: string };

const DEFAULT_CLASSES: Required<Classes> = {
  field: "field",
  label: "",
  input: "",
  button: "btn primary",
  error: "",
};

function Submit({ className, label, pending: pendingLabel }: { className: string; label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      style={className === DEFAULT_CLASSES.button ? { width: "100%", padding: "10px 14px" } : undefined}
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Jediný přihlašovací formulář. Vzhled se dá přepnout přes `classes`
 * (přihlašovací stránka ve stylu veřejného webu), logika je vždy stejná:
 * server action `login`, žádné vlastní API.
 */
export function LoginForm({
  next,
  classes,
  labels,
  placeholders,
}: {
  next: string;
  classes?: Classes;
  labels?: Labels;
  placeholders?: { email?: string; password?: string };
}) {
  const [state, formAction] = useActionState(login, {});
  const c = { ...DEFAULT_CLASSES, ...classes };
  const l = { email: "E-mail", password: "Heslo", submit: "Vstoupit", pending: "Přihlašuji…", ...labels };
  return (
    <form action={formAction}>
      <input type="hidden" name="dal" value={next} />
      <div className={c.field} style={c.field === "field" ? { marginTop: 0 } : undefined}>
        <label htmlFor="email" className={c.label || undefined}>{l.email}</label>
        <input
          id="email"
          name="email"
          type="email"
          className={c.input || undefined}
          placeholder={placeholders?.email}
          autoFocus
          autoComplete="username"
          required
        />
      </div>
      <div className={c.field}>
        <label htmlFor="password" className={c.label || undefined}>{l.password}</label>
        <input
          id="password"
          name="password"
          type="password"
          className={c.input || undefined}
          placeholder={placeholders?.password}
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error ? (
        <div
          className={c.error || undefined}
          style={c.error ? undefined : { color: "var(--red)", fontSize: 13, margin: "-4px 0 12px" }}
        >
          {state.error}
        </div>
      ) : null}
      <Submit className={c.button} label={l.submit} pending={l.pending} />
    </form>
  );
}
