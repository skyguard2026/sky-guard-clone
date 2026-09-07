"use server";

import { writeAudit } from "@/lib/auth/audit";
import { withUser } from "@/lib/auth/guards";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { uid } from "@/lib/id";
import { HUB } from "@/lib/hub-path";

export interface ClientInput {
  name: string;
  contact: string;
  note: string;
}

function normalize(i: ClientInput) {
  return {
    name: i.name.trim().slice(0, 200),
    contact: (i.contact ?? "").trim().slice(0, 200),
    note: (i.note ?? "").trim().slice(0, 2000),
  };
}

async function createClient__impl(input: ClientInput) {
  const v = normalize(input);
  if (!v.name) return { ok: false as const, error: "Vyplň název klienta." };
  const id = uid();
  await db.insert(clients).values({ id, ...v });
  revalidatePath(HUB, "layout");
  return { ok: true as const, id };
}

async function updateClient__impl(id: string, input: ClientInput) {
  const v = normalize(input);
  if (!v.name) return { ok: false as const, error: "Vyplň název klienta." };
  await db.update(clients).set(v).where(eq(clients.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/** Lokality klienta jdou s ním — zajišťuje to cizí klíč s ON DELETE CASCADE. */
async function deleteClient__impl(id: string) {
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/* --- stráže -------------------------------------------------------- */
/* Každá akce prochází obálkou, která ověří přihlášení a roli. Test
   tests/auth-guards.test.ts to vynucuje strukturálně. */

export const createClient = withUser(
  (_user, ...args: Parameters<typeof createClient__impl>) => createClient__impl(...args),
);
export const updateClient = withUser(
  (_user, ...args: Parameters<typeof updateClient__impl>) => updateClient__impl(...args),
);
export const deleteClient = withUser(async (user, ...args: Parameters<typeof deleteClient__impl>) => {
  const result = await deleteClient__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "client.deleted", String(args[0] ?? ""));
  return result;
});
