"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CandidatMasque, EvenementRepreneurs, RepreneurMasque, RepreneurRevele } from "@/lib/types";
import { Avance, Compteur, attendre, useFile } from "@/app/composants/scene";

type Ligne = { texte: string; etat: "ok" | "alerte" };
type Recent = CandidatMasque & { cle: number; libelle: string };

/** Ce que la veille révèle avant le mandat : le genre du fait, jamais le fait lui-même, qui nommerait le repreneur. */
const INDICE: Record<"rachat" | "croissance" | "alerte", string> = {
  rachat: "A déjà racheté une société",
  croissance: "En croissance : ouverture, investissement ou hausse d'activité annoncée",
  alerte: "Un signal de difficulté, à vérifier",
};

const nombre = (n: number) => (n >= 10_000 ? "plus de 10 000" : n.toLocaleString("fr-FR"));

/** Pas prêt à signer : le dirigeant laisse son adresse, on garde le fil. */
function Garder({ siren }: { siren: string }) {
  const [courriel, setCourriel] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "fait" | "rate">("saisie");
  if (etat === "fait") return <p className="source">C'est noté. Vos repreneurs vous attendent : revenez quand vous voulez avec votre numéro SIREN.</p>;
  return (
    <form className="garder" onSubmit={async (e) => {
      e.preventDefault();
      setEtat("envoi");
      const rep = await fetch("/api/prospect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siren, courriel }) }).catch(() => null);
      setEtat(rep?.ok ? "fait" : "rate");
    }}>
      <label htmlFor="rappel">Pas prêt à signer aujourd'hui ? Laissez votre adresse, nous gardons le fil.</label>
      <span>
        <input id="rappel" type="email" required autoComplete="email" placeholder="vous@votresociete.fr" value={courriel} onChange={(e) => setCourriel(e.target.value)} />
        <button type="submit" className="lien" disabled={etat === "envoi"}>{etat === "envoi" ? "Envoi…" : etat === "rate" ? "Réessayer" : "Garder mon dossier"}</button>
      </span>
    </form>
  );
}

function Repreneurs() {
  const parametres = useSearchParams();
  const siren = parametres.get("siren") ?? "";
  const metiers = parametres.get("m") ?? "";
  const site = parametres.get("site") ?? "";
  const taille = /^\d{1,6}$/.test(parametres.get("e") ?? "") ? `&e=${parametres.get("e")}` : "";
  const suite = `${metiers ? `&m=${encodeURIComponent(metiers)}` : ""}${taille}`;
  const versMandat = `${suite}${site ? `&site=${encodeURIComponent(site)}` : ""}`;
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
  const [indices, setIndices] = useState<Record<number, ("rachat" | "croissance" | "alerte")[]>>({});
  const [bilans, setBilans] = useState<Record<number, Extract<EvenementRepreneurs, { type: "bilan" }>>>({});
  const [veille, setVeille] = useState<"non" | "encours" | "faite">("non");
  const [erreur, setErreur] = useState<string | null>(null);

  // Chaque événement réel du serveur est joué à son tour, à un rythme lisible.
  const jouer = useFile<EvenementRepreneurs>(async (e) => {
    if (e.type === "indices") {
      setIndices((i) => ({ ...i, [e.rang]: e.genres }));
      setVeille("faite");
      await attendre(700 * rythme);
    } else if (e.type === "encours") {
      if (/annoncé publiquement/.test(e.texte)) setVeille("encours");
      setEncours(e.texte);
      setAvance((a) => ({ pct: Math.min(a.pct + 12, 85), texte: e.texte }));
      await attendre(800 * rythme);
    } else if (e.type === "journal") {
      setLignes((l) => [...l, { texte: e.texte, etat: e.etat }]);
      await attendre(450 * rythme);
    } else if (e.type === "bilan") {
      setBilans((b) => ({ ...b, [e.rang]: e }));
      await attendre(700 * rythme);
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
      setVeille((v) => (v === "encours" ? "faite" : v));
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

  // Une fois la veille lue, un repreneur en difficulté passe derrière les deux autres ; un acheteur déjà actif passe devant.
  const poids = (rang: number) => (veille !== "faite" ? 1 : indices[rang]?.includes("alerte") ? 2 : indices[rang]?.includes("rachat") ? 0 : 1);
  const premiers = (liste?.slice(0, 3) ?? []).slice().sort((a, b) => poids(a.rang) - poids(b.rang) || a.rang - b.rang);
  const suivants = liste?.slice(3) ?? [];
  const n = liste?.length ?? 0;
  const aDesNoms = Boolean(reveles && reveles.length > 0);
  const cherche = liste === null && !erreur;

  const acheteurs = Object.values(indices).filter((g) => g.includes("rachat") && !g.includes("alerte")).length;
  const accroche = acheteurs > 0
    ? `${acheteurs === 1 ? "L'un de vos trois premiers repreneurs a" : `${acheteurs} de vos trois premiers repreneurs ont`} déjà racheté une société. Signez le mandat pour voir ${acheteurs === 1 ? "son nom" : "leurs noms"} et lancer l'approche.`
    : "Signez le mandat pour voir les noms et lancer l'approche.";

  const titre = erreur
    ? "La recherche s'est arrêtée."
    : aDesNoms
      ? "Mandat signé. Voici vos repreneurs."
      : liste === null
        ? "Je cherche vos repreneurs."
        : n === 0
          ? "Le registre ne montre pas encore de repreneur évident."
          : n <= 3
            ? n > 1 ? "Vos meilleurs repreneurs." : "Votre meilleur repreneur."
            : "Vos trois meilleurs repreneurs.";

  const [premier, ...autres] = premiers;
  const carte = (r: (typeof premiers)[number], grand: boolean, place: number) => (
    <article key={r.rang} className={grand ? "repreneur-net grand" : "repreneur-net"} style={{ animationDelay: `${(r.rang - 1) * 0.45}s` }}>
      <div className="tete">
        <span className="rang-net">{place}</span>
        <span className="profil-net">{r.profil}</span>
        <span className="score-net"><b><Compteur valeur={r.score} duree={1200} format={(v) => String(Math.round(v))} /></b> sur 100</span>
      </div>
      <h2>{bilans[r.rang]?.titre ?? r.raison}.</h2>
      {(bilans[r.rang]?.titre ? [r.raison, ...r.details] : r.details).length > 0 && <p className="details-net">{(bilans[r.rang]?.titre ? [r.raison, ...r.details] : r.details).join(" · ")}</p>}
      {bilans[r.rang] && bilans[r.rang].lignes.length > 0 && (
        <p className="indice-net bilan-net"><b>Bilan {bilans[r.rang].annee} lu ligne à ligne.</b> {bilans[r.rang].lignes.join(" · ")}</p>
      )}
      {bilans[r.rang]?.reserves.map((x) => <p key={x} className="indice-net alerte">À vérifier : {x.charAt(0).toLowerCase() + x.slice(1)}</p>)}
      {veille === "encours" && !indices[r.rang] && <p className="indice-net attente">Je lis ce qu'elle a annoncé publiquement…</p>}
      {indices[r.rang]?.map((g) => <p key={g} className={`indice-net ${g}`}>{INDICE[g]}</p>)}
      {veille === "faite" && indices[r.rang]?.length === 0 && <p className="indice-net">Rien de notable annoncé publiquement.</p>}
      {r.reserves?.map((x) => <p key={x} className="indice-net alerte">À vérifier : {x.charAt(0).toLowerCase() + x.slice(1)}</p>)}
      <p className="pied-net"><span className="masque">Nom masqué</span>{[r.zone, r.effectif].filter(Boolean).join(" · ")}</p>
    </article>
  );

  return (
    <div className="page epure">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <span className="repere">{vendeur?.nom ? `${vendeur.nom} · ` : ""}étape 4 sur 6</span>
      </header>

      <main className="colonne">
        <div className="entete">
          <h1>{titre}</h1>
          {cherche && <p className="sous">Je pars de toutes les sociétés de votre métier et je ne garde que celles qui ont une raison de vous racheter.</p>}
          {aDesNoms && <p className="sous">Mandat de test signé par {par || "vous"}, sans valeur juridique. Les noms ne sont visibles que de vous.</p>}
          {liste !== null && n === 0 && !erreur && !aDesNoms && (
            <p className="sous">{metiers ? "Aucune société plus grande que vous n'apparaît dans ces activités." : "Aucune société plus grande que vous n'apparaît sous votre code d'activité. Donnez l'adresse de votre site à l'étape 1 : je chercherai aussi parmi les activités voisines."}</p>
          )}
          {!erreur && (compte.vues > 0 || metier !== null) && (
            <p className="bilan" aria-live="polite">
              {compte.vues > 0 ? <><b><Compteur valeur={compte.vues} duree={500} format={nombre} /></b> société{compte.vues > 1 ? "s" : ""} examinée{compte.vues > 1 ? "s" : ""}, <b><Compteur valeur={compte.oui} duree={500} format={nombre} /></b> compatible{compte.oui > 1 ? "s" : ""}</> : "Recherche en cours"}
              {metier !== null && <>, parmi <Compteur valeur={metier} duree={1100} format={nombre} /> {metiers ? "dans vos activités" : "de votre métier"} en France</>}.
              {!cherche && n > 0 && !aDesNoms ? " Les noms s'affichent après la signature du mandat." : ""}
            </p>
          )}
        </div>

        {!erreur && <Avance pct={avance.pct} texte={avance.texte} trace={examen || lignes[lignes.length - 1]?.texte} />}

        {erreur && (
          <div className="carte">
            <p className="message">{erreur}</p>
            <div className="actions"><a className="lien" href="/">Revenir à l'accueil</a></div>
          </div>
        )}

        {cherche && <p className="examen" aria-live="off">{examen || " "}</p>}

        {cherche && recents.length > 0 && (
          <div className="flux">
            {recents.map((c) => (
              <div key={c.cle} className={c.retenu ? "flux-ligne apparait" : "flux-ligne ecartee apparait"}>
                <span className="quoi"><b>{c.retenu ? c.raison : "Écartée"}</b><small>{c.retenu ? (c.details ?? []).join(" · ") : c.motif}</small></span>
                <span className="ou">{[c.libelle, c.effectif].filter(Boolean).join(" · ")}</span>
                <span className="note">{c.retenu ? c.score : "—"}</span>
              </div>
            ))}
          </div>
        )}

        {aDesNoms && (
          <div className="flux apparait">
            {reveles!.map((r) => (
              <div key={r.siren} className="flux-ligne">
                <span className="quoi"><b>{r.rang}. {r.nom}</b><small>{[r.ville, r.effectif, ...r.raisons, ...(r.reserves ?? []).map((x) => `À vérifier : ${x.charAt(0).toLowerCase() + x.slice(1)}`)].filter(Boolean).join(" · ")}</small></span>
                <span className="ou">{r.profil}<br /><a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${r.siren}`} target="_blank" rel="noreferrer">Fiche publique</a></span>
                <span className="note">{r.score}</span>
              </div>
            ))}
          </div>
        )}

        {premier && (
          <section className="podium" aria-label="Vos meilleurs repreneurs">
            {carte(premier, true, 1)}
            {autres.length > 0 && <div className="duo">{autres.map((r, i) => carte(r, false, i + 2))}</div>}
          </section>
        )}

        {suivants.length > 0 && (
          <section className="apparait">
            <p className="intertitre">Les {suivants.length} suivants</p>
            <div className="flux">
              {suivants.map((r) => (
                <div key={r.rang} className="flux-ligne">
                  <span className="quoi"><b>{r.raison}</b>{r.details.length + (r.reserves?.length ?? 0) > 0 && <small>{[...r.details, ...(r.reserves ?? []).map((x) => `À vérifier : ${x.charAt(0).toLowerCase() + x.slice(1)}`)].join(" · ")}</small>}</span>
                  <span className="ou">{[r.profil, r.effectif].filter(Boolean).join(" · ")}</span>
                  <span className="note">{r.score}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {n > 0 && (
          <section className="appel apparait">
            <h2>{accroche}</h2>
            <p>Gratuit jusqu'ici. Commission de 5 %, minimum 5 000 €, uniquement si la vente se fait avec un repreneur présenté par Shlomo.</p>
            <a className="bouton" href={`/mandat?siren=${encodeURIComponent(siren)}${versMandat}`}>Signer le mandat</a>
            <Garder siren={siren} />
          </section>
        )}

        {lignes.length > 0 && (
          <details className="detail">
            <summary>{encours ? "Voir ce que fait Shlomo" : "Voir le détail de la recherche"}</summary>
            <ul className="lignes">
              {lignes.map((l, i) => <li key={i} className={l.etat === "alerte" ? "alerte" : undefined}>{l.texte}</li>)}
              {encours && <li className="encours">{encours}…</li>}
            </ul>
          </details>
        )}
        <p className="promesse">Rien n'est envoyé sans votre accord.</p>
      </main>
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
