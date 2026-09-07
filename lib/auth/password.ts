/**
 * Hesla. argon2id s parametry podle doporučení OWASP (19 MiB, 2 průchody).
 *
 * Nativní modul @node-rs/argon2 má předpřipravené binárky pro všechny
 * platformy včetně linux-x64-gnu, na kterém běží Vercel.
 */
import { hash, verify } from "@node-rs/argon2";

const PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, PARAMS);
}

/**
 * Ověření hesla. Chybu z knihovny nepřevádíme na výjimku — poškozený nebo
 * cizí hash znamená „neprošlo", ne pád přihlašovací stránky.
 */
export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  if (!storedHash || !plain) return false;
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/** Znaky bez těch, které jdou splést: 0/O, 1/l/I. Heslo se diktuje osobně. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Dočasné heslo od admina. Ukáže se jednou, pak už ho nikdo nepřečte. */
export function generateTempPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export interface PasswordProblem {
  ok: false;
  error: string;
}

/**
 * Pravidla na nové heslo. Záměrně jen délka — vynucené velké písmeno a číslice
 * vedou k „Heslo1!" a nic nezlepší. Délka je to jediné, co spolehlivě pomáhá.
 */
export function checkPasswordStrength(
  plain: string,
): { ok: true } | PasswordProblem {
  if (plain.length < 12) {
    return { ok: false, error: "Heslo musí mít aspoň 12 znaků." };
  }
  if (plain.length > 200) {
    return { ok: false, error: "Heslo je příliš dlouhé." };
  }
  return { ok: true };
}
