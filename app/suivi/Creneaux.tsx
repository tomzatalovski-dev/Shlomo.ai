"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { direCreneau } from "@/lib/creneaux";

/** Les disponibilités du vendeur pour rencontrer un repreneur. Chaque repreneur autorisé en choisit une ; un créneau pris n'est plus proposé. */
export function Creneaux({ jeton, creneaux, pris }: { jeton: string; creneaux: string[]; pris: { creneau: string; nom: string }[] }) {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(creneaux.length === 0);
  const [saisie, setSaisie] = useState<string[]>([...creneaux, "", "", ""].slice(0, Math.max(3, creneaux.length)));
  const [etat, setEtat] = useState<"saisie" | "envoi">("saisie");
  const [erreur, setErreur] = useState("");
  const propres = [...new Set(saisie.filter(Boolean))];

  async function valider() {
    setEtat("envoi");
    setErreur("");
    const rep = await fetch("/api/suivi/creneaux", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, creneaux: propres }) }).catch(() => null);
    setEtat("saisie");
    if (rep?.ok) {
      setOuvert(false);
      routeur.refresh();
    } else setErreur("Ces dates n'ont pas pu être enregistrées. Réessayez.");
  }

  if (!ouvert) {
    return (
      <div className="carte">
        <p className="message"><b>Vos disponibilités pour une rencontre.</b> Les repreneurs à qui vous avez communiqué votre nom en choisissent une.</p>
        <ul className="faits">
          {creneaux.map((c) => {
            const qui = pris.find((p) => p.creneau === c);
            return <li key={c}>{direCreneau(c)}{qui ? `, choisi par ${qui.nom}` : ""}</li>;
          })}
        </ul>
        <div className="actions"><button type="button" className="lien" onClick={() => setOuvert(true)}>Modifier</button></div>
      </div>
    );
  }

  return (
    <div className="carte">
      <p className="message"><b>Quand pouvez-vous rencontrer un repreneur ?</b> Donnez jusqu'à trois dates. Elles ne sont montrées qu'aux repreneurs à qui vous avez communiqué votre nom.</p>
      <div className="trois-champs">
        {saisie.map((v, i) => (
          <div key={i} className="champ">
            <label htmlFor={`creneau-${i}`}>Date {i + 1}</label>
            <input id={`creneau-${i}`} type="datetime-local" value={v} onChange={(e) => setSaisie((s) => s.map((x, j) => (j === i ? e.target.value.slice(0, 16) : x)))} />
          </div>
        ))}
      </div>
      {erreur && <p className="message alerte" role="alert">{erreur}</p>}
      <div className="actions">
        <button type="button" className="bouton petit" disabled={etat === "envoi" || (propres.length === 0 && creneaux.length === 0)} onClick={valider}>{etat === "envoi" ? "Enregistrement…" : propres.length ? `Enregistrer ${propres.length} date${propres.length > 1 ? "s" : ""}` : "Retirer mes dates"}</button>
        {creneaux.length > 0 && <button type="button" className="lien" onClick={() => setOuvert(false)}>Annuler</button>}
      </div>
    </div>
  );
}
