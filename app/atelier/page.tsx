"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EvenementAtelier, LigneAtelier } from "@/lib/types";
import { Avance, Compteur, attendre, useFile } from "@/app/composants/scene";
import { ordonner, prioriteDe } from "@/lib/priorite";

type Colonne = "nom" | "decideur" | "message" | "etat";
type Poste = { siren: string; colonne: Colonne };
type Direct = { agent: number; pour: string; texte: string };
type Trace = { genre: "requete" | "page" | "fait" | "info"; texte: string; detail?: string; cle: number };
type Ecran = { cible?: string; etat: string; actif: boolean; traces: Trace[] };

const AGENTS = [1, 2, 3];

const ETAT: Record<LigneAtelier["etat"], string> = {
  a_faire: "En attente",
  pret: "Prête à partir",
  refus: "Laissé de côté",
  raye: "Rayé à votre demande",
  contacte: "Déjà contacté",
  echec: "À reprendre",
};

function Agent({ n }: { n: number }) {
  return <span className={`agent a${n}`}><i />Agent {n}</span>;
}

function Atelier() {
  const jeton = useSearchParams().get("d") ?? "";
  const [societe, setSociete] = useState("");
  const [lignes, setLignes] = useState<LigneAtelier[] | null>(null);
  const [postes, setPostes] = useState<Record<number, Poste | null>>({});
  const [journal, setJournal] = useState<{ agent: number; texte: string; cle: number }[]>([]);
  const [direct, setDirect] = useState<Direct | null>(null);
  const [ecrans, setEcrans] = useState<Record<number, Ecran>>({});
  const [pagesLues, setPagesLues] = useState(0);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const changer = (siren: string, avec: Partial<LigneAtelier>) => setLignes((l) => l?.map((x) => (x.siren === siren ? { ...x, ...avec } : x)) ?? l);
  const placer = (agent: number, poste: Poste | null) => setPostes((p) => ({ ...p, [agent]: poste }));
  const noter = (agent: number, texte: string) => setJournal((j) => [...j, { agent, texte, cle: Math.random() }].slice(-9));
  const regler = (agent: number, avec: Partial<Ecran>) => setEcrans((e) => ({ ...e, [agent]: { ...(e[agent] ?? { etat: "", actif: true, traces: [] }), ...avec } }));
  const tracer = (agent: number, trace: Omit<Trace, "cle">, cle = Math.random()) =>
    setEcrans((e) => {
      const ecran = e[agent] ?? { etat: "", actif: true, traces: [] };
      const sans = ecran.traces.filter((t) => t.cle !== cle);
      return { ...e, [agent]: { ...ecran, traces: [...sans, { ...trace, cle }].slice(-9) } };
    });
  const nomDe = (siren: string) => lignes?.find((l) => l.siren === siren)?.nom ?? "ce repreneur";

  // Chaque événement réel du serveur est joué à son tour, à un rythme lisible.
  const jouer = useFile<EvenementAtelier>(async (e) => {
    if (e.type === "plan") {
      setSociete(e.societe);
      setLignes(e.lignes);
      await attendre(900);
    } else if (e.type === "etape") {
      const colonne: Colonne = e.etape === "registre" ? "decideur" : e.etape === "veille" ? "nom" : e.etape === "redaction" ? "message" : "etat";
      placer(e.agent, { siren: e.siren, colonne });
      if (e.etape === "registre") {
        noter(e.agent, `ouvre la fiche de ${nomDe(e.siren)} au registre`);
        regler(e.agent, { cible: nomDe(e.siren), etat: "lit sa fiche au registre des entreprises", actif: true, traces: [] });
      }
      if (e.etape === "veille") {
        noter(e.agent, `cherche sur le web ce que ${nomDe(e.siren)} a annoncé`);
        regler(e.agent, { etat: "cherche sur le web ce qu'elle a annoncé" });
      }
      if (e.etape === "redaction") regler(e.agent, { etat: "rédige le message" });
      if (e.etape === "enregistrement") regler(e.agent, { etat: "range l'approche dans votre suivi" });
      await attendre(e.etape === "registre" || e.etape === "veille" ? 650 : 350);
    } else if (e.type === "signaux") {
      // On rejoue ce que la recherche a réellement fait : ses requêtes, les pages reçues, les faits retenus.
      for (const requete of e.requetes ?? []) {
        const cle = Math.random();
        for (let i = 0; i < requete.length; i += 3) {
          tracer(e.agent, { genre: "requete", texte: requete.slice(0, i + 3) }, cle);
          await attendre(18);
        }
        tracer(e.agent, { genre: "requete", texte: requete }, cle);
        await attendre(250);
      }
      const pages = e.pages ?? [];
      for (const page of pages.slice(0, 5)) {
        tracer(e.agent, { genre: "page", texte: page.domaine, detail: page.titre });
        setPagesLues((n) => n + 1);
        await attendre(170);
      }
      if (pages.length > 5) {
        tracer(e.agent, { genre: "info", texte: `et ${pages.length - 5} autres pages lues` });
        setPagesLues((n) => n + pages.length - 5);
        await attendre(200);
      }
      for (const signal of e.signaux) {
        tracer(e.agent, { genre: "fait", texte: signal.genre === "alerte" ? `À vérifier : ${signal.texte}` : signal.texte });
        await attendre(350);
      }
      if (!e.signaux.length) tracer(e.agent, { genre: "info", texte: "Rien de sûr à retenir : je n'invente pas." });
      changer(e.siren, { site: e.site, signaux: e.signaux });
      noter(e.agent, e.signaux.length ? `a trouvé ${e.signaux.length} fait${e.signaux.length > 1 ? "s" : ""} public${e.signaux.length > 1 ? "s" : ""} sur ${nomDe(e.siren)}` : `n'a rien trouvé de sûr sur ${nomDe(e.siren)}`);
      await attendre(500);
    } else if (e.type === "decideur") {
      changer(e.siren, { decideur: e.nom ?? "", qualite: e.qualite });
      tracer(e.agent, { genre: "info", texte: e.nom ? `Décideur : ${e.nom}${e.qualite ? `, ${e.qualite}` : ""}` : "Aucun dirigeant publié au registre" });
      noter(e.agent, e.nom ? `a trouvé qui décide chez ${nomDe(e.siren)} : ${e.nom}` : `ne trouve pas de dirigeant publié chez ${nomDe(e.siren)}`);
      await attendre(450);
    } else if (e.type === "refus") {
      changer(e.siren, { etat: "refus" });
      placer(e.agent, null);
      regler(e.agent, { etat: "la laisse de côté : elle refuse le démarchage", actif: false });
      noter(e.agent, `laisse ${nomDe(e.siren)} de côté : la société a demandé à ne pas être démarchée`);
      await attendre(600);
    } else if (e.type === "message") {
      const pour = nomDe(e.siren);
      noter(e.agent, `écrit à ${pour}`);
      for (let i = 0; i < e.texte.length; i += 7) {
        setDirect({ agent: e.agent, pour, texte: e.texte.slice(0, i + 7) });
        await attendre(14);
      }
      setDirect({ agent: e.agent, pour, texte: e.texte });
      changer(e.siren, { message: e.texte });
      await attendre(500);
    } else if (e.type === "pret" || e.type === "echec") {
      changer(e.siren, { etat: e.type });
      placer(e.agent, null);
      regler(e.agent, { etat: e.type === "pret" ? "approche prête" : "à reprendre", actif: false });
      if (e.type === "pret") noter(e.agent, `a rangé l'approche de ${nomDe(e.siren)}, prête à partir`);
      await attendre(300);
    } else if (e.type === "erreur") {
      setErreur(e.message);
    } else if (e.type === "fin") {
      setPostes({});
      setEcrans((tous) => Object.fromEntries(Object.entries(tous).map(([n, ecran]) => [n, { ...ecran, actif: false, etat: "a terminé" }])));
      await attendre(500);
      setFini(true);
    }
  });

  useEffect(() => {
    // La préparation peut dépasser la durée d'une connexion : on se reconnecte, le travail déjà fait est conservé.
    let flux: EventSource | null = null;
    let termine = false;
    let reprises = 0;
    const ouvrir = () => {
      flux = new EventSource(`/api/atelier?d=${encodeURIComponent(jeton)}`);
      flux.onmessage = (m) => {
        const e = JSON.parse(m.data) as EvenementAtelier;
        if (e.type === "fin" || e.type === "erreur") {
          termine = true;
          flux?.close();
        }
        jouer(e);
      };
      flux.onerror = () => {
        flux?.close();
        if (termine) return;
        if (reprises++ < 4) setTimeout(ouvrir, 1500);
        else jouer({ type: "erreur", message: "La connexion s'est interrompue. Rechargez la page : le travail déjà fait est conservé." });
      };
    };
    ouvrir();
    return () => {
      termine = true;
      flux?.close();
    };
  }, [jeton, jouer]);

  const utiles = lignes?.filter((l) => l.etat !== "raye" && l.etat !== "contacte") ?? [];
  const decideurs = utiles.filter((l) => l.decideur).length;
  const messages = utiles.filter((l) => l.message).length;
  const aVerifier = utiles.filter((l) => l.etat === "pret" && prioriteDe(l.signaux) === "a_verifier").length;
  const pretes = utiles.filter((l) => l.etat === "pret").length - aVerifier;
  // Le classement final n'arrive qu'à la fin : pendant le travail, les lignes ne bougent pas.
  const affichees = lignes ? (fini ? ordonner(lignes) : lignes) : [];
  const traites = utiles.filter((l) => l.etat !== "a_faire").length;
  const pct = fini ? 100 : utiles.length ? Math.max(6, Math.round((traites / utiles.length) * 92)) : 6;
  const agentSur = (siren: string, colonne: Colonne) => [1, 2, 3].find((n) => postes[n]?.siren === siren && postes[n]?.colonne === colonne);

  const cellule = (l: LigneAtelier, colonne: Colonne, contenu: React.ReactNode) => {
    const n = agentSur(l.siren, colonne);
    return (
      <td className={n ? `vise a${n}` : undefined}>
        {contenu}
        {n && <Agent n={n} />}
      </td>
    );
  };

  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <ol className="etapes" aria-label="Étapes">
          <li className="fait">1</li><li className="fait">2</li><li className="fait">3</li><li className="fait">4</li>
          <li className="ici">5 · Prospection</li>
          <li>6</li>
        </ol>
      </header>

      <div className="corps">
        <aside className="journal">
          <div className="qui"><b>{societe || "Votre dossier"}</b><span>Mandat signé, approche autorisée</span></div>
          <h2>Ce que font les agents</h2>
          <ul className="lignes fil agents">
            {journal.map((j) => (
              <li key={j.cle} className="apparait"><span><Agent n={j.agent} /> {j.texte}</span></li>
            ))}
            {!journal.length && !fini && !erreur && <li className="encours">Ouverture du dossier</li>}
          </ul>
          <p className="promesse">Aucun message ne cite votre nom ni votre ville. Rien ne part sans relecture.</p>
        </aside>

        <main className="resultat">
          <div>
            <h1>{erreur ? "La préparation s'est arrêtée." : fini ? (pretes ? `${pretes} approche${pretes > 1 ? "s sont prêtes" : " est prête"} à partir${aVerifier ? `, ${aVerifier} à vérifier` : ""}.` : aVerifier ? `${aVerifier} approche${aVerifier > 1 ? "s" : ""} à vérifier avant envoi.` : "Aucune approche à préparer.") : "Trois agents préparent vos approches."}</h1>
            <p className="sous">{erreur ?? (fini ? "Vous n'avez rien eu à faire. Les repreneurs qui ont déjà racheté passent en tête ; ceux qui semblent en difficulté passent en dernier." : "Pour chaque repreneur : qui décide, ce qu'il a annoncé publiquement, et le message qui lui donnera envie de vous appeler. Vous n'avez rien à faire.")}</p>
          </div>

          {!erreur && <Avance pct={pct} texte={fini ? "Préparation terminée" : `${traites} repreneur${traites > 1 ? "s" : ""} traité${traites > 1 ? "s" : ""} sur ${utiles.length}`} />}

          {lignes && (
            <>
              <div className="entonnoir">
                <div className="chiffre"><span>Repreneurs à approcher</span><b><Compteur valeur={utiles.length} /></b></div>
                <div className="chiffre"><span>Décideurs identifiés</span><b><Compteur valeur={decideurs} duree={400} /></b></div>
                <div className="chiffre"><span>Pages web lues</span><b><Compteur valeur={pagesLues} duree={300} /></b></div>
                <div className="chiffre"><span>Faits publics trouvés</span><b><Compteur valeur={utiles.reduce((n, l) => n + (l.signaux?.length ?? 0), 0)} duree={400} /></b></div>
                <div className="chiffre"><span>Messages rédigés</span><b><Compteur valeur={messages} duree={400} /></b></div>
                <div className="chiffre cle"><span>Prêtes à partir</span><b><Compteur valeur={pretes} duree={400} /></b></div>
              </div>

              {Object.keys(ecrans).length > 0 && (
                <div className="ecrans">
                  {AGENTS.map((n) => {
                    const ecran = ecrans[n];
                    return (
                      <div key={n} className={`ecran a${n}${ecran?.actif ? " actif" : ""}`}>
                        <p className="ecran-tete"><Agent n={n} /><span>{ecran?.cible ?? "en attente"}</span></p>
                        <p className="ecran-etat">{ecran?.actif && <i className="pouls" />}{ecran?.etat || "attend son premier repreneur"}</p>
                        <ul>
                          {/* La ligne la plus récente en haut : elle reste visible, les anciennes sortent par le bas. */}
                          {ecran?.traces.slice().reverse().map((t) => (
                            <li key={t.cle} className={`trace ${t.genre}`}>
                              {t.genre === "page" ? <><b>{t.texte}</b> {t.detail}</> : t.texte}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="carte tableau-carte apparait">
                <table className="tableau">
                  <thead><tr><th>Repreneur</th><th>Qui décide</th><th>Message</th><th>État</th></tr></thead>
                  <tbody>
                    {affichees.map((l) => (
                      <tr key={l.siren} className={l.etat === "raye" || l.etat === "refus" ? "eteint" : undefined}>
                        {cellule(l, "nom", <>
                          <b>{l.rang}. {l.nom}{l.signaux?.some((x) => x.genre === "rachat") && <span className="pastille">A déjà racheté</span>}{l.signaux?.some((x) => x.genre === "alerte") && <span className="pastille" style={{ color: "#b4690e", borderColor: "#b4690e" }}>À vérifier</span>}</b>
                          <small>{[l.ville, l.effectif, l.site].filter(Boolean).join(" · ")}</small>
                          {l.signaux?.map((x) => (
                            <small key={x.source + x.texte} className={`signal apparait${x.genre === "alerte" ? " alerte" : ""}`}>{x.genre === "alerte" ? "À vérifier : " : ""}{x.texte} <a href={x.source} target="_blank" rel="noreferrer nofollow">source</a></small>
                          ))}
                        </>)}
                        {cellule(l, "decideur", l.decideur ? <><b>{l.decideur}</b><small>{l.qualite}</small></> : l.decideur === "" ? <small>Non publié</small> : <i className="vide" />)}
                        {cellule(l, "message", l.message ? <button className="lien" type="button" onClick={() => setOuvert(ouvert === l.siren ? null : l.siren)}>{ouvert === l.siren ? "Refermer" : "Lire le message"}</button> : <i className="vide" />)}
                        {cellule(l, "etat", l.etat === "pret" && prioriteDe(l.signaux) === "a_verifier" ? <span className="etat" style={{ color: "#b4690e" }}>À vérifier avant envoi</span> : <span className={l.etat === "pret" ? "etat fort" : "etat"}>{l.etat === "pret" && prioriteDe(l.signaux) === "prioritaire" ? "Prête, en priorité" : ETAT[l.etat]}</span>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(() => {
                const lu = ouvert ? lignes.find((l) => l.siren === ouvert) : null;
                const montre = lu?.message ? { titre: `Message pour ${lu.nom}`, agent: 0, texte: lu.message } : direct ? { titre: `écrit à ${direct.pour}`, agent: direct.agent, texte: direct.texte } : null;
                return montre ? (
                  <div className="carte">
                    <p className="source">{montre.agent ? <><Agent n={montre.agent} /> {montre.titre}</> : montre.titre}</p>
                    <p className="lettre">{montre.texte}{montre.agent && !fini ? <span className="curseur" /> : null}</p>
                  </div>
                ) : null;
              })()}
            </>
          )}

          {(fini || erreur) && (
            <div className="carte apparait">
              <p className="message">
                {erreur
                  ? "Le travail déjà fait est conservé dans votre suivi."
                  : "À ce stade du projet, l'équipe Shlomo relit chaque message et l'envoie elle-même. Chaque envoi, chaque réponse et chaque rendez-vous proposé s'inscrit dans votre suivi."}
              </p>
              <div className="actions">
                <a className="bouton" href={`/suivi?d=${encodeURIComponent(jeton)}`}>Voir mon suivi</a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Atelier />
    </Suspense>
  );
}
