import Image from "next/image";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { currentUser } from "@/lib/auth/guards";

export const metadata = { title: "Změna hesla — Sky Guard" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await currentUser();
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(420px, 100%)" }}>
        <Image
          src="/logo-sky-guard.png"
          alt="Sky Guard"
          width={800}
          height={129}
          priority
          style={{ width: "100%", maxWidth: 220, height: "auto", margin: "0 auto 28px", display: "block", opacity: 0.96 }}
        />
        <div className="card" style={{ marginBottom: 0 }}>
          <h2>
            <span className="tag" />
            Nastav si vlastní heslo
          </h2>
          <div className="body pad">
            <ChangePasswordForm email={user?.email ?? ""} />
          </div>
          <div className="note">
            Heslo, které ti předal správce, je dočasné. Dokud si nenastavíš
            vlastní, aplikace tě nikam nepustí.
          </div>
        </div>
      </div>
    </div>
  );
}
