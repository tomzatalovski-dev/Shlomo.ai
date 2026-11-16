"use client";

import { useState } from "react";

/** Un vendeur qui a perdu son lien de suivi le reçoit de nouveau à l'adresse donnée à la signature. */
export default function Page() {
  const [courriel, setCourriel] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "fait">("saisie");
  const [erreur, setErreur] = useState("");

  return (
    <div className="page">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul contrat-page">
        <main className="resultat">
          <div>
            <h1>Retrouver votre dossier.</h1>
            <p className="sous">Indiquez l'adresse donnée à la signature du mandat. Nous y renvoyons votre lien de suivi.</p>
          </div>
          <form
            className="carte"
            onSubmit={async (e) => {
              e.preventDefault();
              setEtat("envoi");
              setErreur("");
              const rep = await fetch("/api/retrouver", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courriel }) }).catch(() => null);
              if (rep?.ok) setEtat("fait");
              else {
                setErreur(((await rep?.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? "La demande n'a pas abouti. Réessayez.");
                setEtat("saisie");
              }
            }}
          >
            {etat === "fait" ? (
              <p className="message"><b>C'est envoyé.</b> Si un dossier est rattaché à cette adresse, vous recevez son lien dans quelques instants. Pensez à regarder vos courriers indésirables.</p>
            ) : (
              <>
                <div className="champ"><label htmlFor="courriel">Votre adresse électronique</label><input id="courriel" type="email" autoComplete="email" required value={courriel} onChange={(e) => setCourriel(e.target.value)} /></div>
                {erreur && <p className="message alerte" role="alert">{erreur}</p>}
                <div className="actions"><button className="bouton" type="submit" disabled={etat === "envoi"}>{etat === "envoi" ? "Envoi…" : "Recevoir mon lien"}</button></div>
              </>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}
