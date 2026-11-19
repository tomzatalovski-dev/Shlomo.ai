"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EvenementAtelier, LigneAtelier } from "@/lib/types";
import { Avance, Compteur, attendre, useFile } from "@/app/composants/scene";
import { ordonner, prioriteDe } from "@/lib/priorite";

type Colonne = "nom" | "decideur" | "message" | "etat";
type Poste = { siren: string; colonne: Colonne };
type Direct = { agent: number; pour: string; texte: string };
type Trace = { genre: "requete" | "page" | "fait" | "info" | "relu" | "relu corrige"; texte: string; detail?: string; cle: number };
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
  const [relus, setRelus] = useState(0);
  const [corriges, setCorriges] = useState(0);
  const [presentation, setPresentation] = useState<{ etat: "debut" | "prete" | "sans"; texte: string } | null>(null);
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
      if (e.etape === "relecture") regler(e.agent, { etat: "fait relire le message par un second agent" });
      if (e.etape === "enregistrement") regler(e.agent, { etat: "range l'approche dans votre suivi" });
      if (e.etape === "briefing") regler(e.agent, { etat: "écrit les deux briefings : le vôtre et celui du repreneur" });
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
      if (e.ecartes) tracer(e.agent, { genre: "info", texte: `${e.ecartes} fait${e.ecartes > 1 ? "s écartés" : " écarté"} : la source citée n'est pas une page que j'ai lue` });
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
    } else if (e.type === "relecture") {
      if (e.issue === "valide") {
        setRelus((n) => n + 1);
        tracer(e.agent, { genre: "relu", texte: "Relecture : message validé par le second agent" });
      } else if (e.issue === "corrige" || e.issue === "remplace") {
        setRelus((n) => n + 1);
        setCorriges((n) => n + 1);
        tracer(e.agent, { genre: "relu corrige", texte: `Relecture : ${e.issue === "corrige" ? "message corrigé" : "message remplacé par le modèle sûr"}${e.problemes[0] ? ` (${e.problemes[0]})` : ""}` });
        noter(e.agent, `a ${e.issue === "corrige" ? "corrigé" : "remplacé"} le message pour ${nomDe(e.siren)} après relecture`);
      } else {
        tracer(e.agent, { genre: "info", texte: "Relecture indisponible : message à relire par l'équipe" });
      }
      await attendre(450);
    } else if (e.type === "presentation") {
      if (e.etat === "prete" && e.texte) {
        for (let i = 0; i < e.texte.length; i += 5) {
          setPresentation({ etat: "debut", texte: e.texte.slice(0, i + 5) });
          await attendre(14);
        }
        setPresentation({ etat: "prete", texte: e.texte });
      } else {
        setPresentation({ etat: e.etat, texte: "" });
      }
      await attendre(300);
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

  const etatDeLigne = (l: LigneAtelier) => {
    // Un agent est sur cette ligne : on dit ce qu'il y fait, en direct.
    const n = [1, 2, 3].find((a) => postes[a]?.siren === l.siren);
    if (n && ecrans[n]?.actif && ecrans[n]?.etat) return <span className="etat-net vivant">{ecrans[n].etat}</span>;
    if (l.etat === "pret" && prioriteDe(l.signaux) === "a_verifier") return <span className="etat-net alerte">À vérifier avant envoi</span>;
    return <span className={l.etat === "pret" ? "etat-net fort" : "etat-net"}>{l.etat === "pret" && prioriteDe(l.signaux) === "prioritaire" ? "Prête, en priorité" : ETAT[l.etat]}</span>;
  };
  const faits = utiles.reduce((n, l) => n + (l.signaux?.length ?? 0), 0);
  const lu = ouvert && lignes ? lignes.find((l) => l.siren === ouvert) : null;
  const montre = lu?.message ? { titre: `Message pour ${lu.nom}`, vivant: false, texte: lu.message } : direct ? { titre: `Agent ${direct.agent} écrit à ${direct.pour}`, vivant: !fini, texte: direct.texte } : null;

  return (
    <div className="page epure">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <span className="repere">{societe ? `${societe} · ` : ""}étape 5 sur 6</span>
      </header>

      <main className="colonne">
        <div className="entete">
          <h1>{erreur ? "La préparation s'est arrêtée." : fini ? (pretes ? `${pretes} approche${pretes > 1 ? "s prêtes" : " prête"} à partir.` : aVerifier ? `${aVerifier} approche${aVerifier > 1 ? "s" : ""} à vérifier.` : "Aucune approche à préparer.") : "Vos agents préparent chaque approche."}</h1>
          <p className="sous">{erreur ?? (fini ? `Vous n'avez rien eu à faire.${aVerifier && pretes ? ` ${aVerifier} approche${aVerifier > 1 ? "s restent" : " reste"} à vérifier avant envoi.` : ""} Les repreneurs qui ont déjà racheté passent en tête.` : "Pour chaque repreneur : qui décide, ce qu'il a annoncé publiquement, et le message qui lui donnera envie de vous appeler.")}</p>
          {lignes && (
            <p className="bilan" aria-live="polite">
              <b><Compteur valeur={decideurs} duree={400} /></b> décideur{decideurs > 1 ? "s" : ""} identifié{decideurs > 1 ? "s" : ""} sur {utiles.length}
              {pagesLues > 0 && <>, <b><Compteur valeur={pagesLues} duree={300} /></b> pages lues</>}
              {faits > 0 && <>, <b><Compteur valeur={faits} duree={400} /></b> fait{faits > 1 ? "s" : ""} public{faits > 1 ? "s" : ""}</>}
              , <b><Compteur valeur={messages} duree={400} /></b> message{messages > 1 ? "s" : ""} rédigé{messages > 1 ? "s" : ""}
              {relus > 0 && <> dont <Compteur valeur={relus} duree={400} /> relu{relus > 1 ? "s" : ""} par un second agent{corriges > 0 ? ` et ${corriges} corrigé${corriges > 1 ? "s" : ""}` : ""}</>}.
            </p>
          )}
        </div>

        {!erreur && <Avance pct={pct} texte={fini ? "Préparation terminée" : `${traites} repreneur${traites > 1 ? "s" : ""} traité${traites > 1 ? "s" : ""} sur ${utiles.length}`} trace={journal.length ? `Agent ${journal[journal.length - 1].agent} ${journal[journal.length - 1].texte}` : undefined} />}

        {!fini && !erreur && Object.keys(ecrans).length > 0 && (
          <section className="agents-net" aria-label="Les agents au travail">
            {AGENTS.map((n) => {
              const ecran = ecrans[n];
              const trace = ecran?.traces.at(-1);
              return (
                <div key={n} className={ecran?.actif ? "agent-net actif" : "agent-net"}>
                  <span className="qui-net">Agent {n}</span>
                  <span className="quoi-net">
                    <b>{ecran?.cible ?? "En attente"}</b>
                    <span className={ecran?.actif ? "fait-net vivant" : "fait-net"}>{ecran?.etat || "attend son premier repreneur"}</span>
                    {trace && <small>{trace.genre === "page" ? `${trace.texte} ${trace.detail ?? ""}` : trace.texte}</small>}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {montre && (
          <section className="lettre-net">
            <p className="intertitre">{montre.titre}</p>
            <p className="lettre">{montre.texte}{montre.vivant ? <span className="curseur" /> : null}</p>
          </section>
        )}

        {presentation && presentation.etat !== "sans" && presentation.texte && (
          <section className="lettre-net apparait">
            <p className="intertitre">{presentation.etat === "prete" ? "Présentation anonyme de votre société, remise aux repreneurs" : "Un agent rédige la présentation anonyme de votre société"}</p>
            <p className="lettre" style={{ minHeight: 0 }}>{presentation.texte}{presentation.etat !== "prete" && <span className="curseur" />}</p>
          </section>
        )}

        {lignes && (
          <section>
            <p className="intertitre">{fini ? "Vos repreneurs, dans l'ordre où les approcher" : "Vos repreneurs"}</p>
            <div className="flux">
              {affichees.map((l) => (
                <div key={l.siren} className={l.etat === "raye" || l.etat === "refus" ? "flux-ligne ecartee" : "flux-ligne"}>
                  <span className="quoi">
                    <b>{l.rang}. {l.nom}</b>
                    {l.signaux?.some((x) => x.genre === "rachat") && <span className="marque">A déjà racheté</span>}
                    {l.signaux?.some((x) => x.genre === "alerte") && <span className="marque alerte">À vérifier</span>}
                    <small>{l.decideur ? `${l.decideur}${l.qualite ? `, ${l.qualite}` : ""}` : l.decideur === "" ? "Décideur non publié" : [l.ville, l.effectif].filter(Boolean).join(" · ")}</small>
                    {l.signaux?.map((x) => (
                      <small key={x.source + x.texte} className="apparait">{x.genre === "alerte" ? "À vérifier : " : ""}{x.texte} <a href={x.source} target="_blank" rel="noreferrer nofollow">source</a></small>
                    ))}
                  </span>
                  <span className="ou">{l.message ? <button className="lien" type="button" onClick={() => setOuvert(ouvert === l.siren ? null : l.siren)}>{ouvert === l.siren ? "Refermer" : "Lire le message"}</button> : null}</span>
                  {etatDeLigne(l)}
                </div>
              ))}
            </div>
          </section>
        )}

        {(fini || erreur) && (
          <section className="appel apparait">
            <h2>{erreur ? "Le travail déjà fait est conservé." : "La suite se lit dans votre suivi."}</h2>
            <p>{erreur ? "Rechargez la page, ou ouvrez votre suivi : rien n'est perdu." : "L'équipe Shlomo relit chaque message et l'envoie elle-même. Chaque envoi, chaque réponse et chaque rendez-vous s'y inscrit."}</p>
            <a className="bouton" href={`/suivi?d=${encodeURIComponent(jeton)}`}>Voir mon suivi</a>
          </section>
        )}

        {journal.length > 0 && (
          <details className="detail">
            <summary>Voir le journal des agents</summary>
            <ul className="lignes">
              {journal.slice().reverse().map((j) => <li key={j.cle}>Agent {j.agent} {j.texte}</li>)}
            </ul>
          </details>
        )}
        <p className="promesse">Aucun message ne cite votre nom ni votre ville. Rien ne part sans relecture.</p>
      </main>
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
