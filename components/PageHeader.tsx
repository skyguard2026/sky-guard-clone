import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ThemeToggle } from "./ThemeToggle";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

/**
 * Hlavička stránky: název s popisem vlevo, akce a přepínač režimu vpravo.
 * Přepínač je na každé stránce Hubu, proto sedí tady a ne v postranním panelu.
 */
export async function PageHeader({
  title,
  crumb,
  actions,
}: {
  title: string;
  crumb: string;
  actions?: ReactNode;
}) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div className="topbar">
      <div className="tb-title">
        <h1>{title}</h1>
        <span className="crumb">{crumb}</span>
      </div>
      <div className="acts">
        {actions}
        <ThemeToggle initial={theme} />
      </div>
    </div>
  );
}
