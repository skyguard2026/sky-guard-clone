import { AdminClient } from "@/components/AdminClient";
import { PageHeader } from "@/components/PageHeader";
import { readAudit } from "@/lib/auth/audit";
import { requireAdmin } from "@/lib/auth/guards";
import { listUsers } from "@/lib/auth/users";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Brána sem member nepustí; tohle je druhá vrstva pro případ, že by se
  // stránka někdy ocitla mimo její dosah.
  const me = await requireAdmin();

  const [users, audit] = await Promise.all([listUsers(db), readAudit(db, { limit: 200 })]);

  return (
    <>
      <PageHeader title="Admin centrum" crumb="uživatelé, session a záznam akcí" />
      <div className="page">
        <AdminClient
          meId={me.userId}
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            active: u.active,
            mustChangePassword: u.mustChangePassword,
            lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
          }))}
          audit={audit.map((a) => ({
            id: a.id,
            at: a.at.toISOString(),
            actor: a.actor,
            userId: a.userId,
            action: a.action,
            target: a.target,
          }))}
        />
      </div>
    </>
  );
}
