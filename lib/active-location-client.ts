"use client";

import { ACTIVE_LOCATION_COOKIE, SESSION_MAX_AGE } from "./auth/constants";

/**
 * Přepnutí aktivní lokality. Je to volba tohohle prohlížeče, ne sdílený stav —
 * jinak by přepnutí u jednoho jednatele přehodilo obrazovku druhému.
 */
export function setActiveLocationCookie(id: string): void {
  document.cookie =
    `${ACTIVE_LOCATION_COOKIE}=${encodeURIComponent(id)}` +
    `; path=/hub; max-age=${SESSION_MAX_AGE}; samesite=lax`;
}
