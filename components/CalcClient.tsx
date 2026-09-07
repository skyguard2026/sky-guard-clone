"use client";

import { Fragment, useMemo, useState } from "react";
import {
  patchLocation,
  setLocationOff,
  setLocationOver,
  setLocationQty,
  type LocationPatch,
} from "@/app/actions/locations";
import { CashChart } from "@/components/CashChart";
import {
  CellInput,
  NumberField,
  Segmented,
  Stepper,
  Toggle,
} from "@/components/ui";
import { OffersCard } from "@/components/OffersCard";
import { ProductCompareCard } from "@/components/ProductCompareCard";
import { SensitivityCard } from "@/components/SensitivityCard";
import { residualValue } from "@/lib/residual";
import { NO_WARNINGS_HINT, locationWarnings } from "@/lib/warnings";
import { calc, type CalcLine } from "@/lib/calc";
import type { Offer } from "@/lib/offer-types";
import { money, moneyK, num, perc, plural } from "@/lib/format";
import { CAT, DRIVER } from "@/lib/labels";
import type {
  CatalogItem,
  LocationWithClient,
  Product,
  Settings,
} from "@/lib/types";
import { useWriteQueue } from "@/lib/use-write-queue";

const CAT_KEYS = ["hw", "sw", "net", "ops", "lab"] as const;

