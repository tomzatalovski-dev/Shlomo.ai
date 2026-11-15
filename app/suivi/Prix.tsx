"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const euros = (n: number) => `${n.toLocaleString("fr-FR")} €`;
const lire = (v: string) => Number(v.replace(/[^\d]/g, ""));

/** Le vendeur fixe lui-même la fourchette que Shlomo pourra annoncer. Tant qu'elle manque, aucun montant n'est donné à un repreneur. */
export function Prix({ jeton, validee, repere }: { jeton: string; validee: { bas: number; haut: number } | null; repere: { bas: number; haut: number } | null }) {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(!validee);
  const [bas, setBas] = useState(String(validee?.bas ?? repere?.bas ?? ""));
  const [haut, setHaut] = useState(String(validee?.haut ?? repere?.haut ?? ""));
  const [etat, setEtat] = useState<"saisie" | "envoi">("saisie");
  const [erreur, setErreur] = useState("");
  const correct = lire(bas) >= 1000 && lire(haut) >= lire(bas);

  async function valider() {
    setEtat("envoi");
    setErreur("");
    const rep = await fetch("/api/suivi/prix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, bas: lire(bas), haut: lire(haut) }) }).catch(() => null);
    setEtat("saisie");
    if (rep?.ok) {
      setOuvert(false);
      routeur.refresh();
    } else setErreur(((await rep?.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? "L'enregistrement a échoué. Réessayez.");
  }

  if (validee && !ouvert) {
    return (
      <div className="carte">
        <p className="message"><b>Votre fourchette de prix : {euros(validee.bas)} à {euros(validee.haut)}.</b> Shlomo n'annonce aux repreneurs que ces deux montants, jamais un autre chiffre.</p>
        <div className="actions"><button type="button" className="lien" onClick={() => setOuvert(true)}>Modifier</button></div>
      </div>
    );
  }

  return (
    <div className="carte">
      <p className="message"><b>Une seule chose à faire : fixer votre fourchette de prix.</b> Tant qu'elle manque, Shlomo ne donne aucun montant aux repreneurs.</p>
      {repere && <p className="source">Repère tiré de vos comptes publiés : {euros(repere.bas)} à {euros(repere.haut)} (résultat net moyen multiplié par 4 à 8). Ce n'est pas une évaluation ; vous restez libre du montant.</p>}
      <div className="deux-champs">
        <div className="champ"><label htmlFor="prix-bas">Prix bas annoncé, en euros</label><input id="prix-bas" inputMode="numeric" value={bas} onChange={(e) => setBas(e.target.value)} placeholder="400000" /></div>
        <div className="champ"><label htmlFor="prix-haut">Prix haut annoncé, en euros</label><input id="prix-haut" inputMode="numeric" value={haut} onChange={(e) => setHaut(e.target.value)} placeholder="600000" /></div>
      </div>
      <p className="source">Les deux montants seront communiqués aux repreneurs qui demandent le prix. N'indiquez pas ici le minimum que vous accepteriez en secret.</p>
      {erreur && <p className="message alerte" role="alert">{erreur}</p>}
      <div className="actions">
        <button type="button" className="bouton petit" disabled={!correct || etat === "envoi"} onClick={valider}>{etat === "envoi" ? "Enregistrement…" : correct ? `Valider ${euros(lire(bas))} à ${euros(lire(haut))}` : "Valider ma fourchette"}</button>
        {validee && <button type="button" className="lien" onClick={() => setOuvert(false)}>Annuler</button>}
      </div>
    </div>
  );
}
