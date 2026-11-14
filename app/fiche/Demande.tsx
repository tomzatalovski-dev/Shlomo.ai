"use client";

import { useState } from "react";

/** Le repreneur laisse ses coordonnées. Elles vont à l'équipe Shlomo, jamais au cédant. */
export default function Demande({ jeton }: { jeton: string }) {
  const [nom, setNom] = useState("");
  const [societe, setSociete] = useState("");
  const [contact, setContact] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "recu" | "echec">("saisie");

  if (etat === "recu") {
    return (
      <div className="carte apparait">
        <p className="message"><b>Demande reçue.</b> L'équipe Shlomo vous recontacte pour convenir d'un échange. Rien n'est transmis au cédant sans votre accord.</p>
      </div>
    );
  }

  return (
    <form
      className="carte"
      onSubmit={async (e) => {
        e.preventDefault();
        setEtat("envoi");
        const rep = await fetch("/api/interet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, nom, societe, contact }) }).catch(() => null);
        setEtat(rep?.ok ? "recu" : "echec");
      }}
    >
      <p className="message"><b>En savoir plus.</b> Laissez vos coordonnées : un échange téléphonique de quinze minutes, sans engagement.</p>
      <div className="champ"><label htmlFor="nom">Votre nom</label><input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required minLength={3} maxLength={120} autoComplete="name" /></div>
      <div className="champ"><label htmlFor="societe">Votre société</label><input id="societe" value={societe} onChange={(e) => setSociete(e.target.value)} maxLength={160} autoComplete="organization" /></div>
      <div className="champ"><label htmlFor="contact">Courriel ou téléphone</label><input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} required minLength={5} maxLength={160} /></div>
      {etat === "echec" && <p className="message alerte">L'envoi n'a pas abouti. Réessayez dans un instant.</p>}
      <div className="actions"><button className="bouton" type="submit" disabled={etat === "envoi"}>{etat === "envoi" ? "Envoi…" : "Je souhaite en savoir plus"}</button></div>
    </form>
  );
}
