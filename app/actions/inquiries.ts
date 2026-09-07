"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/auth/audit";
import { withUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { HUB } from "@/lib/hub-path";
import { isInquiryStatus, type InquiryStatus } from "@/lib/inquiries";

async function setStatus__impl(id: string, status: InquiryStatus) {
  if (!isInquiryStatus(status)) return { ok: false as const, error: "Neznámý stav." };
  await db.update(inquiries).set({ status }).where(eq(inquiries.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

async function setNote__impl(id: string, note: string) {
  await db
    .update(inquiries)
    .set({ note: (note ?? "").trim().slice(0, 4000) })
    .where(eq(inquiries.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

async function delete__impl(id: string) {
  await db.delete(inquiries).where(eq(inquiries.id, id));
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

/* --- stráže -------------------------------------------------------- */
/* Poptávky vidí a řeší každý přihlášený, ne jen admin — obchod dělají oba. */

export const setInquiryStatus = withUser(
  (_user, ...args: Parameters<typeof setStatus__impl>) => setStatus__impl(...args),
);
export const setInquiryNote = withUser(
  (_user, ...args: Parameters<typeof setNote__impl>) => setNote__impl(...args),
);
export const deleteInquiry = withUser(async (user, ...args: Parameters<typeof delete__impl>) => {
  const result = await delete__impl(...args);
  await writeAudit(
    db,
    { userId: user.userId, actor: user.email },
    "inquiry.deleted",
    String(args[0] ?? ""),
  );
  return result;
});
