import { expect, it } from "vitest";
import { PayloadTooLarge, readLimitedText } from "../lib/request-body";
it("odmítne příliš velké tělo i bez content-length", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: "a".repeat(100),
  });
  await expect(readLimitedText(req, 50)).rejects.toBeInstanceOf(
    PayloadTooLarge,
  );
});
it("počítá bajty a zachová český text", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: "Příliš žluťoučký kůň",
  });
  await expect(readLimitedText(req)).resolves.toBe("Příliš žluťoučký kůň");
});
it("odmítne už deklarovanou velkou délku", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "content-length": "500" },
    body: "malé",
  });
  await expect(readLimitedText(req, 50)).rejects.toBeInstanceOf(
    PayloadTooLarge,
  );
});
