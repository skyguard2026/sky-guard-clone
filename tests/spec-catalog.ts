/**
 * Katalog v podobě, ve které vznikly kontrolní hodnoty ze SPEC §4.
 *
 * Kontrolní hodnoty hlídají **výpočetní jádro**, ne aktuální ceník. Kdyby se
 * očekávaná čísla přepisovala pokaždé, když se změní cena nebo přibude
 * položka, přestaly by cokoli hlídat.
 *
 * Kotva proto stojí samostatně: položky, které se z ceníku mezitím odstranily,
 * si nese vlastní, a ty, které přibyly, vynechává. Odvozovat ji ze živého
 * katalogu už nejde — plochý výjezd v něm neexistuje.
 */
import { SEED_CATALOG } from "../lib/defaults";
import type { CatalogItem } from "../lib/types";

/** Položky, které v době vzniku kontrolních hodnot neexistovaly. */
const PRIDANO_POZDEJI = [
  "cam_tl_big",
  "cam_tl_small",
  "cam_solar",
  "cam_sim_tmobile",
  "cam_modem",
  "sh_trip_work",
  "sh_trip_km",
];

/**
 * Položky, které z ceníku zmizely, ale kontrolní hodnoty na nich stojí.
 *
 * Plochý výjezd za 3 300 Kč je v případu A i B podstatná část ročních
 * nákladů, proto tu musí zůstat. Položky, které měly v původním katalogu
 * nulovou cenu, se nevracejí — do výsledku se nikdy nepromítly.
 */
const ODSTRANENO_POZDEJI: CatalogItem[] = [
  {
    id: "sh_trip",
    label: "Výjezd na lokalitu",
    group: "shared",
    cat: "lab",
    price: 3300,
    life: null,
    billing: "yearly",
    driver: "trip",
    shared: false,
    prepay: false,
    enabled: true,
    note: "Auto 1800 a palivo 1500.",
    sort: 330,
  },
];

export function specCatalog(): CatalogItem[] {
  return [
    ...SEED_CATALOG.filter((i) => !PRIDANO_POZDEJI.includes(i.id)).map((i) => ({
      ...i,
    })),
    ...ODSTRANENO_POZDEJI.map((i) => ({ ...i })),
  ];
}
