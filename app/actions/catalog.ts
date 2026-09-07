"use server";

import { writeAudit } from "@/lib/auth/audit";
import { withAdmin, withUser } from "@/lib/auth/guards";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { deleteCatalogItemWithRefs } from "@/lib/db/catalog-ops";
import { catalogItems } from "@/lib/db/schema";
import { resetCatalogRows } from "@/lib/db/seed-core";
import { uid } from "@/lib/id";
import type { Billing, Cat, Driver, Group } from "@/lib/types";
import { HUB } from "@/lib/hub-path";

export interface CatalogItemInput {
  label: string;
  group: Group;
  cat: Cat;
  price: number;
  life: number | null;
  billing: Billing;
  driver: Driver;
  shared: boolean;
  prepay: boolean;
  note: string;
}

function normalize(input: CatalogItemInput) {
  return {
    label: input.label.trim().slice(0, 200),
    group: input.group,
    cat: input.cat,
    price: Number.isFinite(Number(input.price)) ? Number(input.price) : 0,
    life:
      input.life === null || !Number.isFinite(Number(input.life))
        ? null
        : Math.max(1, Math.round(Number(input.life))),
    billing: input.billing,
    driver: input.driver,
    shared: !!input.shared,
    prepay: !!input.prepay,
    note: (input.note ?? "").trim().slice(0, 2000),
  };
}

/** Rychlá úprava přímo v řádku — cena, životnost, zapnutí. */
async function patchCatalogItem__impl(
  id: string,
  patch: Partial<{ price: number; life: number | null; enabled: boolean }>,
) {
  const set: Record<string, unknown> = {};
  if (patch.price !== undefined) {
    const n = Number(patch.price);
    set.price = Number.isFinite(n) ? n : 0;
  }
  if (patch.life !== undefined) {
    set.life =
      patch.life === null || !Number.isFinite(Number(patch.life))
        ? null
        : Math.max(1, Math.round(Number(patch.life)));
  }
  if (patch.enabled !== undefined) set.enabled = !!patch.enabled;
  if (!Object.keys(set).length) return { ok: true as const };
  await db.update(catalogItems).set(set).where(eq(catalogItems.id, id));
  return { ok: true as const };
}

async function createCatalogItem__impl(input: CatalogItemInput) {
  const v = normalize(input);
  if (!v.label) return { ok: false as const, error: "Vyplň název položky." };
  const maxSort = await db
    .select({ m: sql<number>`coalesce(max(${catalogItems.sort}), 0)::int` })
    .from(catalogItems);
  const id = uid();
  await db
    .insert(catalogItems)
    .values({ id, enabled: true, sort: (maxSort[0]?.m ?? 0) + 10, ...v });
  revalidatePath(HUB, "layout");
  return { ok: true as const, id };
}

async function updateCatalogItem__impl(id: string, input: CatalogItemInput) {
  const v = normalize(input);
  if (!v.label) return { ok: false as const, error: "Vyplň název položky." };
  await db.update(catalogItems).set(v).where(eq(catalogItems.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/**
 * Smazání položky uklidí odkazy na ni ve všech mapách off, over a qty
 * u všech lokalit. Obojí v jedné transakci, ať nezůstane půlka.
 */
async function deleteCatalogItem__impl(id: string) {
  await deleteCatalogItemWithRefs(db, id);
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/** Vědomé obnovení ceníku do výchozího stavu. Klienti a lokality zůstanou. */
async function resetCatalog__impl() {
  await db.transaction(async (tx) => {
    await resetCatalogRows(tx);
  });
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/* --- stráže -------------------------------------------------------- */
/* Každá akce prochází obálkou, která ověří přihlášení a roli. Test
   tests/auth-guards.test.ts to vynucuje strukturálně. */

export const patchCatalogItem = withUser(
  (_user, ...args: Parameters<typeof patchCatalogItem__impl>) => patchCatalogItem__impl(...args),
);
export const createCatalogItem = withUser(
  (_user, ...args: Parameters<typeof createCatalogItem__impl>) => createCatalogItem__impl(...args),
);
export const updateCatalogItem = withUser(
  (_user, ...args: Parameters<typeof updateCatalogItem__impl>) => updateCatalogItem__impl(...args),
);
export const deleteCatalogItem = withUser(async (user, ...args: Parameters<typeof deleteCatalogItem__impl>) => {
  const result = await deleteCatalogItem__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "catalog.item_deleted", String(args[0] ?? ""));
  return result;
});
export const resetCatalog = withAdmin(async (user, ...args: Parameters<typeof resetCatalog__impl>) => {
  const result = await resetCatalog__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "catalog.reset", "");
  return result;
});
