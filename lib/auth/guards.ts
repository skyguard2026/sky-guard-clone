/**
 * Stráže nad server actions.
 *
 * Druhá vrstva pod bránou. Brána ověřuje session při každé navigaci, ale
 * server action se dá zavolat i mimo navigaci — proto se oprávnění kontroluje
 * ještě jednou tady, u každé akce zvlášť.
 *
 * Každá exportovaná akce **musí** projít jednou z těchhle obálek. Obálka na
 * funkci nechá značku a test ji umí přečíst, takže se na kontrolu nedá
 * zapomenout — chybějící stráž shodí test, ne až produkci. Hledání v textu by
 * takovou jistotu nedalo; značka je vlastnost té funkce, ne vzhled zdrojáku.
 */
import { cookies, headers } from "next/headers";
import { db } from "../db";
import { SESSION_COOKIE } from "./constants";
import { resolveSession, type SessionUser } from "./session";

/** Značka, kterou obálka nechá na akci. Symbol.for, ať přežije i dva moduly. */
export const GUARD = Symbol.for("skyguard.guard");

export type GuardKind = "user" | "admin" | "public";

/** Odmítnutí přístupu. Není to uživatelský stav, je to pokus obejít UI. */
export class AccessError extends Error {
  constructor(message = "Nemáš oprávnění k téhle akci.") {
    super(message);
    this.name = "AccessError";
  }
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return resolveSession(db, jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AccessError("Nejsi přihlášený.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AccessError();
  return user;
}

/** IP volajícího, pro záznam pokusů o přihlášení. */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "";
}

export async function callerUserAgent(): Promise<string> {
  return (await headers()).get("user-agent") ?? "";
}

function mark<F extends (...args: never[]) => unknown>(fn: F, kind: GuardKind): F {
  Object.defineProperty(fn, GUARD, { value: kind, enumerable: false });
  return fn;
}

export function guardOf(fn: unknown): GuardKind | null {
  if (typeof fn !== "function") return null;
  const v = (fn as unknown as Record<symbol, unknown>)[GUARD];
  return v === "user" || v === "admin" || v === "public" ? v : null;
}

/** Akce pro přihlášeného uživatele. Uživatel přijde jako první argument. */
export function withUser<A extends unknown[], R>(
  fn: (user: SessionUser, ...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return mark(async (...args: A) => fn(await requireUser(), ...args), "user");
}

/** Akce jen pro admina — admin centrum a celá sekce Finance. */
export function withAdmin<A extends unknown[], R>(
  fn: (user: SessionUser, ...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return mark(async (...args: A) => fn(await requireAdmin(), ...args), "admin");
}

/**
 * Akce dostupná bez přihlášení — přihlášení samo a odhlášení.
 *
 * Je to vědomá výjimka, ne mezera: značka „public" se dá v testu spočítat,
 * takže nová veřejná akce nevznikne nedopatřením.
 */
export function publicAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return mark(async (...args: A) => fn(...args), "public");
}
