import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { DM_Sans } from "next/font/google";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

/** DM Sans na všechno. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sky Guard — Kalkulace nákladů a cen",
  description: "Interní nástroj pro stanovení ceny služby podle nákladů lokality.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b12" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
  ],
  width: "device-width",
  initialScale: 1,
};

/*
 * Když cookie chybí (první návštěva z nového prohlížeče), dorovná se režim
 * z localStorage ještě před prvním vykreslením. Běží před hydratací, proto
 * inline a bez závislostí.
 */
const THEME_BOOT = `(function(){try{if(!document.documentElement.dataset.themeSrc){var t=localStorage.getItem("${THEME_COOKIE}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = parseTheme(cookie);
  return (
    <html
      lang="cs"
      data-theme={theme}
      data-theme-src={cookie ? "cookie" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className={dmSans.variable}>
        {children}
      </body>
    </html>
  );
}
