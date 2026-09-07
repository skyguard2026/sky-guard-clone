"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminActivate,
  adminAudit,
  adminCreateUser,
  adminDeactivate,
  adminDelete,
  adminResetPassword,
  adminRevokeAllSessions,
  adminRevokeSession,
  adminSessions,
} from "@/app/actions/admin";
import type { Role } from "@/lib/auth/constants";
import { Modal } from "./ui";
import { useToast } from "./Toast";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

interface AuditRow {
  id: string;
  at: string;
  actor: string;
  userId: string | null;
  action: string;
  target: string;
}

interface SessionRow {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string;
}

const ACTION_LABELS: Record<string, string> = {
  login: "přihlášení",
  "login.failed": "neúspěšný pokus",
  "login.locked": "zamčeno po pokusech",
  logout: "odhlášení",
  "password.changed": "změna hesla",
  "user.created": "založen uživatel",
  "user.role_changed": "změna role",
  "user.deactivated": "deaktivace",
  "user.activated": "aktivace",
  "user.password_reset": "reset hesla",
  "session.revoked": "ukončena session",
  "client.deleted": "smazán klient",
  "location.deleted": "smazána lokalita",
  "catalog.item_deleted": "smazána položka katalogu",
  "catalog.reset": "obnoven katalog",
  "backup.imported": "načtena záloha",
  "data.wiped": "smazána data",
  "finance.imported": "nahrán výpis",
  "finance.import_reverted": "vrácen import",
  "finance.wiped": "smazána bankovní data",
  "inquiry.deleted": "smazána poptávka",
};

const dt = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });

