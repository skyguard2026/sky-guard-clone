import {
  interestLabel,
  objectTypeLabel,
  STATUS_LABEL,
  type Inquiry,
  type InquiryStatus,
} from "./inquiries";

export type InquiryFilter = "all" | InquiryStatus;
export type InquirySort = "newest" | "oldest";
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs");

export function selectInquiries(
  items: Inquiry[],
  filter: InquiryFilter,
  query: string,
  sort: InquirySort,
): Inquiry[] {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return items
    .filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      const text = normalize(
        [
          item.name,
          item.company,
          item.email,
          item.phone,
          item.message,
          item.note,
          objectTypeLabel(item.objectType),
          interestLabel(item.interest),
        ].join(" "),
      );
      return words.every((word) => text.includes(word));
    })
    .sort(
      (a, b) =>
        (sort === "newest" ? -1 : 1) *
        (Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
}

/** Quote every cell; neutralize spreadsheet formulas in untrusted form data. */
function csvCell(value: string): string {
  const safe =
    /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function inquiriesCsv(items: Inquiry[]): string {
  const rows = [
    [
      "Přijato",
      "Jméno",
      "Společnost",
      "E-mail",
      "Telefon",
      "Objekt",
      "Zájem",
      "Stav",
      "Zpráva",
      "Interní poznámka",
    ],
    ...items.map((q) => [
      q.createdAt,
      q.name,
      q.company,
      q.email,
      q.phone,
      objectTypeLabel(q.objectType),
      interestLabel(q.interest),
      STATUS_LABEL[q.status],
      q.message,
      q.note,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
