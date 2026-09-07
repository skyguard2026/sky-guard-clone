"use server";

import { writeAudit } from "@/lib/auth/audit";
import { withUser } from "@/lib/auth/guards";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clients, locations } from "@/lib/db/schema";
import { DEFAULT_LOCATION_INPUTS } from "@/lib/defaults";
import { uid } from "@/lib/id";
import type { Product } from "@/lib/types";
import { HUB } from "@/lib/hub-path";

/** Skalární pole lokality, která smí přijít z klienta. */
const NUM_FIELDS = [
  "price",
  "cameras",
  "camerasTlBig",
  "camerasTlSmall",
  "poles",
  "docks",
  "km",
  "hours",
  "trips1",
  "trips2",
  "setupFee",
  "commitmentMonths",
] as const;
const INT_FIELDS = new Set([
  "cameras",
  "camerasTlBig",
  "camerasTlSmall",
  "poles",
  "docks",
  "trips1",
  "trips2",
  "commitmentMonths",
]);

export type LocationPatch = Partial<
  Record<(typeof NUM_FIELDS)[number], number> & {
    name: string;
    note: string;
    product: Product;
  }
>;

/**
 * Zapíše jen ta pole, která se opravdu změnila.
 *
 * Zápis celého objektu by při současné práci dvou lidí přepsal i to, do čeho
 * druhý nesáhl — proto se posílá výhradně to, co uživatel změnil.
 */
async function patchLocation__impl(id: string, patch: LocationPatch) {
  const set: Record<string, unknown> = {};

  for (const f of NUM_FIELDS) {
    const v = patch[f];
    if (v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    set[f] = INT_FIELDS.has(f) ? Math.max(0, Math.round(n)) : Math.max(0, n);
  }
  if (patch.name !== undefined) set.name = String(patch.name).slice(0, 200);
  if (patch.note !== undefined) set.note = String(patch.note).slice(0, 2000);
  if (patch.product !== undefined && ["cam", "drone", "both"].includes(patch.product))
    set.product = patch.product;

  if (!Object.keys(set).length) return { ok: true as const };
  await db.update(locations).set(set).where(eq(locations.id, id));
  return { ok: true as const };
}

/**
 * Mapy off/over/qty se mění po jednom klíči přímo v SQL, ne přečtením
 * a zpětným zápisem celé mapy — jinak by dva lidi editující dvě různé položky
 * na stejné lokalitě přepisovali jeden druhého.
 */
async function setLocationOff__impl(
  id: string,
  itemId: string,
  off: boolean,
) {
  await db
    .update(locations)
    .set({
      off: off
        ? sql`${locations.off} || jsonb_build_object(${itemId}::text, true)`
        : sql`${locations.off} - ${itemId}::text`,
    })
    .where(eq(locations.id, id));
  return { ok: true as const };
}

/** `null` znamená návrat na katalogovou cenu, tedy smazání klíče. */
async function setLocationOver__impl(
  id: string,
  itemId: string,
  value: number | null,
) {
  await db
    .update(locations)
    .set({
      over:
        value === null || !Number.isFinite(value)
          ? sql`${locations.over} - ${itemId}::text`
          : sql`${locations.over} || jsonb_build_object(${itemId}::text, ${value}::numeric)`,
    })
    .where(eq(locations.id, id));
  return { ok: true as const };
}

async function setLocationQty__impl(
  id: string,
  itemId: string,
  value: number,
) {
  const v = Math.max(0, Math.round(Number(value) || 0));
  await db
    .update(locations)
    .set({
      qty: v
        ? sql`${locations.qty} || jsonb_build_object(${itemId}::text, ${v}::numeric)`
        : sql`${locations.qty} - ${itemId}::text`,
    })
    .where(eq(locations.id, id));
  return { ok: true as const };
}

async function createLocation__impl(input: {
  clientId: string;
  name: string;
  product: Product;
  price: number;
  km: number;
  note: string;
}) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Vyplň název lokality." };
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, input.clientId),
  });
  if (!client) return { ok: false as const, error: "Klient neexistuje." };

  const id = uid();
  await db.insert(locations).values({
    id,
    clientId: input.clientId,
    name,
    note: input.note.trim(),
    product: input.product,
    ...DEFAULT_LOCATION_INPUTS,
    docks: input.product === "cam" ? 0 : 1,
    price: Math.max(0, Number(input.price) || 0),
    km: Math.max(0, Number(input.km) || 0),
    off: {},
    over: {},
    qty: {},
  });
  revalidatePath(HUB, "layout");
  return { ok: true as const, id };
}

async function updateLocation__impl(
  id: string,
  input: {
    clientId: string;
    name: string;
    product: Product;
    price: number;
    km: number;
    note: string;
  },
) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Vyplň název lokality." };
  await db
    .update(locations)
    .set({
      clientId: input.clientId,
      name,
      note: input.note.trim(),
      product: input.product,
      price: Math.max(0, Number(input.price) || 0),
      km: Math.max(0, Number(input.km) || 0),
    })
    .where(eq(locations.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

async function deleteLocation__impl(id: string) {
  await db.delete(locations).where(eq(locations.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/* --- stráže -------------------------------------------------------- */
/* Každá akce prochází obálkou, která ověří přihlášení a roli. Test
   tests/auth-guards.test.ts to vynucuje strukturálně. */

export const patchLocation = withUser(
  (_user, ...args: Parameters<typeof patchLocation__impl>) => patchLocation__impl(...args),
);
export const setLocationOff = withUser(
  (_user, ...args: Parameters<typeof setLocationOff__impl>) => setLocationOff__impl(...args),
);
export const setLocationOver = withUser(
  (_user, ...args: Parameters<typeof setLocationOver__impl>) => setLocationOver__impl(...args),
);
export const setLocationQty = withUser(
  (_user, ...args: Parameters<typeof setLocationQty__impl>) => setLocationQty__impl(...args),
);
export const createLocation = withUser(
  (_user, ...args: Parameters<typeof createLocation__impl>) => createLocation__impl(...args),
);
export const updateLocation = withUser(
  (_user, ...args: Parameters<typeof updateLocation__impl>) => updateLocation__impl(...args),
);
export const deleteLocation = withUser(async (user, ...args: Parameters<typeof deleteLocation__impl>) => {
  const result = await deleteLocation__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "location.deleted", String(args[0] ?? ""));
  return result;
});
