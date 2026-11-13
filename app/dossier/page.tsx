"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Evenement, ResumeIA, Societe } from "@/lib/types";
import { Avance, Compteur, attendre, euros, useFile } from "@/app/composants/scene";

type Ligne = { texte: string; etat: "ok" | "alerte" };

function Dossier() {
  const q = useSearchParams().get("q") ?? "";

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [encours, setEncours] = useState<string | null>("Lecture de votre saisie");
  const [avance, setAvance] = useState({ pct: 4, texte: "Lecture de votre saisie" });
  const [societe, setSociete] = useState<Societe | null>(null);
  const [tuiles, setTuiles] = useState(0);
  const [evolution, setEvolution] = useState(false);
  const [site, setSite] = useState<{ domaine: string; titre?: string; description?: string } | null>(null);
  const [resume, setResume] = useState<ResumeIA | null>(null);
  const [points, setPoints] = useState(0);
  const [description, setDescription] = useState("");
  const [besoinSiren, setBesoinSiren] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const [valide, setValide] = useState(false);

  // Chaque événement réel du serveur est joué à son tour, à un rythme lisible.
  const jouer = useFile<Evenement>(async (e) => {
    if (e.type === "encours") {
      setEncours(e.texte);
      setAvance((a) => ({ pct: Math.min(a.pct + 22, 88), texte: e.texte }));
      await attendre(900);
    } else if (e.type === "journal") {
      setLignes((l) => [...l, { texte: e.texte, etat: e.etat }]);
      await attendre(550);
    } else if (e.type === "site") {
      setSite(e);
      if (e.description) setDescription((d) => d || e.description!);
      await attendre(500);
    } else if (e.type === "societe") {
      setSociete(e.societe);
      setAvance({ pct: 55, texte: "Lecture de la fiche et des comptes publiés" });
      for (let i = 1; i <= 4; i++) {
        await attendre(700);
        setTuiles(i);
      }
      if (e.societe.finances.length >= 2) {
        await attendre(700);
        setEvolution(true);
        await attendre(900);
      }
    } else if (e.type === "resume") {
      setResume(e.resume);
      const texte = e.resume.description;
      for (let i = 0; i < texte.length; i += 2) {
        setDescription(texte.slice(0, i + 2));
        await attendre(16);
      }
      setDescription(texte);
      for (let i = 1; i <= e.resume.pointsForts.length; i++) {
        await attendre(550);
        setPoints(i);
      }
    } else if (e.type === "besoin_siren") {
      setBesoinSiren(e.message);
      setEncours(null);
    } else if (e.type === "erreur") {
      setErreur(e.message);
      setEncours(null);
    } else if (e.type === "fin") {
      await attendre(400);
      setAvance({ pct: 100, texte: "Étape 1 terminée" });
      setEncours(null);
      setFini(true);
    }
  });

  useEffect(() => {
    const flux = new EventSource(`/api/analyse?q=${encodeURIComponent(q)}`);
    let termine = false;
    flux.onmessage = (m) => {
      const e = JSON.parse(m.data) as Evenement;
      if (e.type === "fin" || e.type === "erreur" || e.type === "besoin_siren") {
        termine = true;
        flux.close();
      }
      jouer(e);
    };
    flux.onerror = () => {
      flux.close();
      if (!termine) jouer({ type: "erreur", message: "La connexion s'est interrompue. Rechargez la page pour relancer la recherche." });
    };
    return () => flux.close();
  }, [q, jouer]);

  const dernier = societe?.finances.at(-1);
  const avant = societe && societe.finances.length >= 2 ? societe.finances.at(-2) : undefined;
  const hausse = dernier?.chiffreAffaires && avant?.chiffreAffaires ? Math.round((dernier.chiffreAffaires / avant.chiffreAffaires - 1) * 100) : undefined;

  const titre = erreur
    ? "La recherche s'est arrêtée."
    : besoinSiren
      ? "Il me manque votre numéro SIREN."
      : valide
        ? "Fiche validée. Je cherche vos repreneurs."
        : fini
          ? "Voici ce que j'ai compris de votre société."
          : societe
            ? "J'ai trouvé votre société."
            : "Je lis votre société.";

  const tuile = (i: number, libelle: string, contenu: React.ReactNode) =>
    i <= tuiles ? (
      <div className="chiffre apparait"><span>{libelle}</span><b>{contenu}</b></div>
    ) : (
      <div className="chiffre attente" aria-hidden="true"><span>{libelle}</span><b /></div>
    );

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
              <li key={i} className={l.etat === "alerte" ? "alerte apparait" : "apparait"}>{l.texte}</li>
            ))}
            {encours && <li className="encours">{encours}…</li>}
          </ul>
          <p className="promesse">Rien n'est envoyé sans votre accord.</p>
        </aside>

        <main className="resultat">
          <div>
            <h1>{titre}</h1>
            <p className="sous">{fini && !valide ? "Vérifiez d'un coup d'œil. La description est modifiable." : !erreur && !besoinSiren && !valide ? "Chaque information s'affiche dès que je la trouve." : valide ? "J'ouvre la recherche de vos repreneurs." : ""}</p>
          </div>

          {!erreur && !besoinSiren && <Avance pct={avance.pct} texte={avance.texte} />}

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
            <div className="carte apparait">
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
                {tuile(1, "Création", societe.anneeCreation ? <Compteur valeur={societe.anneeCreation} duree={600} /> : "Non publié")}
                {tuile(2, `Effectif${societe.anneeEffectif ? ` (${societe.anneeEffectif})` : ""}`, societe.effectif ?? "Non publié")}
                {tuile(3, `Chiffre d'affaires${dernier ? ` ${dernier.annee}` : ""}`, dernier?.chiffreAffaires !== undefined ? <Compteur valeur={dernier.chiffreAffaires} format={euros} /> : "Non publié")}
                {tuile(4, `Résultat${dernier ? ` ${dernier.annee}` : ""}`, dernier?.resultat !== undefined ? <Compteur valeur={dernier.resultat} format={euros} /> : "Non publié")}
              </div>

              {evolution && dernier && avant && dernier.chiffreAffaires && avant.chiffreAffaires && (
                <div className="evolution apparait">
                  <div className="colonnes" aria-hidden="true">
                    <div><i style={{ height: Math.max(8, Math.round((avant.chiffreAffaires / Math.max(avant.chiffreAffaires, dernier.chiffreAffaires)) * 56)) }} /><span>{avant.annee}</span></div>
                    <div><i className="fort" style={{ height: Math.max(8, Math.round((dernier.chiffreAffaires / Math.max(avant.chiffreAffaires, dernier.chiffreAffaires)) * 56)) }} /><span>{dernier.annee}</span></div>
                  </div>
                  <p className="message">
                    Chiffre d'affaires {hausse !== undefined && hausse >= 0 ? `en hausse de ${hausse} %` : `en baisse de ${Math.abs(hausse ?? 0)} %`} entre {avant.annee} et {dernier.annee}
                    {avant.resultat !== undefined && dernier.resultat !== undefined ? `, résultat passé de ${euros(avant.resultat)} à ${euros(dernier.resultat)}` : ""}.
                  </p>
                </div>
              )}

              {tuiles >= 4 && (
                <div className="champ apparait">
                  <label htmlFor="description">Votre activité, en quelques phrases</label>
                  <textarea
                    id="description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Facultatif : ce que vous vendez, à qui, et ce qui vous distingue. Cela m'aidera à mieux cibler."
                    disabled={valide}
                  />
                </div>
              )}

              {resume && points > 0 && (
                <div>
                  <p className="source" style={{ marginBottom: 10 }}>Ce qui intéressera un repreneur</p>
                  <ul className="points">{resume.pointsForts.slice(0, points).map((p) => <li key={p} className="apparait">{p}</li>)}</ul>
                </div>
              )}

              {fini && societe.dirigeants.length > 0 && (
                <p className="source apparait">
                  Dirigeants au registre : {societe.dirigeants.slice(0, 4).map((d) => (d.qualite ? `${d.nom} (${d.qualite})` : d.nom)).join(", ")}
                </p>
              )}

              {fini && !valide && (
                <div className="actions apparait">
                  <button
                    className="bouton"
                    type="button"
                    onClick={() => {
                      setValide(true);
                      window.location.assign(`/repreneurs?siren=${societe.siren}`);
                    }}
                  >
                    Tout est juste, je valide
                  </button>
                  <a className="lien" href="/">Ce n'est pas ma société</a>
                </div>
              )}

              {fini && <p className="source">Source : {societe.source}. Les chiffres sont ceux que la société a publiés.</p>}
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
