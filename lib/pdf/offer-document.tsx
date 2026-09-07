/**
 * Šablona cenové nabídky pro klienta.
 *
 * Dostane výhradně `OfferDocumentData` — typ, ve kterém nákladová pole,
 * ceny katalogu, marže ani návratnost neexistují. Není to jen konvence:
 * tisknout je odsud nejde, protože je komponenta nemá odkud vzít.
 */
import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { OfferDocumentData } from "../offer-types";
import { PDF, SKY_GUARD } from "./theme";

const fontDir = path.join(process.cwd(), "lib", "pdf", "fonts");
const assetDir = path.join(process.cwd(), "lib", "pdf", "assets");

let registered = false;
/** Fonty se registrují jednou za běh procesu. */
export function registerFonts() {
  if (registered) return;
  Font.register({
    family: "DM Sans",
    fonts: [
      { src: path.join(fontDir, "DMSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "DMSans-Medium.ttf"), fontWeight: 500 },
      { src: path.join(fontDir, "DMSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Bez dělení slov — česká slova by se lámala špatně.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const money = (n: number) =>
  `${Math.round(n).toLocaleString("cs-CZ").replace(/ /g, " ")} Kč`;

const PRODUCT_LABEL: Record<OfferDocumentData["product"], string> = {
  cam: "Sky Cam",
  drone: "Sky Guard",
  both: "Sky Cam + Sky Guard",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "DM Sans",
    fontSize: 10,
    color: PDF.ink,
    backgroundColor: PDF.paper,
    paddingBottom: 92,
  },
  band: {
    backgroundColor: PDF.void,
    paddingHorizontal: 48,
    paddingTop: 26,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  logo: { width: 132 },
  bandRight: { alignItems: "flex-end" },
  bandLabel: {
    color: "#8fa6c4",
    fontSize: 8,
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  bandNumber: { color: "#ffffff", fontSize: 17, fontWeight: 700 },
  bandVersion: { color: PDF.blue, fontSize: 9, marginTop: 3 },

  body: { paddingHorizontal: 48, paddingTop: 26 },

  metaRow: { flexDirection: "row", marginBottom: 22 },
  metaCol: { flex: 1, paddingRight: 16 },
  label: {
    fontSize: 7.5,
    letterSpacing: 1.1,
    color: PDF.ink3,
    marginBottom: 4,
  },
  value: { fontSize: 11, fontWeight: 500 },
  valueSm: { fontSize: 10 },

  h2: {
    fontSize: 8,
    letterSpacing: 1.3,
    color: PDF.ink3,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: PDF.line,
    borderBottomStyle: "solid",
  },
  scope: { fontSize: 10, lineHeight: 1.65, color: PDF.ink2 },

  priceBox: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: PDF.line,
    borderStyle: "solid",
    borderRadius: 6,
    overflow: "hidden",
  },
  priceMain: {
    backgroundColor: PDF.wash,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  priceMainLabel: { fontSize: 9, color: PDF.ink2, marginBottom: 6 },
  priceMainValue: { fontSize: 26, fontWeight: 700, color: PDF.blue },
  priceMainUnit: {
    fontSize: 9,
    color: PDF.ink2,
    marginLeft: 6,
    marginBottom: 5,
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: PDF.line,
    borderTopStyle: "solid",
  },
  priceRowLabel: { fontSize: 10, color: PDF.ink2 },
  priceRowValue: { fontSize: 10, fontWeight: 700 },

  vat: { marginTop: 10, fontSize: 8.5, color: PDF.ink3 },

  note: {
    marginTop: 22,
    fontSize: 9.5,
    lineHeight: 1.6,
    color: PDF.ink2,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 48,
    paddingTop: 14,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: PDF.line,
    borderTopStyle: "solid",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footText: { fontSize: 8, color: PDF.ink3, lineHeight: 1.6 },
  footName: { fontSize: 8, color: PDF.ink2, fontWeight: 700 },
});

export function OfferDocument({ data }: { data: OfferDocumentData }) {
  registerFonts();
  return (
    <Document
      title={`Cenová nabídka ${data.number}`}
      author={SKY_GUARD.name}
      creator={SKY_GUARD.name}
      producer={SKY_GUARD.name}
    >
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          {/* Bílé logo na tmavém pruhu — nepřebarvené, jak má být.
              Image z @react-pdf není <img>, atribut alt nezná. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            style={s.logo}
            src={path.join(assetDir, "logo-sky-guard-white.png")}
          />
          <View style={s.bandRight}>
            <Text style={s.bandLabel}>CENOVÁ NABÍDKA</Text>
            <Text style={s.bandNumber}>{data.number}</Text>
            {data.version > 1 ? (
              <Text style={s.bandVersion}>verze {data.version}</Text>
            ) : null}
          </View>
        </View>

        <View style={s.body}>
          <View style={s.metaRow}>
            <View style={s.metaCol}>
              <Text style={s.label}>KLIENT</Text>
              <Text style={s.value}>{data.clientName}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.label}>LOKALITA</Text>
              <Text style={s.value}>{data.locationName}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.label}>SLUŽBA</Text>
              <Text style={s.value}>{PRODUCT_LABEL[data.product]}</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <View style={s.metaCol}>
              <Text style={s.label}>VYSTAVENO</Text>
              <Text style={s.valueSm}>{data.createdAt}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.label}>PLATNOST DO</Text>
              <Text style={s.valueSm}>{data.validUntil}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.label}>DOBA ZÁVAZKU</Text>
              <Text style={s.valueSm}>{data.commitmentMonths} měsíců</Text>
            </View>
          </View>

          <Text style={s.h2}>ROZSAH SLUŽBY</Text>
          <Text style={s.scope}>{data.scope}</Text>

          <View style={s.priceBox}>
            <View style={s.priceMain}>
              <Text style={s.priceMainLabel}>Měsíční paušál</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text style={s.priceMainValue}>{money(data.monthlyPrice)}</Text>
                <Text style={s.priceMainUnit}>/ měsíc</Text>
              </View>
            </View>
            <View style={s.priceRow}>
              <Text style={s.priceRowLabel}>Jednorázový poplatek za zřízení</Text>
              <Text style={s.priceRowValue}>{money(data.setupFee)}</Text>
            </View>
            <View style={s.priceRow}>
              <Text style={s.priceRowLabel}>Minimální doba závazku</Text>
              <Text style={s.priceRowValue}>
                {data.commitmentMonths} měsíců
              </Text>
            </View>
          </View>

          <Text style={s.vat}>
            Všechny ceny jsou uvedeny bez DPH. Nabídka platí do{" "}
            {data.validUntil}.
          </Text>

          {data.note ? <Text style={s.note}>{data.note}</Text> : null}
        </View>

        <View style={s.footer} fixed>
          <View>
            <Text style={s.footName}>{SKY_GUARD.name}</Text>
            <Text style={s.footText}>
              {SKY_GUARD.street}, {SKY_GUARD.city}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.footText}>IČO {SKY_GUARD.ico}</Text>
            <Text style={s.footText}>{SKY_GUARD.phone}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
