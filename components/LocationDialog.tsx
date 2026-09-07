"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { PRODUCT } from "@/lib/labels";
import type { ClientWithLocations, Location, Product } from "@/lib/types";

export interface LocationInput {
  clientId: string;
  name: string;
  product: Product;
  price: number;
  km: number;
  note: string;
}

function LocationForm({
  location,
  clients,
  presetClientId,
  onClose,
  onSave,
}: {
  location: Location | null;
  clients: ClientWithLocations[];
  presetClientId?: string;
  onClose: () => void;
  onSave: (v: LocationInput) => void;
}) {
  const [v, setV] = useState<LocationInput>(
    location
      ? {
          clientId: location.clientId,
          name: location.name,
          product: location.product,
          price: location.price,
          km: location.km,
          note: location.note,
        }
      : {
          clientId: presetClientId || clients[0]?.id || "",
          name: "",
          product: "drone",
          price: 50000,
          km: 0,
          note: "",
        },
  );
  const [error, setError] = useState("");

  return (
    <>
      <div className="dbody">
        <div className="field">
          <label htmlFor="l-client">Klient</label>
          <select
            id="l-client"
            value={v.clientId}
            onChange={(e) => setV((p) => ({ ...p, clientId: e.target.value }))}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="l-name">Název lokality</label>
          <input
            id="l-name"
            type="text"
            autoFocus
            value={v.name}
            onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="f2">
          <div className="field">
            <label htmlFor="l-product">Produkt</label>
            <select
              id="l-product"
              value={v.product}
              onChange={(e) =>
                setV((p) => ({ ...p, product: e.target.value as Product }))
              }
            >
              {(Object.keys(PRODUCT) as Product[]).map((p) => (
                <option key={p} value={p}>
                  {PRODUCT[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="l-price">Cena klientovi měsíčně</label>
            <input
              id="l-price"
              className="plain"
              type="number"
              step="1000"
              value={v.price}
              onChange={(e) =>
                setV((p) => ({ ...p, price: Number(e.target.value) }))
              }
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="l-km">Vzdálenost tam a zpět v km</label>
          <input
            id="l-km"
            className="plain"
            type="number"
            value={v.km}
            onChange={(e) => setV((p) => ({ ...p, km: Number(e.target.value) }))}
          />
          <div className="hint">
            Zbylé vstupy — počty kamer, sloupů a stanic, hodiny a výjezdy — se
            nastavují přímo v Kalkulaci.
          </div>
        </div>
        <div className="field">
          <label htmlFor="l-note">Poznámka</label>
          <textarea
            id="l-note"
            value={v.note}
            onChange={(e) => setV((p) => ({ ...p, note: e.target.value }))}
          />
        </div>
        {error ? (
          <div style={{ color: "var(--red)", fontSize: 13 }}>{error}</div>
        ) : null}
      </div>
      <div className="dfoot">
        <button type="button" className="btn" onClick={onClose}>
          Zrušit
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            if (!v.name.trim()) {
              setError("Vyplň název lokality.");
              return;
            }
            if (!v.clientId) {
              setError("Nejdřív založ klienta.");
              return;
            }
            onSave(v);
          }}
        >
          Uložit
        </button>
      </div>
    </>
  );
}

export function LocationDialog({
  open,
  location,
  clients,
  presetClientId,
  onClose,
  onSave,
}: {
  open: boolean;
  location: Location | null;
  clients: ClientWithLocations[];
  presetClientId?: string;
  onClose: () => void;
  onSave: (v: LocationInput) => void;
}) {
  return (
    <Modal
      open={open}
      title={location ? "Úprava lokality" : "Nová lokalita"}
      onClose={onClose}
    >
      <LocationForm
        key={location?.id ?? `novy-${presetClientId ?? ""}`}
        location={location}
        clients={clients}
        presetClientId={presetClientId}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}
