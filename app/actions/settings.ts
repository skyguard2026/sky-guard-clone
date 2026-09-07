"use server";

import { writeAudit } from "@/lib/auth/audit";
import { withAdmin, withUser } from "@/lib/auth/guards";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exportBackup, importBackup } from "@/lib/db/backup";
import { catalogItems, clients, locations, settings } from "@/lib/db/schema";
import { catalogRows } from "@/lib/db/seed-core";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import type { Settings } from "@/lib/types";
import { HUB } from "@/lib/hub-path";

async function patchSettings__impl(patch: Partial<Settings>) {
  const set: Record<string, unknown> = {};
  if (patch.share !== undefined) set.share = !!patch.share;
  if (patch.prepay !== undefined) set.prepay = !!patch.prepay;
  if (patch.renew !== undefined) set.renew = !!patch.renew;
  if (patch.tax !== undefined)
    set.tax = Math.min(100, Math.max(0, Number(patch.tax) || 0));
  if (patch.horizon !== undefined)
    set.horizon = Math.min(
      120,
      Math.max(12, Math.round(Number(patch.horizon) || 36)),
    );
  if (patch.inflation !== undefined)
    set.inflation = Math.min(50, Math.max(0, Number(patch.inflation) || 0));
  if (patch.residualRate !== undefined)
    set.residualRate = Math.min(
      100,
      Math.max(0, Number(patch.residualRate) || 0),
    );
  if (patch.transferDelay !== undefined)
    set.transferDelay = Math.min(
      60,
      Math.max(0, Math.round(Number(patch.transferDelay) || 0)),
    );
  if (!Object.keys(set).length) return { ok: true as const };

  const existing = await db.select({ id: settings.id }).from(settings).limit(1);
  if (existing.length) {
    await db.update(settings).set(set).where(eq(settings.id, existing[0].id));
  } else {
    await db.insert(settings).values({ id: 1, ...DEFAULT_SETTINGS, ...set });
  }
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/** Kompletní záloha databáze pro jednatele. Nikdy ne podklad pro klienta. */
async function exportAll__impl(): Promise<string> {
  const payload = await exportBackup(db, new Date().toISOString());
  return JSON.stringify(payload, null, 2);
}

async function importAll__impl(json: string) {
  const res = await importBackup(db, json);
  if (res.ok) revalidatePath(HUB, "layout");
  return res;
}

/** Smaže úplně všechno a vrátí aplikaci do výchozího stavu. */
async function wipeAll__impl() {
  await db.transaction(async (tx) => {
    await tx.delete(locations);
    await tx.delete(clients);
    await tx.delete(catalogItems);
    await tx.insert(catalogItems).values(catalogRows());
    await tx.delete(settings);
    await tx.insert(settings).values({ id: 1, ...DEFAULT_SETTINGS });
  });
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/* --- stráže -------------------------------------------------------- */
/* Každá akce prochází obálkou, která ověří přihlášení a roli. Test
   tests/auth-guards.test.ts to vynucuje strukturálně. */

export const patchSettings = withUser(
  (_user, ...args: Parameters<typeof patchSettings__impl>) => patchSettings__impl(...args),
);
export const exportAll = withAdmin(
  (_user, ...args: Parameters<typeof exportAll__impl>) => exportAll__impl(...args),
);
export const importAll = withAdmin(async (user, ...args: Parameters<typeof importAll__impl>) => {
  const result = await importAll__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "backup.imported", "");
  return result;
});
export const wipeAll = withAdmin(async (user, ...args: Parameters<typeof wipeAll__impl>) => {
  const result = await wipeAll__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "data.wiped", "");
  return result;
});
