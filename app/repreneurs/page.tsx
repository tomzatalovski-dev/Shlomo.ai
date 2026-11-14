"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CandidatMasque, EvenementRepreneurs, RepreneurMasque, RepreneurRevele } from "@/lib/types";
import { Avance, Compteur, attendre, useFile } from "@/app/composants/scene";

type Ligne = { texte: string; etat: "ok" | "alerte" };
type Recent = CandidatMasque & { cle: number; libelle: string };

const nombre = (n: number) => (n >= 10_000 ? "10 000 +" : n.toLocaleString("fr-FR"));

function Repreneurs() {
  const parametres = useSearchParams();
  const siren = parametres.get("siren") ?? "";
  const metiers = parametres.get("m") ?? "";
  const suite = metiers ? `&m=${encodeURIComponent(metiers)}` : "";
  const signe = parametres.get("signe") === "1";
  const par = parametres.get("par") ?? "";
  // Après la signature, la recherche a déjà été montrée : on la rejoue vite.
  const rythme = signe ? 0.15 : 1;

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [encours, setEncours] = useState<string | null>("Préparation de la recherche");
  const [avance, setAvance] = useState({ pct: 4, texte: "Préparation de la recherche" });
  const [vendeur, setVendeur] = useState<{ nom: string; siren: string } | null>(null);
  const [metier, setMetier] = useState<number | null>(null);
  const [compte, setCompte] = useState({ vues: 0, non: 0, oui: 0 });
  const [examen, setExamen] = useState("");
  const [recents, setRecents] = useState<Recent[]>([]);
  const [liste, setListe] = useState<RepreneurMasque[] | null>(null);
  const [reveles, setReveles] = useState<RepreneurRevele[] | null>(null);
  const [examinees, setExaminees] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  // Chaque événement réel du serveur est joué à son tour, à un rythme lisible.
  const jouer = useFile<EvenementRepreneurs>(async (e) => {
    if (e.type === "encours") {
      setEncours(e.texte);
      setAvance((a) => ({ pct: Math.min(a.pct + 12, 85), texte: e.texte }));
      await attendre(800 * rythme);
    } else if (e.type === "journal") {
      setLignes((l) => [...l, { texte: e.texte, etat: e.etat }]);
      await attendre(450 * rythme);
    } else if (e.type === "vendeur") {
      setVendeur(e);
    } else if (e.type === "metier") {
      setMetier(e.total);
      await attendre(1300 * rythme);
    } else if (e.type === "passage") {
      if (e.echec || e.candidats.length === 0) return;
      setAvance((a) => ({ pct: Math.min(a.pct + 14, 88), texte: `J'examine les sociétés : ${e.libelle.toLowerCase()}` }));
      const pas = Math.max(180, Math.min(850, 9000 / e.candidats.length)) * rythme;
      for (const c of e.candidats) {
        setExamen(`J'examine une société de ${c.effectif ?? "taille non publiée"}${c.anneeCreation ? `, créée en ${c.anneeCreation}` : ""}…`);
        await attendre(pas);
        setCompte((n) => ({ vues: n.vues + 1, non: n.non + (c.retenu ? 0 : 1), oui: n.oui + (c.retenu ? 1 : 0) }));
        setRecents((r) => [...r, { ...c, cle: Math.random(), libelle: e.libelle }].slice(-6));
      }
      setExamen("");
    } else if (e.type === "repreneurs" || e.type === "reveles") {
      setEncours("Classement des repreneurs");
      setAvance({ pct: 94, texte: "Classement des repreneurs" });
      await attendre(1500 * rythme);
      setExaminees(e.examinees);
      if (e.type === "reveles") {
        setReveles(e.liste);
        setListe([]);
      } else setListe(e.liste);
    } else if (e.type === "erreur") {
      setErreur(e.message);
      setEncours(null);
    } else if (e.type === "fin") {
      setAvance({ pct: 100, texte: "Recherche terminée" });
      setEncours(null);
    }
  });

  useEffect(() => {
    const flux = new EventSource(`/api/repreneurs?siren=${encodeURIComponent(siren)}${suite}${signe ? "&mandat=test" : ""}`);
    let termine = false;
    flux.onmessage = (m) => {
      const e = JSON.parse(m.data) as EvenementRepreneurs;
      if (e.type === "fin" || e.type === "erreur") {
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
  }, [siren, suite, signe, jouer]);

  const premiers = liste?.slice(0, 3) ?? [];
  const suivants = liste?.slice(3) ?? [];
  const n = liste?.length ?? 0;
  const aDesNoms = Boolean(reveles && reveles.length > 0);
  const cherche = liste === null && !erreur;

  const titre = erreur
    ? "La recherche s'est arrêtée."
    : aDesNoms
      ? "Mandat signé. Voici vos repreneurs."
      : liste === null
        ? "Je cherche vos repreneurs."
        : n === 0
          ? "Le registre ne montre pas encore de repreneur évident."
          : n <= 3
            ? `${n} repreneur${n > 1 ? "s" : ""} retenu${n > 1 ? "s" : ""}.`
            : `${n} repreneurs retenus. Voici les trois meilleurs.`;

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
              <li key={i} className={l.etat === "alerte" ? "alerte apparait" : "apparait"}>{l.texte}</li>
            ))}
            {encours && <li className="encours">{encours}…</li>}
          </ul>
          <p className="promesse">Rien n'est envoyé sans votre accord.</p>
        </aside>

        <main className="resultat">
          <div>
            <h1>{titre}</h1>
            {cherche && <p className="sous">Je pars de toutes les sociétés de votre métier, et je ne garde que celles qui ont une raison de vous racheter.</p>}
            {aDesNoms && (
              <p className="sous">Mandat de test signé par {par || "vous"}, sans valeur juridique. Les noms ne sont visibles que de vous, parmi {examinees} sociétés examinées.</p>
            )}
            {liste !== null && n > 0 && (
              <p className="sous">
                {metiers ? "Des sociétés de votre activité et d'activités voisines, plus grandes que vous, notées sur leur taille, leurs comptes publiés et leur proximité." : "Des sociétés de votre code d'activité, plus grandes que vous. Ce code ne décrit pas toujours votre vrai métier : donnez l'adresse de votre site à l'étape 1 pour que je cherche aussi parmi les activités voisines."} Les noms s'affichent après la signature du mandat.
              </p>
            )}
            {liste !== null && n === 0 && !erreur && !aDesNoms && (
              <p className="sous">
                {metiers ? "Aucune société plus grande que vous n'apparaît dans ces activités." : "Aucune société plus grande que vous n'apparaît sous votre code d'activité. Donnez l'adresse de votre site à l'étape 1 : je chercherai aussi parmi les activités voisines."}
              </p>
            )}
          </div>

          {!erreur && <Avance pct={avance.pct} texte={avance.texte} />}

          {erreur && (
            <div className="carte">
              <p className="message">{erreur}</p>
              <div className="actions"><a className="lien" href="/">Revenir à l'accueil</a></div>
            </div>
          )}

          {!erreur && (
            <div className="entonnoir">
              <div className="chiffre"><span>{metiers ? "Sociétés de ces activités en France" : "Sociétés de votre métier en France"}</span><b>{metier === null ? "…" : <Compteur valeur={metier} duree={1100} format={nombre} />}</b></div>
              <div className="chiffre"><span>Examinées de près</span><b>{compte.vues}</b></div>
              <div className="chiffre"><span>Écartées</span><b>{compte.non}</b></div>
              <div className="chiffre cle"><span>Retenues</span><b>{compte.oui}</b></div>
            </div>
          )}

          {cherche && <p className="examen" aria-live="off">{examen || " "}</p>}

          {cherche && recents.length > 0 && (
            <div className="carte liste">
              {recents.map((c) => (
                <div key={c.cle} className={c.retenu ? "ligne apparait" : "ligne ecartee apparait"}>
                  <span className="quoi">
                    <b>{c.retenu ? c.raison : "Écartée"}</b>
                    <small>{c.retenu ? (c.details ?? []).join(" · ") : c.motif}</small>
                  </span>
                  <span className="ou">{[c.libelle, c.effectif].filter(Boolean).join(" · ")}</span>
                  <span className="note">{c.retenu ? c.score : "—"}</span>
                  {c.retenu && <span className="jauge"><i style={{ width: `${c.score}%` }} /></span>}
                </div>
              ))}
            </div>
          )}

          {aDesNoms && (
            <>
              <div className="carte liste apparait">
                {reveles!.map((r) => (
                  <div key={r.siren} className="ligne">
                    <span className="quoi">
                      <b>{r.rang}. {r.nom}</b>
                      <small>{[r.ville, r.effectif, ...r.raisons].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="ou">
                      {r.profil}
                      <br />
                      <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${r.siren}`} target="_blank" rel="noreferrer">Voir sa fiche publique</a>
                    </span>
                    <span className="note">{r.score}</span>
                  </div>
                ))}
              </div>
              <div className="carte apparait">
                <p className="message">La suite arrive avec la prochaine version : trouver la bonne personne dans chaque société, puis préparer le message d'approche que vous validerez.</p>
              </div>
            </>
          )}

          {premiers.length > 0 && (
            <div className="trio">
              {premiers.map((r) => (
                <div key={r.rang} className={r.rang === 1 ? "carte repreneur premier apparait" : "carte repreneur apparait"} style={{ animationDelay: `${(r.rang - 1) * 0.25}s` }}>
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
            <div className="carte liste apparait">
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
            <div className="carte mandat apparait">
              <div>
                <div className="grand">Signez le mandat pour voir les noms et lancer l'approche.</div>
                <p className="sous">Gratuit jusqu'ici. Commission de 5 %, avec un minimum de 5 000 €, uniquement si la vente se fait avec un repreneur présenté par Shlomo.</p>
              </div>
              <a className="bouton" href={`/mandat?siren=${encodeURIComponent(siren)}${suite}`}>Signer le mandat</a>
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
