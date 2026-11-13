"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function Mandat() {
  const siren = useSearchParams().get("siren") ?? "";
  const [nom, setNom] = useState("");
  const [accord, setAccord] = useState(false);
  const pret = accord && nom.trim().length > 2;

  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <ol className="etapes" aria-label="Étapes">
          <li className="fait">1</li><li>2</li><li>3</li>
          <li className="ici">4 · Mandat</li>
          <li>5</li><li>6</li>
        </ol>
      </header>

      <div className="corps">
        <main className="resultat" style={{ margin: "0 auto" }}>
          <div>
            <h1>Le mandat, en quatre points.</h1>
            <p className="sous">Version de test : cette signature n'a pas de valeur juridique et n'est pas enregistrée. Le mandat réel sera rédigé avec un avocat.</p>
          </div>

          <div className="carte">
            <ul className="faits termes">
              <li>Vous confiez à Shlomo la recherche de repreneurs pour votre société (SIREN {siren}).</li>
              <li>Rien à payer aujourd'hui. Commission de 5 % du prix de vente, minimum 5 000 €, seulement si la vente se fait avec un repreneur présenté par Shlomo.</li>
              <li>Cette commission reste due pendant 24 mois après chaque présentation, chacune étant datée et enregistrée.</li>
              <li>Aucun message ne part sans votre accord, et vous pouvez exclure qui vous voulez.</li>
            </ul>

            <div className="champ">
              <label htmlFor="signataire">Votre nom et prénom</label>
              <div className="rappel">
                <input id="signataire" type="text" autoComplete="name" placeholder="Nom et prénom" value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
            </div>

            <label className="case">
              <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
              <span>J'ai lu le mandat et je l'accepte.</span>
            </label>

            <div className="actions">
              <button
                className="bouton"
                type="button"
                disabled={!pret}
                onClick={() => window.location.assign(`/repreneurs?siren=${encodeURIComponent(siren)}&signe=1&par=${encodeURIComponent(nom.trim())}`)}
              >
                Je signe
              </button>
              <a className="lien" href={`/repreneurs?siren=${encodeURIComponent(siren)}`}>Revenir à la liste</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Mandat />
    </Suspense>
  );
}
