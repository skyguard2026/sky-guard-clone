import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Server actions importují přes alias @/, který zná Next, ale ne vitest.
  // Bez něj by nešel napsat test, který si projde všechny akce a ověří, že
  // žádná nezůstala bez kontroly oprávnění.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    /**
     * Testy proti databázi si v beforeEach zakládají čerstvou PGlite a pouštějí
     * do ní celou řadu migrací. Výchozích pět vteřin na hook na to za souběhu
     * několika souborů nestačí a test spadne na časovém limitu, ne na chybě —
     * což je nejhorší druh červené, protože nic neříká.
     */
    hookTimeout: 30_000,
    testTimeout: 15_000,
    /**
     * Každá PGlite je vlastní instance Postgresu ve WASM. Bez stropu jich běží
     * tolik, kolik má stroj jader, a na notebooku, kde vedle toho jede vývojový
     * server, se o paměť perou.
     */
    maxWorkers: 4,
  },
});
