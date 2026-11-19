"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * La ligne « en direct » : les derniers faits réellement enregistrés pour ce dossier, un à la fois.
 * Rien n'est simulé : chaque ligne vient du journal de la base, avec son heure. La page se relit seule toutes les trente secondes.
 */
export default function Direct({ faits, suite }: { faits: { texte: string; quand: string }[]; suite: string }) {
  const router = useRouter();
  const [i, setI] = useState(0);

  useEffect(() => {
    const relire = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 30_000);
    return () => clearInterval(relire);
  }, [router]);

  useEffect(() => {
    if (faits.length < 2) return;
    const tourner = setInterval(() => setI((k) => (k + 1) % faits.length), 4_200);
    return () => clearInterval(tourner);
  }, [faits.length]);

  const fait = faits[i % Math.max(1, faits.length)];
  return (
    <div className="direct" aria-live="polite">
      {fait && (
        <p key={fait.texte + fait.quand} className="direct-fait">
          <i aria-hidden />
          <span>{fait.texte}</span>
          <small>{fait.quand}</small>
        </p>
      )}
      <p className="direct-suite"><b>Ensuite</b> {suite}</p>
    </div>
  );
}
