"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** L'adresse du destinataire et le bouton d'envoi d'un repreneur. Réservé au poste des fondateurs. */
export default function Envoi({ code, dossier, siren, courriel, peut, essai }: { code: string; dossier: string; siren: string; courriel: string; peut: "envoyer" | "relancer" | null; essai: boolean }) {
  const routeur = useRouter();
  const [adresse, setAdresse] = useState(courriel);
  const [occupe, setOccupe] = useState("");
  const [retour, setRetour] = useState<{ texte: string; bon: boolean } | null>(null);

  async function agir(action: "courriel" | "envoyer" | "relancer") {
    setOccupe(action);
    setRetour(null);
    try {
      const rep = await fetch("/api/poste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, dossier, siren, action, courriel: adresse }) });
      const corps = (await rep.json().catch(() => ({}))) as { erreur?: string; essai?: boolean };
      if (!rep.ok) setRetour({ texte: corps.erreur ?? "L'opération a échoué.", bon: false });
      else {
        setRetour({ texte: action === "courriel" ? "Adresse enregistrée." : corps.essai ? "Parti en essai, vers l'adresse de l'équipe." : "Parti vers le repreneur.", bon: true });
        routeur.refresh();
      }
    } catch {
      setRetour({ texte: "Le réseau n'a pas répondu.", bon: false });
    }
    setOccupe("");
  }

  return (
    <div className="envoi">
      <label>
        <span>Adresse du destinataire</span>
        <input type="email" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="prenom.nom@societe.fr" autoComplete="off" />
      </label>
      <button className="bouton petit" type="button" disabled={Boolean(occupe) || adresse.trim() === courriel} onClick={() => agir("courriel")}>{occupe === "courriel" ? "…" : "Enregistrer"}</button>
      {peut && (
        <button className="bouton petit" type="button" disabled={Boolean(occupe)} onClick={() => agir(peut)}>
          {occupe === peut ? "Envoi…" : `${peut === "envoyer" ? "Envoyer le premier message" : "Relancer"}${essai ? " (essai)" : ""}`}
        </button>
      )}
      {retour && <small className={retour.bon ? "retour" : "retour alerte"}>{retour.texte}</small>}
    </div>
  );
}
