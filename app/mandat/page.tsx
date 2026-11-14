"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function Mandat() {
  const parametres = useSearchParams();
  const siren = parametres.get("siren") ?? "";
  const metiers = parametres.get("m") ?? "";
  const site = parametres.get("site") ?? "";
  const [raison, setRaison] = useState("");
  const [nom, setNom] = useState("");
  const [accord, setAccord] = useState(false);
  const [autorisation, setAutorisation] = useState(true);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Mesure du parcours : la page du mandat a été ouverte pour ce dossier.
  useEffect(() => {
    if (/^\d{9}$/.test(siren)) fetch("/api/mesure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siren }), keepalive: true }).catch(() => {});
  }, [siren]);
  const pret = accord && nom.trim().length > 2 && !attente;

  async function signer() {
    setAttente(true);
    setErreur(null);
    const rep = await fetch("/api/mandat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siren, signataire: nom.trim(), autorisation, metiers, site, raison }),
    }).catch(() => null);
    const json = rep ? ((await rep.json().catch(() => null)) as { jeton?: string; erreur?: string } | null) : null;
    if (rep?.ok && json?.jeton) window.location.assign(`/${autorisation ? "atelier" : "suivi"}?d=${json.jeton}`);
    else {
      setErreur(json?.erreur ?? "La signature n'a pas pu être enregistrée. Réessayez.");
      setAttente(false);
    }
  }

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
            <p className="sous">Version de test : cette signature est enregistrée et datée, mais n'a pas de valeur juridique. Le mandat réel sera rédigé avec un avocat.</p>
          </div>

          <div className="carte">
            <ul className="faits termes">
              <li>Vous confiez à Shlomo la recherche de repreneurs pour votre société (SIREN {siren}).</li>
              <li>Rien à payer aujourd'hui. Commission de 5 % du prix de vente, minimum 5 000 €, seulement si la vente se fait avec un repreneur présenté par Shlomo.</li>
              <li>Cette commission reste due pendant 24 mois après chaque présentation, chacune étant datée et enregistrée.</li>
              <li>Les repreneurs sont approchés sans que votre nom ni votre ville soient cités. Vous pouvez rayer qui vous voulez avant tout contact.</li>
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

            <label className="case">
              <input type="checkbox" checked={autorisation} onChange={(e) => setAutorisation(e.target.checked)} />
              <span>J'autorise Shlomo à approcher les repreneurs pour mon compte, sans me nommer. Je n'aurai rien à valider ensuite.</span>
            </label>

            <div className="champ">
              <label htmlFor="raison">Pourquoi vendez-vous ? Facultatif : les repreneurs répondent mieux quand ils le savent.</label>
              <select id="raison" value={raison} onChange={(e) => setRaison(e.target.value)}>
                <option value="">Je préfère ne pas le dire</option>
                <option value="retraite">Départ à la retraite</option>
                <option value="projet">Nouveau projet</option>
                <option value="recentrage">Recentrage sur d'autres activités</option>
              </select>
            </div>

            {erreur && <p className="message" role="alert">{erreur}</p>}

            <div className="actions">
              <button
                className="bouton"
                type="button"
                disabled={!pret}
                onClick={signer}
              >
                {attente ? "Enregistrement…" : "Je signe"}
              </button>
              <a className="lien" href={`/repreneurs?siren=${encodeURIComponent(siren)}${metiers ? `&m=${encodeURIComponent(metiers)}` : ""}${site ? `&site=${encodeURIComponent(site)}` : ""}`}>Revenir à la liste</a>
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
