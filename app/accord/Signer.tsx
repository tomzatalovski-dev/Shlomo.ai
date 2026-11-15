"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Signature de l'accord de confidentialité par le repreneur. */
export default function Signer({ jeton, decideur }: { jeton: string; decideur: string }) {
  const routeur = useRouter();
  const [nom, setNom] = useState(decideur);
  const [qualite, setQualite] = useState("");
  const [accepte, setAccepte] = useState(false);
  const [etat, setEtat] = useState<"saisie" | "envoi">("saisie");
  const [erreur, setErreur] = useState("");
  const signataire = nom.trim();
  const pret = signataire.length >= 3 && accepte && etat === "saisie";

  async function signer() {
    setEtat("envoi");
    setErreur("");
    const rep = await fetch("/api/accord", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, signataire, qualite, accepte }) }).catch(() => null);
    if (rep?.ok) routeur.refresh();
    else {
      setErreur(((await rep?.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? "La signature n'a pas pu être enregistrée. Réessayez.");
      setEtat("saisie");
    }
  }

  return (
    <section className="signature" aria-label="Signature">
      <div className="deux-champs">
        <div className="champ"><label htmlFor="signataire">Votre nom et prénom</label><input id="signataire" autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} disabled={etat !== "saisie"} /></div>
        <div className="champ"><label htmlFor="qualite">Votre fonction</label><input id="qualite" autoComplete="organization-title" value={qualite} onChange={(e) => setQualite(e.target.value)} maxLength={120} placeholder="Président, gérant…" disabled={etat !== "saisie"} /></div>
      </div>
      <div className={signataire ? "paraphe rempli" : "paraphe"} aria-hidden="true">
        <span className="trace-signature">{signataire || "Votre signature"}</span>
        <small>{signataire ? `Signé électroniquement par ${signataire}` : "Elle apparaît ici dès que vous tapez votre nom"}</small>
      </div>
      <label className="case">
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} disabled={etat !== "saisie"} />
        <span>J'ai lu l'accord et je l'accepte au nom de ma société.</span>
      </label>
      {erreur && <p className="message alerte" role="alert">{erreur}</p>}
      <div className="actions"><button className="bouton large" type="button" disabled={!pret} onClick={signer}>{etat === "envoi" ? "Enregistrement…" : "Signer l'accord"}</button></div>
      <p className="source">La signature est enregistrée et datée. Le nom de la société vous est communiqué ici même, dès que le cédant a donné son feu vert.</p>
    </section>
  );
}
