import { describe, expect, it } from "vitest";
import { inquiriesCsv, selectInquiries } from "../lib/inquiry-view";
import { parseInquiry, type Inquiry } from "../lib/inquiries";
const base: Inquiry = {
  id: "a",
  createdAt: "2026-09-08T09:00:00Z",
  name: "Jiří Šťastný",
  company: "Železárny",
  email: "jiri@example.test",
  phone: "+420 111 222 333",
  objectType: "industrial",
  interest: "camera",
  message: "Hlídání areálu",
  status: "new",
  note: "Volat zítra",
};
describe("poptávky — hledání a export", () => {
  it("hledá více slov bez diakritiky napříč zprávou i poznámkou", () => {
    expect(
      selectInquiries([base], "all", "zelezarny zitra hlidani", "newest"),
    ).toEqual([base]);
    expect(selectInquiries([base], "closed", "jiri", "newest")).toEqual([]);
  });
  it("řadí podle data a nemění vstupní data", () => {
    const older = { ...base, id: "b", createdAt: "2026-08-01T09:00:00Z" };
    const input = [older, base];
    expect(
      selectInquiries(input, "all", "", "newest").map((q) => q.id),
    ).toEqual(["a", "b"]);
    expect(
      selectInquiries(input, "all", "", "oldest").map((q) => q.id),
    ).toEqual(["b", "a"]);
    expect(input[0]).toBe(older);
  });
  it("CSV chrání před vzorci a zachová uvozovky i nové řádky", () => {
    const csv = inquiriesCsv([
      {
        ...base,
        name: '=HYPERLINK("https://example.test")',
        note: 'první;\n"druhý"',
      },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(csv).toContain('"\'+420 111 222 333"');
    expect(csv).toContain('"první;\n""druhý"""');
  });
  it.each(["constructor", "__proto__", "toString"])(
    "odmítne zděděný klíč %s jako volbu formuláře",
    (key) => {
      expect(parseInquiry({ ...base, objectType: key }).ok).toBe(false);
      expect(parseInquiry({ ...base, interest: key }).ok).toBe(false);
    },
  );
});
