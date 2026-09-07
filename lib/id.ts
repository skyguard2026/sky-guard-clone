/** Krátké náhodné id, stejný tvar jako v prototypu. */
export function uid(): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}
