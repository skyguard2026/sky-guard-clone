"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn primary"
      style={{ width: "100%", padding: "10px 14px" }}
      disabled={pending}
    >
      {pending ? "Ukládám…" : "Nastavit heslo"}
    </button>
  );
}

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(changePassword, {});
  return (
    <form action={formAction}>
      {email ? (
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Přihlášen jako {email}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="nove">Nové heslo</label>
        <input
          id="nove"
          name="nove"
          type="password"
          autoFocus
          autoComplete="new-password"
          required
          minLength={12}
        />
        <div className="hint">Aspoň 12 znaků. Delší heslo je lepší než složité.</div>
      </div>
      <div className="field">
        <label htmlFor="znovu">Heslo znovu</label>
        <input id="znovu" name="znovu" type="password" autoComplete="new-password" required />
      </div>
      {state?.error ? (
        <div style={{ color: "var(--red)", fontSize: 13, margin: "-4px 0 12px" }}>
          {state.error}
        </div>
      ) : null}
      <Submit />
    </form>
  );
}
