"use client";

import { useState } from "react";
import type { ClientInput } from "@/app/actions/clients";
import { Modal } from "@/components/ui";
import type { ClientWithLocations } from "@/lib/types";

function ClientForm({
  client,
  onClose,
  onSave,
}: {
  client: ClientWithLocations | null;
  onClose: () => void;
  onSave: (v: ClientInput) => void;
}) {
  const [v, setV] = useState<ClientInput>(
    client
      ? { name: client.name, contact: client.contact, note: client.note }
      : { name: "", contact: "", note: "" },
  );
  const [error, setError] = useState("");

  return (
    <>
      <div className="dbody">
        <div className="field">
          <label htmlFor="c-name">Název</label>
          <input
            id="c-name"
            type="text"
            autoFocus
            value={v.name}
            onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="c-contact">Kontakt</label>
          <input
            id="c-contact"
            type="text"
            value={v.contact}
            onChange={(e) => setV((p) => ({ ...p, contact: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="c-note">Poznámka</label>
          <textarea
            id="c-note"
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
              setError("Vyplň název klienta.");
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

export function ClientDialog({
  open,
  client,
  onClose,
  onSave,
}: {
  open: boolean;
  client: ClientWithLocations | null;
  onClose: () => void;
  onSave: (v: ClientInput) => void;
}) {
  return (
    <Modal
      open={open}
      title={client ? "Úprava klienta" : "Nový klient"}
      onClose={onClose}
    >
      <ClientForm
        key={client?.id ?? "novy"}
        client={client}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}
