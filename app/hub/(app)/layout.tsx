import { Shell } from "@/components/Shell";
import { ToastProvider } from "@/components/Toast";
import { getActiveLocationId } from "@/lib/active-location";
import { countNewInquiries, getPortfolio } from "@/lib/data";
import { currentUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { hub } from "@/lib/hub-path";

// Nad sdílenou databází se nic necachuje — oba jednatelé musí vidět aktuální stav.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Brána sem nepustí nikoho bez session, tohle je druhá vrstva — a zároveň
  // odsud bere Shell jméno a roli přihlášeného.
  const user = await currentUser();
  if (!user) redirect(hub("/prihlaseni"));

  const { locations, catalog } = await getPortfolio();
  const activeId = await getActiveLocationId(locations);
  // Odznak je pohodlí, ne nutnost — kdyby tabulka poptávek ještě neexistovala
  // (migrace nedoběhla), Hub musí běžet dál.
  const newInquiries = await countNewInquiries().catch(() => 0);
  return (
    <ToastProvider>
      <Shell
        locations={locations}
        activeId={activeId}
        catalogCount={catalog.length}
        newInquiries={newInquiries}
        user={user}
      >
        {children}
      </Shell>
    </ToastProvider>
  );
}
