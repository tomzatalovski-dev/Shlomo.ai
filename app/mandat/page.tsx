"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Societe = { nom: string; formeJuridique: string | null; ville: string | null; siren: string };

const CLES = [
  { chiffre: "0 €", texte: "à payer aujourd'hui" },
  { chiffre: "5 %", texte: "du prix de vente, minimum 5 000 €, seulement si la vente se fait" },
  { chiffre: "24 mois", texte: "de protection après chaque présentation" },
  { chiffre: "Anonyme", texte: "ni votre nom ni votre ville ne sont cités" },
];

const ARTICLES = [
  { titre: "Objet", texte: "Vous confiez à Shlomo la recherche de repreneurs pour votre société." },
  { titre: "Rémunération", texte: "Rien à payer aujourd'hui. Commission de 5 % du prix de vente, minimum 5 000 €, seulement si la vente se fait avec un repreneur présenté par Shlomo." },
  { titre: "Durée de la protection", texte: "Cette commission reste due pendant 24 mois après chaque présentation, chacune étant datée et enregistrée." },
  { titre: "Confidentialité", texte: "Les repreneurs sont approchés sans que votre nom ni votre ville soient cités. Vous pouvez rayer qui vous voulez avant tout contact." },
];

const dateLongue = () => new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function Mandat() {
  const parametres = useSearchParams();
  const siren = parametres.get("siren") ?? "";
  const metiers = parametres.get("m") ?? "";
  const site = parametres.get("site") ?? "";
  const [societe, setSociete] = useState<Societe | null>(null);
  const [raison, setRaison] = useState("");
  const [nom, setNom] = useState("");
  const [accord, setAccord] = useState(false);
  const [autorisation, setAutorisation] = useState(true);
  const [etat, setEtat] = useState<"saisie" | "envoi" | "signe">("saisie");
  const [erreur, setErreur] = useState<string | null>(null);
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(dateLongue());
    if (!/^\d{9}$/.test(siren)) return;
    // Mesure du parcours : la page du mandat a été ouverte pour ce dossier.
    fetch("/api/mesure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siren }), keepalive: true }).catch(() => {});
    fetch(`/api/societe?siren=${siren}`).then((r) => (r.ok ? r.json() : null)).then((s: Societe | null) => setSociete(s)).catch(() => {});
  }, [siren]);

  const signataire = nom.trim();
  const pret = accord && signataire.length > 2 && etat === "saisie";

  async function signer() {
    setEtat("envoi");
    setErreur(null);
    const rep = await fetch("/api/mandat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siren, signataire, autorisation, metiers, site, raison }),
    }).catch(() => null);
    const json = rep ? ((await rep.json().catch(() => null)) as { jeton?: string; erreur?: string } | null) : null;
    if (rep?.ok && json?.jeton) {
      // La signature est enregistrée : on le montre un instant avant de passer la main aux agents.
      setEtat("signe");
      setTimeout(() => window.location.assign(`/${autorisation ? "atelier" : "suivi"}?d=${json.jeton}`), 1400);
    } else {
      setErreur(json?.erreur ?? "La signature n'a pas pu être enregistrée. Réessayez.");
      setEtat("saisie");
    }
  }

  const retour = `/repreneurs?siren=${encodeURIComponent(siren)}${metiers ? `&m=${encodeURIComponent(metiers)}` : ""}${site ? `&site=${encodeURIComponent(site)}` : ""}`;

  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <ol className="etapes" aria-label="Étapes">
          <li className="fait">1</li><li className="fait">2</li><li className="fait">3</li>
          <li className="ici">4 · Mandat</li>
          <li>5</li><li>6</li>
        </ol>
      </header>

      <div className="corps seul contrat-page">
        <main className="resultat">
          <div>
            <h1>Votre mandat.</h1>
            <p className="sous">Une page, quatre articles. Vous signez en bas ; les agents se mettent au travail dans la seconde.</p>
          </div>

          <ul className="cles">
            {CLES.map((c) => (
              <li key={c.chiffre}><b>{c.chiffre}</b><span>{c.texte}</span></li>
            ))}
          </ul>

          <article className="contrat">
            <header className="contrat-tete">
              <div>
                <p className="surtitre">Mandat de recherche de repreneurs</p>
                <p className="date">{date ? `Établi le ${date}` : " "}</p>
              </div>
              <span className="essai">Version d'essai, sans valeur juridique</span>
            </header>

            <div className="parties">
              <div>
                <span>Le mandant</span>
                <b>{societe?.nom ?? "Votre société"}</b>
                <small>{[societe?.formeJuridique, societe?.ville, `SIREN ${siren}`].filter(Boolean).join(" · ")}</small>
              </div>
              <div>
                <span>Le mandataire</span>
                <b>Shlomo.ai</b>
                <small>Recherche et approche de repreneurs</small>
              </div>
            </div>

            <ol className="articles">
              {ARTICLES.map((a, i) => (
                <li key={a.titre}>
                  <span className="numero">Article {i + 1}</span>
                  <div><b>{a.titre}</b><p>{a.texte}</p></div>
                </li>
              ))}
            </ol>

            <div className="options">
              <label className="case">
                <input type="checkbox" checked={autorisation} onChange={(e) => setAutorisation(e.target.checked)} />
                <span><b>Approche déléguée.</b> J'autorise Shlomo à approcher les repreneurs pour mon compte, sans me nommer. Je n'aurai rien à valider ensuite.</span>
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
            </div>

            <section className="signature" aria-label="Signature">
              <div className="champ">
                <label htmlFor="signataire">Votre nom et prénom</label>
                <input id="signataire" type="text" autoComplete="name" placeholder="Nom et prénom" value={nom} onChange={(e) => setNom(e.target.value)} disabled={etat !== "saisie"} />
              </div>

              <div className={signataire ? "paraphe rempli" : "paraphe"} aria-hidden="true">
                <span className="trace-signature">{signataire || "Votre signature"}</span>
                <small>{signataire ? `Signé électroniquement par ${signataire}${date ? `, le ${date}` : ""}` : "Elle apparaît ici dès que vous tapez votre nom"}</small>
              </div>

              <label className="case">
                <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} disabled={etat !== "saisie"} />
                <span>J'ai lu le mandat et je l'accepte.</span>
              </label>

              {erreur && <p className="message alerte" role="alert">{erreur}</p>}

              <div className="actions">
                <button className="bouton large" type="button" disabled={!pret} onClick={signer}>
                  {etat === "envoi" ? "Enregistrement…" : "Signer le mandat"}
                </button>
                <a className="lien" href={retour}>Revenir à la liste</a>
              </div>
              <p className="source">La signature est enregistrée et datée. Le mandat définitif sera rédigé avec un avocat.</p>
            </section>
          </article>
        </main>
      </div>

      {etat === "signe" && (
        <div className="voile" role="status">
          <div className="scelle">
            <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l8 8 15-17" /></svg>
            <b>Mandat signé</b>
            <span>{autorisation ? "Vos agents se mettent au travail." : "Votre suivi s'ouvre."}</span>
          </div>
        </div>
      )}
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
