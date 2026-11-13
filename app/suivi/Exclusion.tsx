"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Bouton « Ne pas contacter » : la seule action possible du vendeur, et elle est facultative. */
export function Exclusion({ jeton, siren, exclu }: { jeton: string; siren: string; exclu: boolean }) {
  const routeur = useRouter();
  const [attente, setAttente] = useState(false);
  const [rate, setRate] = useState(false);

  return (
    <button
      className="lien"
      type="button"
      disabled={attente}
      onClick={async () => {
        setAttente(true);
        setRate(false);
        const rep = await fetch("/api/suivi/exclure", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jeton, siren, exclu: !exclu }),
        }).catch(() => null);
        setAttente(false);
        if (rep?.ok) routeur.refresh();
        else setRate(true);
      }}
    >
      {rate ? "Échec, réessayer" : exclu ? "Rétablir" : "Ne pas contacter"}
    </button>
  );
}