export function CalcClient({
  location,
  catalog,
  settings,
  locationCount,
  offers,
}: {
  location: LocationWithClient;
  catalog: CatalogItem[];
  settings: Settings;
  locationCount: number;
  offers: Offer[];
}) {
  const [loc, setLoc] = useState(location);
  const { push, pushNow, saving } = useWriteQueue();

  const r = useMemo(
    () => calc(loc, catalog, settings, locationCount),
    [loc, catalog, settings, locationCount],
  );

  /** Změna skalárního pole. Na server jde jen to jedno pole. */
  const setField = (patch: LocationPatch, immediate = false) => {
    setLoc((p) => ({ ...p, ...patch }));
    const key = Object.keys(patch).join(",");
    const job = () => patchLocation(loc.id, patch);
    if (immediate) pushNow(key, job);
    else push(key, job);
  };

  const toggleOff = (itemId: string) => {
    const next = !loc.off[itemId];
    setLoc((p) => {
      const off = { ...p.off };
      if (next) off[itemId] = true;
      else delete off[itemId];
      return { ...p, off };
    });
    pushNow(`off:${itemId}`, () => setLocationOff(loc.id, itemId, next));
  };

  const setOver = (item: CatalogItem, value: number | null) => {
    // Návrat na katalogovou cenu klíč z mapy rovnou vyhodí.
    const clear = value === null || value === item.price;
    setLoc((p) => {
      const over = { ...p.over };
      if (clear) delete over[item.id];
      else over[item.id] = value as number;
      return { ...p, over };
    });
    push(`over:${item.id}`, () =>
      setLocationOver(loc.id, item.id, clear ? null : (value as number)),
    );
  };

  const setQty = (itemId: string, value: number) => {
    setLoc((p) => ({ ...p, qty: { ...p.qty, [itemId]: value } }));
    push(`qty:${itemId}`, () => setLocationQty(loc.id, itemId, value));
  };

  const kamerCelkem =
    (loc.cameras || 0) + (loc.camerasTlBig || 0) + (loc.camerasTlSmall || 0);
  const isCam = loc.product === "cam" || loc.product === "both";
  const isDr = loc.product === "drone" || loc.product === "both";

  // Rozpad pro barevný pruh — jen kladné podíly.
  const compTotal =
    CAT_KEYS.reduce((s, k) => s + Math.max(0, r.byCat[k] ?? 0), 0) || 1;

  // Pravidla jsou v lib/warnings.ts, aby se dala testovat — text vedle čísla
  // se rozejde s realitou stejně snadno jako číslo samo.
  const warnings = useMemo(
    () => locationWarnings(loc, catalog, r),
    [loc, catalog, r],
  );

  const paybackClass =
    r.payback === null
      ? r.flow[r.horizon] >= 0
        ? "good"
        : "bad"
      : r.payback <= 18
        ? "good"
        : r.payback <= 30
          ? "warn"
          : "bad";
  const marginClass =
    r.margin >= 0.4 ? "good" : r.margin >= 0.2 ? "warn" : "bad";
  const afterTax =
    r.flow[r.horizon] - Math.max(0, r.flow[r.horizon]) * (settings.tax / 100);

  // Zbytková hodnota je samostatný ukazatel — do hotovosti ani marže
  // nevstupuje, jen říká, co po odchodu klienta zbude.
  const residual = useMemo(
    () => residualValue(r, settings),
    [r, settings],
  );

  const groups: [string, CalcLine[]][] = [
    ["Hardware — amortizuje se", r.capex],
    ["Uvedení do provozu", r.startup],
    ["Ročně", r.yearly],
    ["Měsíčně", r.monthly],
  ];
  const offIds = Object.keys(loc.off).filter((k) => loc.off[k]);

  return (
    <>
      <div className="card">
        <div className="kpis">
          <div className="kpi">
            <label>Jednorázově při spuštění</label>
            <div className="v">{money(r.day0)}</div>
            <div className="sub">
              HW {moneyK(r.capexTotal)} · instalace {moneyK(r.startupTotal)}
              {r.prepaid ? ` · předplatky ${moneyK(r.prepaid)}` : ""}
              {r.setupFee > 0
                ? ` · po poplatku ${moneyK(Math.abs(r.flow[0]))}`
                : ""}
            </div>
          </div>
          <div className="kpi">
            <label>Měsíčně hotovost</label>
            <div className="v">{money(r.monthlyCash)}</div>
            <div className="sub">ročně {moneyK(r.monthlyCash * 12)}</div>
          </div>
          <div className="kpi">
            <label>Amortizace hardwaru</label>
            <div className="v">{money(r.amortMonthly)}</div>
            <div className="sub">měsíčně, účetně</div>
          </div>
          <div className="kpi">
            <label>Plný měsíční náklad</label>
            <div className="v blue">{money(r.fullMonthly)}</div>
            <div className="sub">cenová podlaha</div>
          </div>
        </div>
        <div className="comp">
          <div className="bar">
            {CAT_KEYS.map((k) => {
              const v = r.byCat[k] ?? 0;
              if (v <= 0) return null;
              return (
                <i
                  key={k}
                  style={{
                    width: `${(v / compTotal) * 100}%`,
                    background: CAT[k].c,
                  }}
                />
              );
            })}
          </div>
          <div className="legend">
            {CAT_KEYS.map((k) => {
              const v = r.byCat[k] ?? 0;
              if (v <= 0) return null;
              return (
                <div key={k}>
                  <em style={{ background: CAT[k].c }} />
                  {CAT[k].n} <b>{perc(v / compTotal)}</b>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="cols c2">
        <div>
          <div className="card">
            <h2>
              <span className="tag" />
              Konfigurace
              <small>
                {loc.clientName} · {loc.name}
                {saving > 0 ? " · ukládám…" : ""}
              </small>
            </h2>
            <div className="body">
              <div className="row">
                <div className="lbl">
                  <b>Produkt</b>
                </div>
                <Segmented<Product>
                  value={loc.product}
                  options={[
                    { v: "cam", label: "Sky Cam" },
                    { v: "drone", label: "Sky Guard" },
                    { v: "both", label: "Kombinace" },
                  ]}
                  onChange={(v) => setField({ product: v }, true)}
                />
              </div>

              {isCam ? (
                <>
                  <div className="row">
                    <div className="lbl">
                      <b>Bezpečnostních kamer</b>
                      <i>
                        {kamerCelkem} {plural(kamerCelkem, "kamera", "kamery", "kamer")}{" "}
                        celkem včetně časosběrných
                      </i>
                    </div>
                    <Stepper
                      label="Bezpečnostních kamer"
                      value={loc.cameras}
                      max={60}
                      onChange={(v) => setField({ cameras: v }, true)}
                    />
                  </div>
                  <div className="row">
                    <div className="lbl">
                      <b>Časosběrných velkých</b>
                      <i>Bez mezikusu a průchodky, s kartou a materiálem.</i>
                    </div>
                    <Stepper
                      label="Časosběrných velkých"
                      value={loc.camerasTlBig}
                      max={30}
                      onChange={(v) => setField({ camerasTlBig: v }, true)}
                    />
                  </div>
                  <div className="row">
                    <div className="lbl">
                      <b>Časosběrných malých</b>
                      <i>Bez mezikusu a průchodky, s kartou a materiálem.</i>
                    </div>
                    <Stepper
                      label="Časosběrných malých"
                      value={loc.camerasTlSmall}
                      max={30}
                      onChange={(v) => setField({ camerasTlSmall: v }, true)}
                    />
                  </div>
                  <div className="row">
                    <div className="lbl">
                      <b>Počet sloupů</b>
                      <i>
                        {loc.poles > 0 && kamerCelkem > 0
                          ? `${num(kamerCelkem / loc.poles)} kamery na sloup`
                          : "nosné konstrukce"}
                      </i>
                    </div>
                    <Stepper
                      label="Počet sloupů"
                      value={loc.poles}
                      max={30}
                      onChange={(v) => setField({ poles: v }, true)}
                    />
                  </div>
                </>
              ) : null}

              {isDr ? (
                <div className="row">
                  <div className="lbl">
                    <b>Dokovacích stanic</b>
                  </div>
                  <Stepper
                    label="Dokovacích stanic"
                    value={loc.docks}
                    max={8}
                    onChange={(v) => setField({ docks: v }, true)}
                  />
                </div>
              ) : null}

              <div className="row">
                <div className="lbl">
                  <b>Vzdálenost tam a zpět</b>
                </div>
                <NumberField
                  label="Vzdálenost tam a zpět"
                  value={loc.km}
                  unit="km"
                  onChange={(v) => setField({ km: v })}
                />
              </div>
              <div className="row">
                <div className="lbl">
                  <b>Hodin práce na instalaci</b>
                </div>
                <NumberField
                  label="Hodin práce na instalaci"
                  value={loc.hours}
                  unit="hod"
                  onChange={(v) => setField({ hours: v })}
                />
              </div>
              <div className="row">
                <div className="lbl">
                  <b>Výjezdů v roce 1</b>
                </div>
                <Stepper
                  label="Výjezdů v roce 1"
                  value={loc.trips1}
                  max={40}
                  onChange={(v) => setField({ trips1: v }, true)}
                />
              </div>
              <div className="row">
                <div className="lbl">
                  <b>Výjezdů v roce 2 a dál</b>
                </div>
                <Stepper
                  label="Výjezdů v roce 2 a dál"
                  value={loc.trips2}
                  max={40}
                  onChange={(v) => setField({ trips2: v }, true)}
                />
              </div>
              <div className="row">
                <div className="lbl">
                  <b>Minimální doba závazku</b>
                  <i>Do výpočtu nevstupuje, porovnává se s návratností.</i>
                </div>
                <NumberField
                  label="Minimální doba závazku"
                  value={loc.commitmentMonths}
                  unit="měsíců"
                  width={64}
                  onChange={(v) => setField({ commitmentMonths: v })}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>
              <span className="tag" style={{ background: "var(--green)" }} />
              Cena klientovi
            </h2>
            <div className="body pad">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 6,
                }}
              >
                <NumberField
                  label="Cena klientovi měsíčně"
                  value={loc.price}
                  unit="Kč / měsíc"
                  step={1000}
                  width={120}
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--blue)",
                  }}
                  onChange={(v) => setField({ price: v })}
                />
                <div className="muted" style={{ fontSize: 12.5 }}>
                  bez DPH
                </div>
              </div>
              <input
                type="range"
                aria-label="Cena klientovi posuvníkem"
                min={0}
                max={250000}
                step={1000}
                style={{ width: "100%" }}
                value={Math.min(250000, loc.price)}
                onChange={(e) => setField({ price: Number(e.target.value) })}
              />
              <div className="row" style={{ marginTop: 6 }}>
                <div className="lbl">
                  <b>Poplatek za zřízení</b>
                  <i>
                    Jednorázový příjem při spuštění. Nemění plný měsíční
                    náklad ani marži, jen zkracuje návratnost.
                  </i>
                </div>
                <NumberField
                  label="Poplatek za zřízení"
                  value={loc.setupFee}
                  unit="Kč"
                  step={1000}
                  onChange={(v) => setField({ setupFee: v })}
                />
              </div>
            </div>
            <div className="kpis">
              <div className="kpi">
                <label>Hrubá marže</label>
                <div className={`v ${marginClass}`}>
                  {loc.price > 0 ? perc(r.margin) : "—"}
                </div>
              </div>
              <div className="kpi">
                <label>Zisk měsíčně</label>
                <div className={`v ${r.profit > 0 ? "good" : "bad"}`}>
                  {money(r.profit)}
                </div>
              </div>
              <div className="kpi">
                <label>Návratnost</label>
                <div className={`v ${paybackClass}`}>
                  {r.payback === null
                    ? r.flow[r.horizon] >= 0
                      ? "hned"
                      : `nad ${r.horizon} měs`
                    : `${r.payback} měs`}
                </div>
              </div>
              <div className="kpi">
                <label>Kumulativ {r.horizon} měs</label>
                <div className={`v ${r.flow[r.horizon] > 0 ? "good" : "bad"}`}>
                  {moneyK(r.flow[r.horizon])}
                </div>
                <div className="sub">po dani {moneyK(afterTax)}</div>
              </div>
              <div className="kpi">
                <label>Zbytkový hardware</label>
                <div className="v">{moneyK(residual.total)}</div>
                <div className="sub">
                  {settings.residualRate} % zůstatku, prodleva{" "}
                  {settings.transferDelay} měs · mimo hotovost
                </div>
              </div>
            </div>
            <CashChart r={r} />
            <div className={`note${warnings.length ? " alarm" : ""}`}>
              {warnings.length ? (
                <>
                  Na co si dát pozor:
                  <ul>
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              ) : (
                NO_WARNINGS_HINT
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h2>
            <span className="tag" style={{ background: "var(--violet)" }} />
            Rozpad položek
            <small>
              Cenu i množství v modrém rámečku můžeš přepsat jen pro tuhle
              lokalitu. Šedé hodnoty se počítají z konfigurace.
            </small>
          </h2>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Položka</th>
                  <th className="n">
                    Ks <span className="editable-hint">·&nbsp;ruční</span>
                  </th>
                  <th className="n">
                    Cena za lokalitu{" "}
                    <span className="editable-hint">·&nbsp;přepsatelná</span>
                  </th>
                  <th className="n">Měsíčně</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([title, arr]) =>
                  arr.length ? (
                    <Fragment key={title}>
                      <tr className="group">
                        <td colSpan={5}>{title}</td>
                      </tr>
                      {arr.map((l) => {
                        const it = l.it;
                        const cur = loc.over[it.id] ?? it.price;
                        return (
                          <tr key={it.id}>
                            <td>
                              <Toggle
                                small
                                label={`Započítat ${it.label}`}
                                on={!loc.off[it.id]}
                                onChange={() => toggleOff(it.id)}
                              />
                            </td>
                            <td className="name">
                              <div className="namewrap">
                                <em style={{ background: CAT[it.cat].c }} />
                                <div>
                                  <div>
                                    {it.label}
                                    {l.divided ? (
                                      <span className="pill" style={{ marginLeft: 6 }}>
                                        1/{r.divisor}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {it.life ? `${it.life} měs · ` : ""}
                                    {DRIVER[it.driver].n}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="n">
                              {it.driver === "qty" ? (
                                <CellInput
                                  width60
                                  label={`Množství ${it.label}`}
                                  value={l.q}
                                  onChange={(v) => setQty(it.id, v ?? 0)}
                                />
                              ) : (
                                <span
                                  className="cell-static"
                                  title="Množství se počítá z konfigurace lokality"
                                >
                                  {num(l.q)}
                                </span>
                              )}
                            </td>
                            <td className="n">
                              <CellInput
                                allowNegative
                                step={0.01}
                                label={`Cena ${it.label} na této lokalitě`}
                                value={cur}
                                onChange={(v) => setOver(it, v)}
                              />
                            </td>
                            <td className="n">{money(l.monthly)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ) : null,
                )}

                {offIds.length ? (
                  <>
                    <tr className="group">
                      <td colSpan={5}>Vypnuto na této lokalitě</td>
                    </tr>
                    {offIds.map((id) => {
                      const it = catalog.find((i) => i.id === id);
                      // Osiřelý odkaz po importu staré zálohy — prostě se nezobrazí.
                      if (!it) return null;
                      return (
                        <tr key={id}>
                          <td>
                            <Toggle
                              small
                              label={`Započítat ${it.label}`}
                              on={false}
                              onChange={() => toggleOff(id)}
                            />
                          </td>
                          <td className="name muted">
                            <div className="namewrap">
                              <em style={{ background: "var(--line-2)" }} />
                              {it.label}
                            </div>
                          </td>
                          <td colSpan={3} className="n muted">
                            nezapočítáno
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ) : null}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td>Plný měsíční náklad</td>
                  <td />
                  <td className="n">{money(r.day0)} jednorázově</td>
                  <td className="n">{money(r.fullMonthly)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <ProductCompareCard
        location={loc}
        catalog={catalog}
        settings={settings}
        locationCount={locationCount}
      />

      <SensitivityCard
        location={loc}
        catalog={catalog}
        settings={settings}
        locationCount={locationCount}
      />

      <OffersCard location={loc} offers={offers} />
    </>
  );
}
