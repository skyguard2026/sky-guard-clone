import { WebFrame } from "@/components/web/WebFrame";
import { LoginForm } from "@/components/LoginForm";
import { HUB } from "@/lib/hub-path";
import styles from "./login.module.css";

export const metadata = {
  title: "Sky Guard Hub - Přihlášení",
  description: "Sky Guard Hub – přihlášení do správy autonomní dronové ostrahy 24/7.",
};

/**
 * Vzhled je stránka „Sky Guard Hub — Přihlášení" z veřejného webu; formulář
 * je skutečné přihlášení kalkulačky (e-mail + heslo, argon2id, zámek po
 * pěti neúspěších). Do databáze sahá až odeslaná akce, samotná stránka ne.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ dal?: string }>;
}) {
  const { dal } = await searchParams;
  return (
    <WebFrame title="Přihlášení do správy systému.">
      <div className={styles.card}>
        <LoginForm
          next={dal ?? HUB}
          labels={{ email: "E-mail*", password: "Heslo*", submit: "Přihlásit se", pending: "Přihlašuji…" }}
          placeholders={{ email: "E-mail", password: "Heslo" }}
          classes={{
            field: styles.field,
            label: styles.label,
            input: styles.input,
            button: styles.button,
            error: styles.error,
          }}
        />
        <p className={styles.note}>Interní nástroj Sky Guard s.r.o. Přístup mají jen pozvané účty.</p>
      </div>
    </WebFrame>
  );
}
