"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Feu vert du vendeur : son nom n'est communiqué à un repreneur que s'il le décide ici. */
export function Revelation({ jeton, siren, nom, refusee }: { jeton: string; siren: string; nom: string; refusee: boolean }) {
  const routeur = useRouter();
  const [attente, setAttente] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [rate, setRate] = useState(false);

  async function decider(autorise: boolean) {
    setAttente(true);
    setRate(false);
    const rep = await fetch("/api/suivi/revelation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, siren, autorise }) }).catch(() => null);
    setAttente(false);
    setConfirmer(false);
    if (rep?.ok) routeur.refresh();
    else setRate(true);
  }

  if (confirmer) {
    return (
      <span className="decision">
        <small>Votre nom sera communiqué à {nom}. Cette décision est définitive.</small>
        <button type="button" className="lien" disabled={attente} onClick={() => decider(true)}>{attente ? "Enregistrement…" : "Je confirme"}</button>
        <button type="button" className="lien discret" disabled={attente} onClick={() => setConfirmer(false)}>Annuler</button>
      </span>
    );
  }

  return (
    <span className="decision">
      <button type="button" className="lien" disabled={attente} onClick={() => setConfirmer(true)}>Lui communiquer mon nom</button>
      {!refusee && <button type="button" className="lien discret" disabled={attente} onClick={() => decider(false)}>Refuser</button>}
      {rate && <small>Échec, réessayez.</small>}
    </span>
  );
}
