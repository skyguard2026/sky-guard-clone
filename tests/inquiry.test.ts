import { describe, expect, it } from "vitest";
import { interestLabel, objectTypeLabel, parseInquiry } from "@/lib/inquiries";

const good = {
  name: "Josef Novák",
  company: "Nordum s.r.o.",
  email: "josef@nordum.cz",
  phone: "+420 777 123 456",
  object_type: "logistics",
  interest: "fusion",
};

describe("poptávka z webu", () => {
  it("projde s poli tak, jak je posílá formulář", () => {
    const r = parseInquiry(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.objectType).toBe("logistics");
      expect(r.value.interest).toBe("fusion");
      expect(r.value.message).toBe("");
    }
  });

  it("přijme i camelCase názvy polí", () => {
    const r = parseInquiry({ ...good, object_type: undefined, objectType: "office" });
    expect(r.ok && r.value.objectType).toBe("office");
  });

  it("odmítne prázdné jméno, špatný e-mail a chybějící typ objektu", () => {
    expect(parseInquiry({ ...good, name: "J" }).ok).toBe(false);
    expect(parseInquiry({ ...good, email: "josef" }).ok).toBe(false);
    expect(parseInquiry({ ...good, object_type: "" }).ok).toBe(false);
    expect(parseInquiry({ ...good, object_type: "castle" }).ok).toBe(false);
  });

  it("zájem je nepovinný, ale musí být z nabídky", () => {
    expect(parseInquiry({ ...good, interest: "" }).ok).toBe(true);
    expect(parseInquiry({ ...good, interest: "laser" }).ok).toBe(false);
  });

  it("ořeže délku, aby se do databáze nedal nacpat román", () => {
    const r = parseInquiry({ ...good, name: "A".repeat(500), message: "x".repeat(10000) });
    expect(r.ok && r.value.name.length).toBe(200);
    expect(r.ok && r.value.message.length).toBe(4000);
  });

  it("ignoruje netextové hodnoty", () => {
    expect(parseInquiry({ ...good, name: 42 }).ok).toBe(false);
  });

  it("popisky překládají klíče a neznámé vrací tak, jak jsou", () => {
    expect(objectTypeLabel("construction")).toBe("Stavba");
    expect(interestLabel("hub")).toBe("Sky Hub");
    expect(interestLabel("")).toBe("—");
    expect(objectTypeLabel("neco")).toBe("neco");
  });
});
