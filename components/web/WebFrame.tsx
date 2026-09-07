import Image from "next/image";
import styles from "./web.module.css";
import { PUBLIC_SITE, webUrl } from "@/lib/public-site";

/**
 * Rám ve vzhledu veřejného webu pro stránky, které stojí před bránou:
 * přihlášení a náhled bez databáze. Aplikace sama má vlastní Shell.
 * Odkazy vedou na veřejný web (PUBLIC_SITE), ne do aplikace.
 */
export function WebFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.lines} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href={PUBLIC_SITE} className={styles.logo} aria-label="Sky Guard — domů">
            <Image src="/images/MQAD3CzwiRLz2sjkC49qdndj7Q.png" alt="Sky Guard" width={230} height={39} priority />
          </a>
          <nav className={styles.nav} aria-label="Hlavní navigace">
            <a href={webUrl("o-nas")}>O nás</a>
            <a href={webUrl("sky-camera")}>Technologie</a>
            <a href={webUrl("reseni")}>Služby</a>
            <a href={webUrl("kontakt")}>Kontakt</a>
          </nav>
          <span className={styles.pill}>Sky Guard Hub</span>
        </div>
      </header>

      <main className={styles.main}>
        <Image
          className={styles.wordmark}
          src="/images/ex7xMQnmrgmUJLP0IQnBvShSqBE.png"
          alt=""
          aria-hidden="true"
          width={1024}
          height={164}
          priority
        />
        <h1 className={styles.title}>{title}</h1>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <Image src="/images/MQAD3CzwiRLz2sjkC49qdndj7Q.png" alt="Sky Guard" width={160} height={27} />
            <p className={styles.tagline}>Dronová ostraha - strážce který nikdy nespí.</p>
            <p><a href="tel:+420737373430">+420 737 373 430</a></p>
            <p className={styles.legal}>
              Sky Guard s.r.o.<br />Pernerova 533/59, Praha 8<br />IČO: 24803383<br />
              C 175699 vedená u Městského soudu v Praze
            </p>
          </div>
          <nav aria-label="Navigace">
            <b>Navigation</b>
            <a href={webUrl("sky-camera")}>Technologie</a>
            <a href={webUrl("reseni")}>Služby</a>
            <a href={webUrl("o-nas")}>O nás</a>
            <a href={webUrl("kontakt")}>Kontakt</a>
          </nav>
          <nav aria-label="Sociální sítě">
            <b>Socials</b>
            <a href="https://www.facebook.com/profile.php?id=61575623963893" target="_blank" rel="noopener noreferrer">Facebook</a>
            <a href="https://www.instagram.com/skyguard.cz" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href="https://www.linkedin.com/company/sky-guard-cz" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