export function AdminClient({
  meId,
  users,
  audit,
}: {
  meId: string;
  users: UserRow[];
  audit: AuditRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [sessionsFor, setSessionsFor] = useState<UserRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [rows, setRows] = useState<AuditRow[]>(audit);

  const actions = useMemo(
    () => [...new Set(audit.map((a) => a.action))].sort(),
    [audit],
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast(res.error ?? "Nepovedlo se.");
        return;
      }
      toast(done);
      router.refresh();
    });
  }

  function openSessions(u: UserRow) {
    setSessionsFor(u);
    setSessions(null);
    start(async () => setSessions(await adminSessions(u.id)));
  }

  function reloadAudit(userId: string, action: string) {
    start(async () => {
      setRows(await adminAudit({ userId: userId || null, action: action || null }));
    });
  }

  return (
    <>
      <div className="card">
        <h2>
          Uživatelé
          <small>{users.length} — přístup se řídí rolí, ne skrýváním v UI</small>
          <span className="right">
            <button type="button" className="btn sm" onClick={() => setNewOpen(true)}>
              Nový uživatel
            </button>
          </span>
        </h2>
        <div className="body">
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Jméno</th>
                  <th>E-mail</th>
                  <th>Role</th>
                  <th>Stav</th>
                  <th className="hide-narrow">Poslední přihlášení</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name || "—"}
                      {u.id === meId ? (
                        <span className="pill" style={{ marginLeft: 8 }}>to jsi ty</span>
                      ) : null}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        disabled={pending || u.id === meId}
                        onChange={(e) =>
                          run(
                            () => import("@/app/actions/admin").then((m) =>
                              m.adminSetRole(u.id, e.target.value as Role),
                            ),
                            "Role změněna",
                          )
                        }
                      >
                        <option value="admin">Správce</option>
                        <option value="member">Člen</option>
                      </select>
                    </td>
                    <td>
                      {u.active ? (
                        <span className="pill">aktivní</span>
                      ) : (
                        <span className="pill off">vypnutý</span>
                      )}
                      {u.mustChangePassword ? (
                        <span className="pill off" style={{ marginLeft: 6 }}>
                          dočasné heslo
                        </span>
                      ) : null}
                    </td>
                    <td className="tnum hide-narrow" style={{ color: "var(--tx-3)" }}>
                      {u.lastLoginAt ? dt(u.lastLoginAt) : "nikdy"}
                    </td>
                    <td className="n" style={{ whiteSpace: "nowrap" }}>
                      <button type="button" className="btn sm" onClick={() => openSessions(u)}>
                        Session
                      </button>{" "}
                      <button
                        type="button"
                        className="btn sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await adminResetPassword(u.id);
                            if (!res.ok) return toast(res.error);
                            setSecret({ email: u.email, password: res.tempPassword });
                            router.refresh();
                          })
                        }
                      >
                        Reset hesla
                      </button>{" "}
                      {u.active ? (
                        <button
                          type="button"
                          className="btn sm danger"
                          disabled={pending || u.id === meId}
                          onClick={() => run(() => adminDeactivate(u.id), "Deaktivováno")}
                        >
                          Deaktivovat
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn sm"
                          disabled={pending}
                          onClick={() => run(() => adminActivate(u.id), "Aktivováno")}
                        >
                          Aktivovat
                        </button>
                      )}{" "}
                      <button
                        type="button"
                        className="btn sm danger"
                        disabled={pending || u.id === meId}
                        onClick={() => {
                          if (!window.confirm(`Smazat účet ${u.email}? Nejde vrátit.`)) return;
                          run(() => adminDelete(u.id), "Účet smazán");
                        }}
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="note">
          Posledního správce nejde vypnout, degradovat ani smazat a nikdo nemůže
          sám sobě odebrat přístup — obojí je cesta, jak se nevratně zamknout ven.
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          Záznam akcí
          <small>jen ke čtení — z auditu se nemaže</small>
        </h2>
        <div className="body">
          <div className="body pad" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={filterUser}
              onChange={(e) => {
                setFilterUser(e.target.value);
                reloadAudit(e.target.value, filterAction);
              }}
            >
              <option value="">Všichni uživatelé</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                reloadAudit(filterUser, e.target.value);
              }}
            >
              <option value="">Všechny akce</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a] ?? a}
                </option>
              ))}
            </select>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Kdy</th>
                  <th>Kdo</th>
                  <th>Akce</th>
                  <th className="hide-narrow">Čeho se týká</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="tnum" style={{ whiteSpace: "nowrap" }}>{dt(a.at)}</td>
                    <td>{a.actor || "—"}</td>
                    <td>{ACTION_LABELS[a.action] ?? a.action}</td>
                    <td className="hide-narrow" style={{ color: "var(--tx-3)" }}>{a.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? (
            <div className="empty">
              <b>Nic nevyhovuje filtru</b>
              Zkus jiného uživatele nebo jinou akci.
            </div>
          ) : null}
        </div>
      </div>

      <NewUserDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(email, password) => {
          setNewOpen(false);
          setSecret({ email, password });
          router.refresh();
        }}
      />

      <Modal open={!!secret} title="Dočasné heslo" onClose={() => setSecret(null)}>
        <p>
          Účet <b>{secret?.email}</b> má dočasné heslo. Ukazuje se{" "}
          <b>jenom teď</b> — v databázi je jen otisk a znovu ho nikdo nepřečte.
        </p>
        <p
          className="tnum"
          style={{
            fontSize: 20,
            background: "var(--raise)",
            padding: "12px 14px",
            borderRadius: "var(--r)",
            userSelect: "all",
            wordBreak: "break-all",
          }}
        >
          {secret?.password}
        </p>
        <p className="note">
          Předej ho osobně. Aplikace neposílá e-maily. Při prvním přihlášení si
          uživatel musí nastavit vlastní heslo.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn primary" onClick={() => setSecret(null)}>
            Mám zkopírováno
          </button>
        </div>
      </Modal>

      <Modal
        open={!!sessionsFor}
        title={`Session — ${sessionsFor?.email ?? ""}`}
        onClose={() => setSessionsFor(null)}
      >
        {sessions === null ? (
          <p className="muted">Načítám…</p>
        ) : sessions.length === 0 ? (
          <p className="muted">Žádná aktivní session.</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Naposledy</th>
                  <th className="hide-narrow">Zařízení</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="tnum">{dt(s.lastSeenAt)}</td>
                    <td className="hide-narrow" style={{ color: "var(--tx-3)", fontSize: 12 }}>
                      {s.userAgent.slice(0, 60) || "—"}
                    </td>
                    <td className="n">
                      <button
                        type="button"
                        className="btn sm danger"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            await adminRevokeSession(s.id);
                            setSessions((prev) => (prev ?? []).filter((x) => x.id !== s.id));
                            toast("Session ukončena");
                            router.refresh();
                          })
                        }
                      >
                        Ukončit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">Ukončení platí okamžitě, při dalším kliknutí je uživatel venku.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => setSessionsFor(null)}>
            Zavřít
          </button>
          {sessions?.length ? (
            <button
              type="button"
              className="btn danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await adminRevokeAllSessions(sessionsFor!.id);
                  setSessions([]);
                  toast("Všechny session ukončeny");
                  router.refresh();
                })
              }
            >
              Ukončit všechny
            </button>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function NewUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (email: string, password: string) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");

  return (
    <Modal open={open} title="Nový uživatel" onClose={onClose}>
      <div className="field">
        <label htmlFor="ne">E-mail</label>
        <input id="ne" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nn">Jméno</label>
        <input id="nn" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nr">Role</label>
        <select id="nr" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="member">Člen — kalkulace, klienti, katalog, nabídky</option>
          <option value="admin">Správce — všechno včetně financí a admin centra</option>
        </select>
      </div>
      <p className="note">
        Aplikace vygeneruje dočasné heslo a ukáže ho jednou. Žádný e-mail se
        neposílá — heslo předáš osobně.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={pending || !email.trim()}
          onClick={() =>
            start(async () => {
              const res = await adminCreateUser({ email, name, role });
              if (!res.ok) return toast(res.error);
              setEmail("");
              setName("");
              onCreated(email.trim().toLowerCase(), res.tempPassword);
            })
          }
        >
          {pending ? "Zakládám…" : "Založit"}
        </button>
      </div>
    </Modal>
  );
}
