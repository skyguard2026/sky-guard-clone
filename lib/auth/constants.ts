/** Sdílené konstanty přístupu. Bez závislosti na databázi i na Reactu. */

export const SESSION_COOKIE = "sg_session";
export const ACTIVE_LOCATION_COOKIE = "sg_loc";

/** Klouzavá platnost session ve vteřinách. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Jak často se session prodlužuje. Ověřuje se při každém požadavku, ale
 * zapisovat lastSeenAt ke každé navigaci by znamenalo zápis navíc ke každému
 * kliknutí. Prodloužení o minutu zpátky nikomu nechybí, zápisy ano.
 *
 * Pozor na rozdíl: **čte se vždy čerstvě**, jen zápis je zředěný. Kdyby se
 * cachovalo čtení, zneplatnění session by se projevilo se zpožděním a tlačítko
 * „ukončit session" by přestalo platit hned.
 */
export const SESSION_TOUCH_AFTER_MS = 60 * 1000;

/** Zamykání přihlášení. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export type Role = "admin" | "member";
