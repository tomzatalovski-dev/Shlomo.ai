"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Evenement, ResumeIA, Societe } from "@/lib/types";

type Ligne = { texte: string; etat: "ok" | "alerte" };

function euros(n?: number): string {
  if (n === undefined) return "Non publié";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (a >= 1_000) return `${Math.round(n / 1_000).toLocaleString("fr-FR")} k€`;
  return `${n.toLocaleString("fr-FR")} €`;
}

function Dossier() {
  const q = useSearchParams().get("q") ?? "";

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [encours, setEncours] = useState<string | null>("Lecture de votre saisie");
  const [societe, setSociete] = useState<Societe | null>(null);
  const [site, setSite] = useState<{ domaine: string; titre?: string; description?: string } | null>(null);
  const [resume, setResume] = useState<ResumeIA | null>(null);
  const [description, setDescription] = useState("");
  const [besoinSiren, setBesoinSiren] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const [valide, setValide] = useState(false);

  useEffect(() => {
    const flux = new EventSource(`/api/analyse?q=${encodeURIComponent(q)}`);
    let termine = false;
    const clore = () => {
      termine = true;
      setEncours(null);
      flux.close();
    };

    flux.onmessage = (m) => {
      const e = JSON.parse(m.data) as Evenement;
      if (e.type === "encours") setEncours(e.texte);
      else if (e.type === "journal") setLignes((l) => [...l, { texte: e.texte, etat: e.etat }]);
      else if (e.type === "societe") setSociete(e.societe);
      else if (e.type === "site") {
        setSite(e);
        if (e.description) setDescription((d) => d || e.description!);
      } else if (e.type === "resume") {
        setResume(e.resume);
        setDescription(e.resume.description);
      } else if (e.type === "besoin_siren") {
        setBesoinSiren(e.message);
        clore();
      } else if (e.type === "erreur") {
        setErreur(e.message);
        clore();
      } else if (e.type === "fin") {
        setFini(true);
        clore();
      }
    };
    flux.onerror = () => {
      if (!termine) setErreur("La connexion s'est interrompue. Rechargez la page pour relancer la recherche.");
      clore();
    };
    return () => flux.close();
  }, [q]);

  const dernier = societe?.finances.at(-1);
  const titre = erreur
    ? "La recherche s'est arrêtée."
    : besoinSiren
      ? "Il me manque votre numéro SIREN."
      : valide
        ? "Fiche validée."
        : fini
          ? "Voici ce que j'ai compris de votre société."
          : "Je lis votre société.";

  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <ol className="etapes" aria-label="Étapes">
          <li className="ici">1 · Comprendre la société</li>
          <li>2</li><li>3</li><li>4</li><li>5</li><li>6</li>
        </ol>
      </header>

      <div className="corps">
        <aside className="journal">
          <div className="qui">
            <b>{societe?.nom ?? site?.titre ?? q}</b>
            <span>{societe ? `SIREN ${societe.siren}` : "Recherche en cours"}</span>
          </div>
          <h2>{encours ? "Shlomo travaille sur l'étape 1 sur 6" : "Étape 1 sur 6"}</h2>
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
            {fini && !valide && <p className="sous">Vérifiez d'un coup d'œil. La description est modifiable.</p>}
            {valide && <p className="sous">Les étapes 2 à 6 arrivent avec la prochaine version. Votre fiche n'est pas encore enregistrée sur nos serveurs.</p>}
          </div>

          {erreur && (
            <div className="carte">
              <p className="message">{erreur}</p>
              <div className="actions"><a className="lien" href="/">Revenir à l'accueil</a></div>
            </div>
          )}

          {besoinSiren && (
            <div className="carte">
              <p className="message">{besoinSiren}</p>
              <form className="rappel" action="/dossier" method="get">
                <label className="cache" htmlFor="siren">Numéro SIREN</label>
                <input id="siren" name="q" inputMode="numeric" placeholder="Numéro SIREN, 9 chiffres" required />
                <button className="bouton" type="submit">Continuer</button>
              </form>
            </div>
          )}

          {!societe && !erreur && !besoinSiren && (
            <div className="carte vide" aria-label="Fiche en cours de lecture">
              <span className="os" style={{ width: "35%", height: 18 }} />
              <span className="os" style={{ width: "90%" }} />
              <span className="os" style={{ width: "70%" }} />
            </div>
          )}

          {societe && (
            <div className="carte">
              <div className="tete">
                <div>
                  <div className="nom">{societe.nom}</div>
                  <div className="lieu">
                    {[societe.formeJuridique, societe.ville, societe.codeActivite && `Code d'activité ${societe.codeActivite}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="statut">{societe.active ? "Trouvée au registre" : "Société cessée selon le registre"}</span>
              </div>

              <div className="chiffres">
                <div className="chiffre"><span>Création</span><b>{societe.anneeCreation ?? "Non publié"}</b></div>
                <div className="chiffre"><span>Effectif{societe.anneeEffectif ? ` (${societe.anneeEffectif})` : ""}</span><b>{societe.effectif ?? "Non publié"}</b></div>
                <div className="chiffre"><span>Chiffre d'affaires{dernier ? ` ${dernier.annee}` : ""}</span><b>{euros(dernier?.chiffreAffaires)}</b></div>
                <div className="chiffre"><span>Résultat{dernier ? ` ${dernier.annee}` : ""}</span><b>{euros(dernier?.resultat)}</b></div>
              </div>

              <div className="champ">
                <label htmlFor="description">Votre activité, en quelques phrases</label>
                <textarea
                  id="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez votre activité : ce que vous vendez, à qui, et ce qui vous distingue."
                  disabled={valide}
                />
              </div>

              {resume && resume.pointsForts.length > 0 && (
                <div>
                  <p className="source" style={{ marginBottom: 10 }}>Ce qui intéressera un repreneur</p>
                  <ul className="points">{resume.pointsForts.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}

              {societe.dirigeants.length > 0 && (
                <p className="source">
                  Dirigeants au registre : {societe.dirigeants.slice(0, 4).map((d) => (d.qualite ? `${d.nom} (${d.qualite})` : d.nom)).join(", ")}
                </p>
              )}

              {fini && !valide && (
                <div className="actions">
                  <button className="bouton" type="button" onClick={() => setValide(true)} disabled={!description.trim()}>
                    Tout est juste, je valide
                  </button>
                  <a className="lien" href="/">Ce n'est pas ma société</a>
                </div>
              )}

              <p className="source">Source : {societe.source}. Les chiffres sont ceux que la société a publiés.</p>
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
      <Dossier />
    </Suspense>
  );
}
