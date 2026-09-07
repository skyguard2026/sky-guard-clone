/**
 * Rozcestník formátů bankovního výpisu.
 *
 * Formát se pozná z obsahu, ne z přípony. Soubor přejmenovaný na .csv je
 * pořád XML a naopak; přípona je tvrzení uživatele, obsah je fakt.
 */
import { isCamt, parseCamt053 } from "./camt053";
import { parseStatement, type ParsedStatement } from "./rb-csv";

export function parseBankStatement(text: string): ParsedStatement {
  if (isCamt(text)) return parseCamt053(text);

  // Zjevné XML, kterému ale nerozumíme, nemá smysl cpát do CSV parseru —
  // vyrobil by z něj hlášku o chybějícím sloupci s částkou, což uživatele
  // pošle hledat problém úplně jinam, než kde je.
  if (/^\s*<\?xml|^\s*</.test(text.slice(0, 200))) {
    return {
      rows: [],
      problems: [
        {
          line: 1,
          kind: "missing-column",
          detail:
            "Soubor je XML, ale ne výpis camt.053. Z internetového bankovnictví RB stáhni výpis ve formátu XML.",
        },
      ],
      mapping: {} as ParsedStatement["mapping"],
      unmapped: [],
      delimiter: "",
      format: "camt053",
      account: null,
      periodFrom: null,
      periodTo: null,
      ok: false,
    };
  }

  return parseStatement(text);
}

export { isCamt, parseCamt053 } from "./camt053";
export { parseStatement } from "./rb-csv";
export type { ParsedRow, ParsedStatement, ParseProblem } from "./rb-csv";
