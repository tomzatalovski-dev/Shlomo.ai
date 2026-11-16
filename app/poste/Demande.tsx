"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Relie une demande venue de la présentation anonyme au repreneur qui l'a faite. */
export default function Demande({ code, dossier, interet, repreneurs }: { code: string; dossier: string; interet: number; repreneurs: { siren: string; nom: string }[] }) {
  const routeur = useRouter();
  const [siren, setSiren] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [rate, setRate] = useState(false);

  async function relier() {
    setOccupe(true);
    setRate(false);
    const rep = await fetch("/api/poste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, dossier, siren, action: "rattacher", interet }) }).catch(() => null);
    setOccupe(false);
    if (rep?.ok) routeur.refresh();
    else setRate(true);
  }

  return (
    <span className="poste-outils">
      <select value={siren} onChange={(e) => setSiren(e.target.value)} aria-label="Repreneur concerné">
        <option value="">Quel repreneur ?</option>
        {repreneurs.map((r) => <option key={r.siren} value={r.siren}>{r.nom}</option>)}
      </select>
      <button type="button" className="lien" disabled={!siren || occupe} onClick={relier}>{rate ? "Échec, réessayer" : "Relier"}</button>
    </span>
  );
}

/** Range un dossier parmi les essais, ou le remet parmi les vrais. */
export function Essai({ code, dossier, essai }: { code: string; dossier: string; essai: boolean }) {
  const routeur = useRouter();
  const [occupe, setOccupe] = useState(false);
  return (
    <button type="button" className="lien" disabled={occupe} onClick={async () => {
      setOccupe(true);
      await fetch("/api/poste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, dossier, action: "essai", essai: !essai }) }).catch(() => null);
      setOccupe(false);
      routeur.refresh();
    }}>{essai ? "Dossier d'essai : le passer en vrai dossier" : "Marquer comme dossier d'essai"}</button>
  );
}

/** Efface les coordonnées et messages des repreneurs restés sans suite depuis plus longtemps que le délai réglé. */
export function Purge({ code }: { code: string }) {
  const [etat, setEtat] = useState("");
  return (
    <button type="button" className="lien" disabled={etat === "…"} onClick={async () => {
      setEtat("…");
      const rep = await fetch("/api/poste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, action: "purge" }) }).catch(() => null);
      const corps = (await rep?.json().catch(() => null)) as { nettoyes?: number } | null;
      setEtat(rep?.ok ? `${corps?.nettoyes ?? 0} ligne${(corps?.nettoyes ?? 0) > 1 ? "s" : ""} nettoyée${(corps?.nettoyes ?? 0) > 1 ? "s" : ""}` : "Échec");
    }}>{etat && etat !== "…" ? etat : etat === "…" ? "Nettoyage…" : "Effacer les contacts restés sans suite depuis 180 jours"}</button>
  );
}
