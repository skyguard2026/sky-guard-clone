/**
 * Operace nad katalogem, které míchají víc tabulek.
 *
 * Jsou tady, a ne v server action, aby se daly otestovat proti databázi
 * bez Nextu — server action je jen tenká obálka.
 */
import { eq, sql } from "drizzle-orm";
import { catalogItems, locations } from "./schema";
import type { AnyPgDatabase } from "./seed-core";

/**
 * Smaže položku a uklidí odkazy na ni ve všech mapách off, over a qty
 * u všech lokalit. Obojí v jedné transakci, ať nezůstane půlka.
 */
export async function deleteCatalogItemWithRefs(
  db: AnyPgDatabase,
  id: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(locations).set({
      off: sql`${locations.off} - ${id}::text`,
      over: sql`${locations.over} - ${id}::text`,
      qty: sql`${locations.qty} - ${id}::text`,
    });
    await tx.delete(catalogItems).where(eq(catalogItems.id, id));
  });
}
