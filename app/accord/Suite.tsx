"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { direCreneau } from "@/lib/creneaux";

async function envoyer(corps: Record<string, unknown>): Promise<string | null> {
  const rep = await fetch("/api/accord", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
  if (rep?.ok) return null;
  return ((await rep?.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? "L'enregistrement a échoué. Réessayez.";
}

/** Le repreneur choisit l'une des dates données par le cédant. */
export function Creneau({ jeton, creneaux }: { jeton: string; creneaux: string[] }) {
  const routeur = useRouter();
  const [attente, setAttente] = useState("");
  const [erreur, setErreur] = useState("");
  return (
    <>
      <div className="choix-creneaux">
        {creneaux.map((c) => (
          <button key={c} type="button" className="creneau" disabled={attente !== ""} onClick={async () => {
            setAttente(c);
            const e = await envoyer({ jeton, action: "creneau", creneau: c });
            setAttente("");
            setErreur(e ?? "");
            routeur.refresh();
          }}>{attente === c ? "Enregistrement…" : direCreneau(c)}</button>
        ))}
      </div>
      {erreur && <p className="message alerte" role="alert">{erreur}</p>}
    </>
  );
}

/** Le repreneur dépose une offre chiffrée. Le cédant y répond lui-même. */
export function DeposerOffre({ jeton, deja }: { jeton: string; deja: boolean }) {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(!deja);
  const [prix, setPrix] = useState("");
  const [financement, setFinancement] = useState("");
  const [calendrier, setCalendrier] = useState("");
  const [conditions, setConditions] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi">("saisie");
  const [erreur, setErreur] = useState("");
  const montant = Number(prix.replace(/[^\d]/g, ""));

  if (!ouvert) return <div className="actions"><button type="button" className="lien" onClick={() => setOuvert(true)}>Déposer une nouvelle offre</button></div>;

  return (
    <form
      className="formulaire-offre"
      onSubmit={async (e) => {
        e.preventDefault();
        setEtat("envoi");
        const refus = await envoyer({ jeton, action: "offre", prix: montant, financement, calendrier, conditions });
        setEtat("saisie");
        setErreur(refus ?? "");
        if (!refus) {
          setOuvert(false);
          setPrix("");
          routeur.refresh();
        }
      }}
    >
      <div className="champ"><label htmlFor="prix">Prix proposé, en euros</label><input id="prix" inputMode="numeric" required value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="450000" /></div>
      <div className="champ"><label htmlFor="financement">Financement</label><input id="financement" value={financement} onChange={(e) => setFinancement(e.target.value)} maxLength={600} placeholder="Fonds propres, prêt bancaire, crédit-vendeur…" /></div>
      <div className="champ"><label htmlFor="calendrier">Calendrier</label><input id="calendrier" value={calendrier} onChange={(e) => setCalendrier(e.target.value)} maxLength={600} placeholder="Signature visée, durée d'accompagnement souhaitée" /></div>
      <div className="champ"><label htmlFor="conditions">Conditions</label><textarea id="conditions" rows={3} value={conditions} onChange={(e) => setConditions(e.target.value)} maxLength={1200} placeholder="Ce dont dépend votre offre : audit, financement, maintien de l'équipe…" /></div>
      {erreur && <p className="message alerte" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="bouton" type="submit" disabled={etat === "envoi" || montant < 1000}>{etat === "envoi" ? "Envoi…" : montant >= 1000 ? `Déposer une offre de ${montant.toLocaleString("fr-FR")} €` : "Déposer mon offre"}</button>
        {deja && <button type="button" className="lien" onClick={() => setOuvert(false)}>Annuler</button>}
      </div>
      <p className="source">Cette offre n'engage pas définitivement : elle ouvre la discussion. Le cédant y répond lui-même.</p>
    </form>
  );
}
