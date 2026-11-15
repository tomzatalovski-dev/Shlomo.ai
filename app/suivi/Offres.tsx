"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Offre } from "@/lib/base";
import { euros } from "@/lib/creneaux";

const REPONSE = { acceptee: "Vous avez accepté cette offre", refusee: "Vous avez refusé cette offre", a_ameliorer: "Vous avez demandé une meilleure offre" } as const;
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** Les offres reçues, côte à côte. Le vendeur répond lui-même : personne n'accepte ni ne refuse un prix à sa place. */
export function Offres({ jeton, offres, fourchette }: { jeton: string; offres: { nom: string; offre: Offre }[]; fourchette: { bas: number; haut: number } | null }) {
  const routeur = useRouter();
  const [attente, setAttente] = useState(0);
  const [confirmer, setConfirmer] = useState(0);
  const [rate, setRate] = useState(false);

  async function repondre(offre: number, reponse: keyof typeof REPONSE) {
    setAttente(offre);
    setRate(false);
    const rep = await fetch("/api/suivi/offre", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, offre, reponse }) }).catch(() => null);
    setAttente(0);
    setConfirmer(0);
    if (rep?.ok) routeur.refresh();
    else setRate(true);
  }

  const enAttente = offres.filter((o) => !o.offre.reponse).length;

  return (
    <div className={enAttente ? "carte decider" : "carte"}>
      <p className="message">
        <b>{enAttente ? (enAttente > 1 ? `${enAttente} offres attendent votre réponse.` : "Une offre attend votre réponse.") : offres.length > 1 ? "Les offres reçues." : "L'offre reçue."}</b>
        {fourchette ? ` Votre fourchette : ${euros(fourchette.bas)} à ${euros(fourchette.haut)}.` : ""} Vous seul acceptez ou refusez un prix.
      </p>
      <div className="offres">
        {offres.map(({ nom, offre: o }) => (
          <div key={o.id} className={o.reponse ? "offre repondue" : "offre"}>
            <small>{nom}, le {jour(o.deposee_le)}</small>
            <b className="prix">{euros(o.prix)}</b>
            <dl>
              {o.financement && <div><dt>Financement</dt><dd>{o.financement}</dd></div>}
              {o.calendrier && <div><dt>Calendrier</dt><dd>{o.calendrier}</dd></div>}
              {o.conditions && <div><dt>Conditions</dt><dd>{o.conditions}</dd></div>}
            </dl>
            {o.reponse ? (
              <p className={o.reponse === "acceptee" ? "etat fort" : "etat"}>{REPONSE[o.reponse]}</p>
            ) : confirmer === o.id ? (
              <span className="decision">
                <small>Accepter engage la suite avec ce repreneur. L'équipe Shlomo organise alors la signature avec votre avocat.</small>
                <button type="button" className="lien" disabled={attente !== 0} onClick={() => repondre(o.id, "acceptee")}>{attente === o.id ? "Enregistrement…" : "Je confirme"}</button>
                <button type="button" className="lien discret" disabled={attente !== 0} onClick={() => setConfirmer(0)}>Annuler</button>
              </span>
            ) : (
              <span className="decision">
                <button type="button" className="lien" disabled={attente !== 0} onClick={() => setConfirmer(o.id)}>Accepter</button>
                <button type="button" className="lien" disabled={attente !== 0} onClick={() => repondre(o.id, "a_ameliorer")}>Demander mieux</button>
                <button type="button" className="lien discret" disabled={attente !== 0} onClick={() => repondre(o.id, "refusee")}>Refuser</button>
              </span>
            )}
          </div>
        ))}
      </div>
      {rate && <p className="message alerte" role="alert">La réponse n'a pas pu être enregistrée. Réessayez.</p>}
    </div>
  );
}
