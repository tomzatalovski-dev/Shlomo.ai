"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type Controle = { nom: string; ok: boolean; detail?: string };
type Resultat = { quoi: string; siren: string; nom?: string; classes?: number; controles: Controle[]; reussi: boolean; duree_s: number };

/** Banc d'essai de la fiche et des repreneurs : douze vraies sociétés, rejouées une à une. Réservé aux fondateurs. */
function Banc() {
  const code = useSearchParams().get("c") ?? "";
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [etat, setEtat] = useState<"repos" | "encours" | "fini" | "refus">("repos");
  const [total, setTotal] = useState(0);

  async function lancer() {
    setEtat("encours");
    setResultats([]);
    const tete = await fetch(`/api/essais?c=${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!tete.ok) return setEtat("refus");
    const n = ((await tete.json()) as { cas: number }).cas;
    setTotal(n);
    for (let i = 0; i < n; i++) {
      const r = await fetch(`/api/essais?c=${encodeURIComponent(code)}&i=${i}`, { cache: "no-store" }).then((x) => x.json() as Promise<Resultat>).catch(() => ({ quoi: `Cas ${i + 1}`, siren: "", controles: [{ nom: "Le serveur a répondu", ok: false }], reussi: false, duree_s: 0 }));
      setResultats((liste) => [...liste, r]);
    }
    setEtat("fini");
  }

  const reussis = resultats.filter((r) => r.reussi).length;
  return (
    <div className="page epure">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a><span className="repere">Banc d'essai</span></header>
      <main className="colonne">
        <div>
          <h1>{etat === "fini" ? `${reussis} cas réussis sur ${resultats.length}.` : "Fiche et repreneurs à l'épreuve."}</h1>
          <p className="sous">De vraies sociétés, et ce que Shlomo doit en faire : refuser ce qui ne se vend pas, ne retenir que des repreneurs plus grands, ne jamais vendre un défaut comme un argument. Aucune IA n'est appelée.</p>
        </div>
        {etat === "refus" && <p className="message">Cette page demande le code de pilotage.</p>}
        <div className="actions">
          <button className="bouton" disabled={etat === "encours"} onClick={lancer}>{etat === "encours" ? `Cas ${Math.min(resultats.length + 1, total || 1)} sur ${total || "…"}` : etat === "fini" ? "Relancer le banc" : "Lancer le banc"}</button>
        </div>
        {resultats.length > 0 && (
          <div className="flux">
            {resultats.map((r) => (
              <div key={r.siren + r.quoi} className="flux-ligne">
                <span className="quoi">
                  <b>{r.reussi ? "Réussi" : "À corriger"} · {r.quoi}</b>
                  <small>{[r.nom, r.siren, r.classes !== undefined ? `${r.classes} repreneurs classés` : null, `${r.duree_s} s`].filter(Boolean).join(" · ")}</small>
                  {r.controles.filter((c) => !c.ok).map((c) => <small key={c.nom} className="alerte">{c.nom}{c.detail ? ` : ${c.detail}` : ""}</small>)}
                </span>
                <span className="note">{r.controles.filter((c) => c.ok).length}/{r.controles.length}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return <Suspense><Banc /></Suspense>;
}
