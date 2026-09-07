/**
 * Dekódování nahraného souboru na text.
 *
 * České banky exportují CSV ve windows-1250 stejně často jako v UTF-8 a nic
 * v souboru to neříká. Špatný odhad se nepozná na číslech, ale na názvech
 * protistran — a ty jsou to jediné, podle čeho se transakce zařazuje.
 * Sázíme proto na to, že UTF-8 je samoopravný kód: neplatnou sekvenci
 * `fatal: true` odmítne, kdežto windows-1250 spolkne každý bajt.
 */

export type Encoding = "utf-8" | "windows-1250";

export interface DecodeResult {
  text: string;
  encoding: Encoding;
  /** true, když se kódování odhadovalo, protože soubor nemá BOM. */
  guessed: boolean;
}

const BOM_UTF8 = [0xef, 0xbb, 0xbf];

export function decodeStatement(bytes: Uint8Array): DecodeResult {
  const hasBom = BOM_UTF8.every((b, i) => bytes[i] === b);
  if (hasBom) {
    return {
      text: new TextDecoder("utf-8").decode(bytes),
      encoding: "utf-8",
      guessed: false,
    };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text, encoding: "utf-8", guessed: true };
  } catch {
    return {
      text: new TextDecoder("windows-1250").decode(bytes),
      encoding: "windows-1250",
      guessed: true,
    };
  }
}
