"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EvenementRepreneurs, RepreneurMasque } from "@/lib/types";

type Ligne = { texte: string; etat: "ok" | "alerte" };

function Repreneurs() {
  const siren = useSearchParams().get("siren") ?? "";

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [encours, setEncours] = useState<string | null>("Préparation de la recherche");
  const [vendeur, setVendeur] = useState<{ nom: string; siren: string } | null>(null);
  const [liste, setListe] = useState<RepreneurMasque[] | null>(null);
  const [examinees, setExaminees] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const flux = new EventSource(`/api/repreneurs?siren=${encodeURIComponent(siren)}`);
    let termine = false;
    const clore = () => {
      termine = true;
      setEncours(null);
      flux.close();
    };

    flux.onmessage = (m) => {
      const e = JSON.parse(m.data) as EvenementRepreneurs;
      if (e.type === "encours") setEncours(e.texte);
      else if (e.type === "journal") setLignes((l) => [...l, { texte: e.texte, etat: e.etat }]);
      else if (e.type === "vendeur") setVendeur(e);
      else if (e.type === "repreneurs") {
        setListe(e.liste);
        setExaminees(e.examinees);
      } else if (e.type === "erreur") {
        setErreur(e.message);
        clore();
      } else if (e.type === "fin") clore();
    };
    flux.onerror = () => {
      if (!termine) setErreur("La connexion s'est interrompue. Rechargez la page pour relancer la recherche.");
      clore();
    };
    return () => flux.close();
  }, [siren]);

  const premiers = liste?.slice(0, 3) ?? [];
  const suivants = liste?.slice(3) ?? [];
  const n = liste?.length ?? 0;

  const titre = erreur
    ? "La recherche s'est arrêtée."
    : liste === null
      ? "Je cherche vos repreneurs."
      : n === 0
        ? "Le registre ne montre pas encore de repreneur évident."
        : n <= 3
          ? `${n} repreneur${n > 1 ? "s" : ""} possible${n > 1 ? "s" : ""}.`
          : `${n} repreneurs possibles. Voici les trois premiers.`;

  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <ol className="etapes" aria-label="Étapes">
          <li className="fait">1</li><li>2</li><li>3</li>
          <li className="ici">4 · Sociétés repreneuses</li>
          <li>5</li><li>6</li>
        </ol>
      </header>

      <div className="corps">
        <aside className="journal">
          <div className="qui">
            <b>{vendeur?.nom ?? "Votre société"}</b>
            <span>{vendeur ? `SIREN ${vendeur.siren}` : "Recherche en cours"}</span>
          </div>
          <h2>{encours ? "Shlomo cherche vos repreneurs" : "Premier passage terminé"}</h2>
          <ul className="lignes" aria-live="polite">
            {lignes.map((l, i) => (
              <li key={i} className={l.etat === "alerte" ? "alerte" : undefined}>{l.texte}</li>
            ))}
            {encours && <li className="encours">{encours}…</li>}
          </ul>
          <p className="promesse">Rien n'est envoyé sans votre accord.</p>
        </aside>

        <main className="resultat">
          <div>
            <h1>{titre}</h1>
            {liste !== null && n > 0 && (
              <p className="sous">
                Premier passage sur le registre : des sociétés de votre métier, plus grandes que vous, parmi {examinees} examinées. Le code d'activité du registre ne décrit pas toujours votre vrai métier : ce classement sera affiné par l'étude de votre marché. Les noms s'affichent après la signature du mandat.
              </p>
            )}
            {liste !== null && n === 0 && !erreur && (
              <p className="sous">
                Aucune société plus grande que vous n'apparaît sous votre code d'activité. L'étude de votre marché, à venir, cherchera aussi parmi les métiers voisins, les fournisseurs et les repreneurs individuels.
              </p>
            )}
          </div>

          {erreur && (
            <div className="carte">
              <p className="message">{erreur}</p>
              <div className="actions"><a className="lien" href="/">Revenir à l'accueil</a></div>
            </div>
          )}

          {liste === null && !erreur && (
            <div className="trio">
              {[0, 1, 2].map((i) => (
                <div key={i} className="carte vide" aria-label="Recherche en cours">
                  <span className="os" style={{ width: "45%" }} />
                  <span className="os" style={{ width: "90%", height: 16 }} />
                  <span className="os" style={{ width: "60%" }} />
                </div>
              ))}
            </div>
          )}

          {premiers.length > 0 && (
            <div className="trio">
              {premiers.map((r) => (
                <div key={r.rang} className={r.rang === 1 ? "carte repreneur premier" : "carte repreneur"}>
                  <div className="rang"><span className="num">{r.rang}</span><span>{r.profil}</span></div>
                  <p className="pourquoi">{r.raison}.</p>
                  {r.details.length > 0 && <ul className="faits">{r.details.map((d) => <li key={d}>{d}</li>)}</ul>}
                  <div className="bas">
                    <div>
                      <span className="masque">Nom masqué</span>
                      <p className="meta">{[r.zone, r.effectif].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="score"><b>{r.score}</b><span>sur 100</span></div>
                  </div>
                  <span className="jauge" role="img" aria-label={`Score ${r.score} sur 100`}><i style={{ width: `${r.score}%` }} /></span>
                </div>
              ))}
            </div>
          )}

          {suivants.length > 0 && (
            <div className="carte liste">
              {suivants.map((r) => (
                <div key={r.rang} className="ligne">
                  <span className="quoi"><b>{r.raison}</b>{r.details.length > 0 && <small>{r.details.join(" · ")}</small>}</span>
                  <span className="ou">{[r.profil, r.effectif].filter(Boolean).join(" · ")}</span>
                  <span className="note">{r.score}</span>
                </div>
              ))}
            </div>
          )}

          {n > 0 && (
            <div className="carte mandat">
              <div>
                <div className="grand">Signez le mandat pour voir les noms et lancer l'approche.</div>
                <p className="sous">La signature en ligne arrive avec la prochaine version. Le score est calculé à partir des seules données du registre : il sera affiné par l'étude de votre marché.</p>
              </div>
              <button className="bouton" type="button" disabled>Signer le mandat</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Repreneurs />
    </Suspense>
  );
}
