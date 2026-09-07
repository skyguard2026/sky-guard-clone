import { describe, expect, it } from "vitest";
import { niceStep, niceTicks, roundedTopRect, shortMonth } from "@/lib/chart-scale";

describe("osa grafu", () => {
  it("krok je 1/2/2,5/5 násobek mocniny deseti", () => {
    expect(niceStep(41031, 4)).toBe(20000);
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(9, 4)).toBe(2.5);
    expect(niceStep(0, 4)).toBe(1);
  });

  it("rozsah se roztáhne na celé násobky kroku", () => {
    const { ticks, lo, hi } = niceTicks(0, 41031, 4);
    expect(lo).toBe(0);
    expect(hi).toBe(60000);
    expect(ticks).toEqual([0, 20000, 40000, 60000]);
  });

  it("záporná hotovost dostane vlastní čáry a nula je mezi nimi", () => {
    const { ticks, lo, hi } = niceTicks(-577516, 0, 4);
    expect(lo).toBe(-600000);
    expect(hi).toBe(0);
    expect(ticks).toContain(0);
    expect(ticks[0]).toBe(-600000);
  });

  it("stejná hodnota nevyrobí nulový rozsah", () => {
    expect(niceTicks(0, 0).hi).toBeGreaterThan(0);
    expect(niceTicks(5000, 5000).lo).toBe(0);
  });

  it("sloupec se zaobleným vrškem je uzavřená cesta", () => {
    const d = roundedTopRect(10, 20, 8, 30, 4);
    expect(d.startsWith("M10.0,50.0")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(roundedTopRect(10, 20, 8, 0, 4)).toBe("");
  });

  it("popisek měsíce je krátký český název s dvouciferným rokem", () => {
    expect(shortMonth("2025-10")).toBe("říj 25");
    expect(shortMonth("2026-01")).toBe("led 26");
  });
});
