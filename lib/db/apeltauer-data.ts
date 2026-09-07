/**
 * Naplnění produkce skutečnými klienty.
 *
 * Idempotentní podle id — opakované spuštění lokality nezdvojí a nepřepíše,
 * co jsi mezitím v aplikaci upravil.
 *
 * Nulové hodnoty jsou schválně nulové, ne odhadnuté: km, měsíční cena,
 * poplatek za zřízení a výjezdy na Ostrově zatím nikdo neví. Falešně
 * vyplněné číslo je horší než nula, protože nulu je vidět.
 */
import { eq, inArray } from "drizzle-orm";
import { clients, locations } from "./schema";
import type { AnyPgDatabase } from "./seed-core";
import { offMap } from "./upgrade-timelapse";

/** Položky centrálního rozvaděče — na lokalitách bez sloupu se vypínají. */
const CENTRALNI_BOX = [
  "cam_box",
  "cam_switch",
  "cam_socket",
  "cam_modem",
] as const;

export interface SeedClient {
  id: string;
  name: string;
  contact: string;
  note: string;
}

export interface SeedLocation {
  id: string;
  clientId: string;
  name: string;
  note: string;
  cameras: number;
  camerasTlBig: number;
  camerasTlSmall: number;
  poles: number;
  trips1: number;
  trips2: number;
  off: Record<string, boolean>;
  qty: Record<string, number>;
}

export const APELTAUER_CLIENTS: SeedClient[] = [
  {
    id: "cl_apeltauer",
    name: "Apeltauer",
    contact: "",
    note: "",
  },
  {
    id: "cl_kerosin",
    name: "Kerosin",
    contact: "",
    note: "",
  },
];

export const APELTAUER_LOCATIONS: SeedLocation[] = [
  {
    id: "loc_mirovka_bess",
    clientId: "cl_apeltauer",
    name: "Mírovka BESS",
    note:
      "5 kamer na 3 sloupech: 3 bezpečnostní a 2 velké časosběrné. " +
      "Instalační box, switch, zásuvka a modem jsou 1× na centrálním sloupu. " +
      "Starlink je klientův, Sky Guard ho nenese.",
    cameras: 3,
    camerasTlBig: 2,
    camerasTlSmall: 0,
    poles: 3,
    trips1: 12,
    trips2: 12,
    // Starlink platí klient, proto se do nákladů nepočítá.
    off: offMap(["cam_starlink"]),
    // solární panel se tu nepoužívá, proto v mapě není vůbec
    qty: { cam_sim_tmobile: 1 },
  },
  {
    id: "loc_klanecna",
    clientId: "cl_apeltauer",
    name: "Klanečná",
    note:
      "7 kamer: 6 bezpečnostních a 1 malá časosběrná. " +
      "Rozmístění: centrální sloup 2, druhý sloup 1, třetí sloup 2 (z toho " +
      "1 časosběrná), 2 mimo sloupy — jedna na zdi, jedna u vjezdu. " +
      "Instalační box, switch, zásuvka a modem 1× na centrálním sloupu. " +
      "Starlink na této lokalitě platíme my.",
    cameras: 6,
    camerasTlBig: 0,
    camerasTlSmall: 1,
    poles: 3,
    trips1: 12,
    trips2: 12,
    off: {},
    qty: { cam_sim_tmobile: 1, cam_solar: 1 },
  },
  {
    id: "loc_jasminova",
    clientId: "cl_apeltauer",
    name: "Jasmínová",
    note:
      "1 malá časosběrná kamera se solárním panelem, bez sloupu. " +
      "Bez centrálního rozvaděče, bez Starlinku.",
    cameras: 0,
    camerasTlBig: 0,
    camerasTlSmall: 1,
    poles: 0,
    trips1: 5,
    trips2: 5,
    off: offMap([...CENTRALNI_BOX, "cam_starlink"]),
    qty: { cam_sim_tmobile: 1, cam_solar: 1 },
  },
  {
    id: "loc_ostrov",
    clientId: "cl_kerosin",
    name: "Ostrov",
    note:
      "2 malé časosběrné kamery se solárními panely, bez sloupu. " +
      "Bez centrálního rozvaděče, bez Starlinku. Počet výjezdů zatím neznámý.",
    cameras: 0,
    camerasTlBig: 0,
    camerasTlSmall: 2,
    poles: 0,
    trips1: 0,
    trips2: 0,
    off: offMap([...CENTRALNI_BOX, "cam_starlink"]),
    qty: { cam_sim_tmobile: 2, cam_solar: 2 },
  },
];

export interface LoadReport {
  clientsAdded: string[];
  locationsAdded: string[];
  alreadyPresent: string[];
  testDataRemoved: string[];
}

export async function loadApeltauerData(
  db: AnyPgDatabase,
  opts: { removeTestData?: boolean } = {},
): Promise<LoadReport> {
  const report: LoadReport = {
    clientsAdded: [],
    locationsAdded: [],
    alreadyPresent: [],
    testDataRemoved: [],
  };

  const existingClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(inArray(clients.id, APELTAUER_CLIENTS.map((c) => c.id)));
  const haveClients = new Set(existingClients.map((r) => r.id));

  for (const c of APELTAUER_CLIENTS) {
    if (haveClients.has(c.id)) {
      report.alreadyPresent.push(c.id);
      continue;
    }
    await db.insert(clients).values(c);
    report.clientsAdded.push(c.id);
  }

  const existingLocs = await db
    .select({ id: locations.id })
    .from(locations)
    .where(inArray(locations.id, APELTAUER_LOCATIONS.map((l) => l.id)));
  const haveLocs = new Set(existingLocs.map((r) => r.id));

  for (const [idx, l] of APELTAUER_LOCATIONS.entries()) {
    if (haveLocs.has(l.id)) {
      report.alreadyPresent.push(l.id);
      continue;
    }
    await db.insert(locations).values({
      id: l.id,
      clientId: l.clientId,
      name: l.name,
      note: l.note,
      product: "cam",
      cameras: l.cameras,
      camerasTlBig: l.camerasTlBig,
      camerasTlSmall: l.camerasTlSmall,
      poles: l.poles,
      docks: 0,
      // Neznámé hodnoty zůstávají na nule, ať je vidět, že chybí.
      km: 0,
      hours: 0,
      trips1: l.trips1,
      trips2: l.trips2,
      price: 0,
      setupFee: 0,
      commitmentMonths: 24,
      off: l.off,
      over: {},
      qty: l.qty,
      sort: idx * 10,
    });
    report.locationsAdded.push(l.id);
  }

  if (opts.removeTestData) {
    const test = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients);
    for (const c of test) {
      if (/Zemědělské družstvo Vysočina|KONTROLA|Ukázkový/i.test(c.name)) {
        await db.delete(clients).where(eq(clients.id, c.id));
        report.testDataRemoved.push(c.name);
      }
    }
  }

  return report;
}
