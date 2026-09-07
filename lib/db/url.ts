/**
 * Připojovací řetězec. Vlastní modul, aby si ho mohly načíst i skripty, které
 * si nejdřív musí načíst .env — import samotného spojení by se v ESM vyhodnotil
 * dřív než dotenv.
 *
 * Vercel Marketplace (Neon) nastaví proměnné sám, názvy se ale liší podle
 * integrace, tak zkoušíme známé varianty.
 */
/** Je nastavené připojení? Preview deploymenty ho schválně nemají. */
export function hasDatabase(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING,
  );
}

export function connectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    throw new Error(
      "Chybí připojení k databázi. Nastav DATABASE_URL nebo POSTGRES_URL.",
    );
  }
  return url;
}
