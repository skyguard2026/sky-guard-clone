"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createClient,
  deleteClient,
  updateClient,
  type ClientInput,
} from "@/app/actions/clients";
import {
  createLocation,
  deleteLocation,
  updateLocation,
} from "@/app/actions/locations";
import { ClientDialog } from "@/components/ClientDialog";
import { LocationDialog, type LocationInput } from "@/components/LocationDialog";
import { useToast } from "@/components/Toast";
import { ConfirmButton } from "@/components/ui";
import { calc } from "@/lib/calc";
import { money, marginColor, perc } from "@/lib/format";
import { PRODUCT } from "@/lib/labels";
import { setActiveLocationCookie } from "@/lib/active-location-client";
import { HUB } from "@/lib/hub-path";
import type {
  CatalogItem,
  ClientWithLocations,
  Location,
  Settings,
} from "@/lib/types";

export function ClientsClient({
  clients,
  catalog,
  settings,
  locationCount,
}: {
  clients: ClientWithLocations[];
  catalog: CatalogItem[];
  settings: Settings;
  locationCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [clientDlg, setClientDlg] = useState<{
    open: boolean;
    client: ClientWithLocations | null;
  }>({ open: false, client: null });
  const [locDlg, setLocDlg] = useState<{
    open: boolean;
    location: Location | null;
    presetClientId?: string;
  }>({ open: false, location: null });

  const pick = (id: string) => {
    setActiveLocationCookie(id);
    router.push(HUB);
  };

  const saveClient = (v: ClientInput) => {
    const editing = clientDlg.client;
    startTransition(async () => {
      const res = editing
        ? await updateClient(editing.id, v)
        : await createClient(v);
      if (!res.ok) return toast(res.error);
      setClientDlg({ open: false, client: null });
      toast(editing ? "Klient upraven" : "Klient založen");
      router.refresh();
    });
  };

  const saveLoc = (v: LocationInput) => {
    const editing = locDlg.location;
    startTransition(async () => {
      if (editing) {
        const res = await updateLocation(editing.id, v);
        if (!res.ok) return toast(res.error);
        toast("Lokalita upravena");
      } else {
        const res = await createLocation(v);
        if (!res.ok) return toast(res.error);
        // nová lokalita se rovnou stane aktivní v tomhle prohlížeči
        setActiveLocationCookie(res.id);
        toast("Lokalita založena");
      }
      setLocDlg({ open: false, location: null });
      router.refresh();
    });
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 9,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => setClientDlg({ open: true, client: null })}
        >
          Nový klient
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!clients.length}
          onClick={() => setLocDlg({ open: true, location: null })}
        >
          Nová lokalita
        </button>
      </div>

      {clients.length ? (
        clients.map((c) => (
          <div className="card" key={c.id}>
            <h2>
              <span className="tag" />
              {c.name}
              <div className="right">
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {c.contact ? `${c.contact} · ` : ""}
                  {c.locations.length} lokalit
                </span>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setClientDlg({ open: true, client: c })}
                >
                  Upravit
                </button>
                <ConfirmButton
                  question={`Smazat klienta „${c.name}" i s ${c.locations.length} lokalitami?`}
                  onConfirm={() =>
                    startTransition(async () => {
                      await deleteClient(c.id);
                      toast("Klient smazán");
                      router.refresh();
                    })
                  }
                >
                  Smazat
                </ConfirmButton>
              </div>
            </h2>
            {c.note ? <div className="note">{c.note}</div> : null}
            {c.locations.length ? (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Lokalita</th>
                      <th className="hide-narrow">Produkt</th>
                      <th className="n">Jednorázově</th>
                      <th className="n">Plný náklad</th>
                      <th className="n">Cena</th>
                      <th className="n">Marže</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {c.locations.map((l) => {
                      const r = calc(l, catalog, settings, locationCount);
                      return (
                        <tr key={l.id}>
                          <td>
                            <b>{l.name}</b>
                            {l.note ? (
                              <div
                                className="muted"
                                style={{
                                  fontSize: 12,
                                  maxWidth: 320,
                                  overflowWrap: "break-word",
                                  hyphens: "auto",
                                }}
                              >
                                {l.note}
                              </div>
                            ) : null}
                          </td>
                          <td className="hide-narrow">
                            <span className="pill">{PRODUCT[l.product]}</span>
                          </td>
                          <td className="n">{money(r.day0)}</td>
                          <td className="n">{money(r.fullMonthly)}</td>
                          <td className="n">{money(l.price)}</td>
                          <td
                            className="n"
                            style={{ color: marginColor(r.margin) }}
                          >
                            {l.price > 0 ? perc(r.margin) : "—"}
                          </td>
                          <td className="n acts">
                            <span>
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => pick(l.id)}
                            >
                              Počítat
                            </button>
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() =>
                                setLocDlg({ open: true, location: l })
                              }
                            >
                              Upravit
                            </button>
                            <ConfirmButton
                              question={`Smazat lokalitu „${l.name}"?`}
                              onConfirm={() =>
                                startTransition(async () => {
                                  await deleteLocation(l.id);
                                  toast("Lokalita smazána");
                                  router.refresh();
                                })
                              }
                            >
                              Smazat
                            </ConfirmButton>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                Žádná lokalita.{" "}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() =>
                    setLocDlg({
                      open: true,
                      location: null,
                      presetClientId: c.id,
                    })
                  }
                >
                  Přidat lokalitu
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="card">
          <div className="empty">
            <b>Zatím žádný klient</b>
            Začni tlačítkem Nový klient nahoře.
          </div>
        </div>
      )}

      <ClientDialog
        open={clientDlg.open}
        client={clientDlg.client}
        onClose={() => setClientDlg({ open: false, client: null })}
        onSave={saveClient}
      />
      <LocationDialog
        open={locDlg.open}
        location={locDlg.location}
        clients={clients}
        presetClientId={locDlg.presetClientId}
        onClose={() => setLocDlg({ open: false, location: null })}
        onSave={saveLoc}
      />
    </>
  );
}
