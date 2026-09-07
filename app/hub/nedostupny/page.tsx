import { WebFrame } from "@/components/web/WebFrame";

export const metadata = { title: "Sky Guard Hub - Náhled", robots: { index: false, follow: false } };

/**
 * Sem bránu přepne proxy, když chybí připojení k databázi — tedy na každém
 * preview deploymentu. Stránka nesmí sáhnout do databáze ani do session.
 */
export default function HubUnavailablePage() {
  return (
    <WebFrame title="Hub není v náhledu dostupný.">
      <p style={{ maxWidth: 520, marginTop: 24, color: "#D5D5D5" }}>
        Tohle je náhledové nasazení bez připojení k datům. Sky Guard Hub běží
        jen na ostré adrese <a href="https://www.sky-guard.cz/hub" style={{ color: "#F5F5F5" }}>www.sky-guard.cz/hub</a>.
        Veřejný web funguje i tady.
      </p>
    </WebFrame>
  );
}
