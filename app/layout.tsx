import type { Metadata, Viewport } from "next";
import { DM_Sans, Saira_Stencil } from "next/font/google";
import "./globals.css";

/** DM Sans na všechno. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
});

/**
 * Stencil výhradně na názvy stránek v horní liště — stejný řez nese logo.
 * Google mezitím Saira Stencil One nahradil variabilní rodinou Saira Stencil;
 * je to stejný řez, bereme z ní váhu 400. Nikam jinam stencil nepatří,
 * v malých velikostech je nečitelný.
 */
const stencil = Saira_Stencil({
  variable: "--font-stencil",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sky Guard — Kalkulace nákladů a cen",
  description: "Interní nástroj pro stanovení ceny služby podle nákladů lokality.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#05090f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className={`${dmSans.variable} ${stencil.variable}`}>
        {children}
      </body>
    </html>
  );
}
