"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { logout } from "@/app/actions/auth";
import { resetCatalog } from "@/app/actions/catalog";
import { wipeFinanceData } from "@/app/actions/finance";
import {
  exportAll,
  importAll,
  patchSettings,
  wipeAll,
} from "@/app/actions/settings";
import { useToast } from "@/components/Toast";
import { ConfirmButton, NumberField, Toggle } from "@/components/ui";
import type { Settings } from "@/lib/types";
import { useWriteQueue } from "@/lib/use-write-queue";

export function SettingsClient({ settings }: { settings: Settings }) {
  const router = useRouter();
  const toast = useToast();
  const { push, pushNow } = useWriteQueue();
  const [, startTransition] = useTransition();
  const [s, setS] = useState(settings);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Settings>, immediate = false) => {
    setS((p) => ({ ...p, ...patch }));
    const key = Object.keys(patch).join(",");
    const job = async () => {
      await patchSettings(patch);
      router.refresh();
    };
    if (immediate) pushNow(key, job);
    else push(key, job);
  };

  const doExport = () => {
    startTransition(async () => {
      const json = await exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `skyguard-kalkulace-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Záloha stažena");
    });
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      startTransition(async () => {
        const res = await importAll(String(reader.result));
        if (!res.ok) return toast(res.error);
        toast("Data načtena");
        router.refresh();
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="cols c2">
      <div className="card">
        <h2>
          <span className="tag" />
          Parametry modelu
        </h2>
        <div className="body">
          <div className="row">
            <div className="lbl">
              <b>Dělit sdílené položky</b>
              <i>Společné náklady se rozpočítají mezi všechny lokality.</i>
            </div>
            <Toggle
              label="Dělit sdílené položky"
              on={s.share}
              onChange={(v) => set({ share: v }, true)}
            />
          </div>
          <div className="row">
            <div className="lbl">
              <b>Předplatky platit dopředu</b>
              <i>
                Roční předplatné se zaplatí v měsíci 0 a zvyšuje vstupní
                investici.
              </i>
            </div>
            <Toggle
              label="Předplatky platit dopředu"
              on={s.prepay}
              onChange={(v) => set({ prepay: v }, true)}
            />
          </div>
          <div className="row">
            <div className="lbl">
              <b>Obnovovat hardware</b>
              <i>Po konci životnosti se v simulaci koupí znovu.</i>
            </div>
            <Toggle
              label="Obnovovat hardware"
              on={s.renew}
              onChange={(v) => set({ renew: v }, true)}
            />
          </div>
          <div className="row">
            <div className="lbl">
              <b>Daň z příjmu PO</b>
              <i>Používá se u kumulativu po zdanění.</i>
            </div>
            <NumberField
              label="Daň z příjmu PO"
              value={s.tax}
              unit="%"
              width={64}
              onChange={(v) => set({ tax: v })}
            />
          </div>
          <div className="row">
            <div className="lbl">
              <b>Horizont simulace</b>
              <i>Od 12 do 120 měsíců.</i>
            </div>
            <NumberField
              label="Horizont simulace"
              value={s.horizon}
              unit="měsíců"
              width={64}
              onChange={(v) => set({ horizon: v })}
            />
          </div>
          <div className="row">
            <div className="lbl">
              <b>Inflace ročních položek</b>
              <i>
                Aplikuje se od druhého roku. Software zdražuje 5 až 7 % ročně.
                Rezerva na opravy se neinflatuje — je to procento z hodnoty
                hardwaru, ne korunová částka.
              </i>
            </div>
            <NumberField
              label="Inflace ročních položek"
              value={s.inflation}
              unit="% ročně"
              width={64}
              onChange={(v) => set({ inflation: v })}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>
          <span className="tag" style={{ background: "var(--violet)" }} />
          Zbytková hodnota hardwaru
        </h2>
        <div className="body">
          <div className="row">
            <div className="lbl">
              <b>Realizovatelnost</b>
              <i>
                Kolik z účetního zůstatku se dá reálně zpeněžit. Nízké číslo je
                záměr: dokovací stanice je vázaná na povolení konkrétní
                lokality, takže přesun jinam znamená celé nové povolovací kolo.
              </i>
              <i style={{ color: "var(--amber)", marginTop: 4 }}>
                Výchozích 40 % je odhad, ne měřená hodnota. Až nám první
                stanice někde skutečně poleží, číslo se upraví — do té doby
                s ním počítej jako s předpokladem.
              </i>
            </div>
            <NumberField
              label="Realizovatelnost zbytkové hodnoty"
              value={s.residualRate}
              unit="%"
              width={64}
              onChange={(v) => set({ residualRate: v })}
            />
          </div>
          <div className="row">
            <div className="lbl">
              <b>Prodleva přenosu</b>
              <i>Kolik měsíců technika stojí, než začne zase vydělávat.</i>
            </div>
            <NumberField
              label="Prodleva přenosu"
              value={s.transferDelay}
              unit="měsíců"
              width={64}
              onChange={(v) => set({ transferDelay: v })}
            />
          </div>
        </div>
        <div className="note">
          Zbytková hodnota je samostatný ukazatel. Do hotovosti, marže ani
          návratnosti nevstupuje — je to odhad toho, co ti po odchodu klienta
          zbude, ne příjem.
        </div>
      </div>

      <div>
        <div className="card">
          <h2>
            <span className="tag" style={{ background: "var(--green)" }} />
            Data
          </h2>
          <div className="body">
            <div className="row">
              <div className="lbl">
                <b>Záloha do JSON</b>
                <i>
                  Celá databáze včetně nákupních cen. Interní soubor, nikdy ne
                  podklad pro klienta.
                </i>
              </div>
              <button type="button" className="btn" onClick={doExport}>
                Stáhnout
              </button>
            </div>
            <div className="row">
              <div className="lbl">
                <b>Načíst ze zálohy</b>
                <i>Přepíše všechna současná data.</i>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (
                    window.confirm(
                      "Načtení zálohy přepíše všechna současná data. Pokračovat?",
                    )
                  )
                    doImport(f);
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => fileRef.current?.click()}
              >
                Vybrat soubor
              </button>
            </div>
            <div className="row">
              <div className="lbl">
                <b>Obnovit katalog</b>
                <i>
                  Vrátí ceník do výchozího stavu. Klienti a lokality zůstanou.
                </i>
              </div>
              <ConfirmButton
                className="btn"
                question="Vrátit katalog do výchozího stavu? Přepíše to všechny ručně upravené ceny."
                onConfirm={() =>
                  startTransition(async () => {
                    await resetCatalog();
                    toast("Ceník obnoven");
                    router.refresh();
                  })
                }
              >
                Obnovit
              </ConfirmButton>
            </div>
            <div className="row">
              <div className="lbl">
                <b>Smazat data kalkulačky</b>
                <i>
                  Klienti, lokality i ceník. Bankovních výpisů se to netýká.
                  Nejde vrátit zpět.
                </i>
              </div>
              <ConfirmButton
                className="btn danger"
                question="Smazat klienty, lokality i ceník? Nejde to vrátit zpět. Bankovní výpisy zůstanou."
                onConfirm={() =>
                  startTransition(async () => {
                    await wipeAll();
                    toast("Vymazáno");
                    router.refresh();
                  })
                }
              >
                Smazat vše
              </ConfirmButton>
            </div>
            <div className="row">
              <div className="lbl">
                <b>Smazat bankovní výpisy</b>
                <i>
                  Nahrané výpisy i transakce včetně ručního zařazení. Kategorie
                  a pravidla zůstanou.
                </i>
              </div>
              <ConfirmButton
                className="btn danger"
                question="Smazat všechny nahrané výpisy a transakce? Kategorie a pravidla zůstanou. Nejde to vrátit zpět."
                onConfirm={() =>
                  startTransition(async () => {
                    await wipeFinanceData();
                    toast("Bankovní data vymazána");
                    router.refresh();
                  })
                }
              >
                Smazat výpisy
              </ConfirmButton>
            </div>
          </div>
          <div className="note">
            Data leží ve sdílené databázi, takže je oba vidíte živě z různých
            zařízení. Zálohu si přesto občas stáhni.
          </div>
        </div>

        <div className="card">
          <h2>
            <span className="tag" style={{ background: "var(--amber)" }} />
            Přístup
          </h2>
          <div className="body">
            <div className="row">
              <div className="lbl">
                <b>Odhlásit se</b>
                <i>Zahodí přihlašovací cookie na tomhle zařízení.</i>
              </div>
              <form action={logout}>
                <button type="submit" className="btn">
                  Odhlásit
                </button>
              </form>
            </div>
          </div>
          <div className="note">
            Každý má vlastní účet a heslo. Účty, role i aktivní session se
            spravují v Admin centru; heslo si měníš sám a nikdo jiný ho
            nepřečte.
          </div>
        </div>
      </div>
    </div>
  );
}
