/**
 * Datový model podle SPEC.md §2.
 * Tenhle soubor nesmí importovat nic z databáze ani z Reactu —
 * typy sdílí výpočetní jádro, server i klient.
 */

export type Group = "cam" | "drone" | "shared";
export type Cat = "hw" | "sw" | "net" | "ops" | "lab";
export type Billing = "oneoff" | "monthly" | "yearly";
export type Driver =
  | "site"
  | "camera"
  | "cameraAll"
  | "tlBig"
  | "tlSmall"
  | "pole"
  | "dock"
  | "km"
  | "hour"
  | "trip"
  | "tripKm"
  | "pctHw"
  | "qty";
export type Product = "cam" | "drone" | "both";

/** Nákladová položka katalogu. */
export interface CatalogItem {
  id: string;
  label: string;
  group: Group;
  cat: Cat;
  /** Kč, u driveru pctHw procenta. Může být záporná (slevy). */
  price: number;
  /** Životnost v měsících. Vyplněno = amortizuje se. */
  life: number | null;
  billing: Billing;
  driver: Driver;
  /** Dělí se mezi všechny lokality v portfoliu. */
  shared: boolean;
  /** Jen u yearly: platí se dopředu na celý rok. */
  prepay: boolean;
  enabled: boolean;
  note: string;
  sort: number;
}

export interface Client {
  id: string;
  name: string;
  contact: string;
  note: string;
  createdAt?: Date | string;
}

/** Vstupy lokality, které potřebuje výpočet. */
export interface CalcLocation {
  product: Product;
  /** Bezpečnostní kamery. Časosběrné se počítají zvlášť. */
  cameras: number;
  /** Časosběrné kamery velké. */
  camerasTlBig: number;
  /** Časosběrné kamery malé. */
  camerasTlSmall: number;
  poles: number;
  docks: number;
  km: number;
  hours: number;
  trips1: number;
  trips2: number;
  /** Měsíční cena klientovi v Kč. */
  price: number;
  /**
   * Jednorázový poplatek za zřízení, který platí klient. Je to příjem, ne
   * náklad — nevstupuje do fullMonthly ani do marže, jen posouvá start
   * kumulativní hotovosti, a tím zkracuje návratnost.
   */
  setupFee: number;
  /** { itemId: true } — položka se na této lokalitě nezapočítává. */
  off: Record<string, boolean>;
  /** { itemId: number } — přepsaná cena položky. */
  over: Record<string, number>;
  /** { itemId: number } — množství pro driver qty. */
  qty: Record<string, number>;
}

export interface Location extends CalcLocation {
  id: string;
  clientId: string;
  name: string;
  note: string;
  /**
   * Minimální doba závazku v měsících. Do výpočtu nevstupuje, ale porovnává
   * se s návratností — u dronu je vstupní investice přes půl milionu, takže
   * délka kontraktu rozhoduje o tom, jestli obchod dává smysl.
   */
  commitmentMonths: number;
  sort?: number;
}

/** Lokalita obohacená o jméno klienta, jak ji potřebuje UI. */
export interface LocationWithClient extends Location {
  clientName: string;
}

export interface Settings {
  /** Sdílené položky dělit počtem lokalit. */
  share: boolean;
  /** Roční předplatky platit dopředu v měsíci 0. */
  prepay: boolean;
  /** Obnovovat hardware po konci životnosti. */
  renew: boolean;
  /** Sazba daně z příjmu PO v %. */
  tax: number;
  /** Délka simulace v měsících. */
  horizon: number;
  /**
   * Roční inflace u ročních položek v %. Aplikuje se od druhého roku.
   * Položky s driverem pctHw se neinflatují — jsou to procenta z hodnoty
   * hardwaru, ne korunová částka.
   */
  inflation: number;
  /**
   * Kolik z účetní zbytkové hodnoty hardwaru se dá reálně zpeněžit, v %.
   * Nízké číslo je záměr: dokovací stanice je vázaná na povolení konkrétní
   * lokality, přesun jinam znamená celé nové povolovací kolo.
   */
  residualRate: number;
  /** Kolik měsíců trvá přesun hardwaru, než začne zase vydělávat. */
  transferDelay: number;
}

export interface ClientWithLocations extends Client {
  locations: Location[];
}
