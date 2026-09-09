/**
 * Poptávky z kontaktního formuláře na webu.
 *
 * Hodnoty výběrů jsou klíče, které posílá formulář (public/nova/index.html);
 * popisky tady jsou jediné místo, kde se překládají. Ověření vstupu je čistá
 * funkce, aby se dala otestovat bez serveru.
 */

export const INQUIRY_STATUSES = ["new", "contacted", "closed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "Nová",
  contacted: "V řešení",
  closed: "Vyřízená",
};

export const OBJECT_TYPES: Record<string, string> = {
  industrial: "Průmyslový areál",
  logistics: "Logistika / sklad",
  construction: "Stavba",
  office: "Administrativa",
  other: "Jiný",
};

export const INTERESTS: Record<string, string> = {
  camera: "Sky Camera",
  drone: "Sky Drone",
  fusion: "Kamera + dron / Fusion",
  construction: "Sky Construction",
  hub: "Sky Hub",
  unsure: "Nevím — chci poradit",
};

export function objectTypeLabel(v: string): string {
  return Object.hasOwn(OBJECT_TYPES, v) ? OBJECT_TYPES[v] : v || "—";
}
export function interestLabel(v: string): string {
  return Object.hasOwn(INTERESTS, v) ? INTERESTS[v] : v || "—";
}

export interface InquiryInput {
  name: string;
  company: string;
  email: string;
  phone: string;
  objectType: string;
  interest: string;
  message: string;
}

export interface Inquiry extends InquiryInput {
  id: string;
  createdAt: string;
  status: InquiryStatus;
  note: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string") return v.trim();
  }
  return "";
}

/**
 * Ověří a ořeže data z formuláře. Přijímá jak názvy polí z HTML
 * (object_type), tak camelCase (objectType), aby šlo endpoint volat i ručně.
 */
export function parseInquiry(
  raw: Record<string, unknown>,
): { ok: true; value: InquiryInput } | { ok: false; error: string } {
  const name = str(raw, "name").slice(0, 200);
  const email = str(raw, "email").slice(0, 200);
  const objectType = str(raw, "object_type", "objectType").slice(0, 40);
  const interest = str(raw, "interest").slice(0, 40);

  if (name.length < 2) return { ok: false, error: "Zadejte prosím své jméno." };
  if (!EMAIL.test(email))
    return { ok: false, error: "Zadejte platnou e-mailovou adresu." };
  if (!objectType || !Object.hasOwn(OBJECT_TYPES, objectType))
    return { ok: false, error: "Vyberte prosím typ objektu." };
  if (interest && !Object.hasOwn(INTERESTS, interest))
    return { ok: false, error: "Neplatná volba zájmu." };

  return {
    ok: true,
    value: {
      name,
      company: str(raw, "company").slice(0, 200),
      email,
      phone: str(raw, "phone").slice(0, 60),
      objectType,
      interest,
      message: str(raw, "message").slice(0, 4000),
    },
  };
}

export function isInquiryStatus(v: unknown): v is InquiryStatus {
  return (
    typeof v === "string" && (INQUIRY_STATUSES as readonly string[]).includes(v)
  );
}
