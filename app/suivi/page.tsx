import type { Metadata } from "next";
import { BaseIndisponible, lireSuivi, type Presentation, type StatutPresentation } from "@/lib/base";
import { Exclusion } from "./Exclusion";
import { ordonner, prioriteDe } from "@/lib/priorite";

export const dynamic = "force-dynamic";
// L'adresse de cette page contient le jeton secret du dossier : ni indexation, ni fuite vers d'autres sites.
export const metadata: Metadata = { title: "Suivi de votre dossier — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATUT: Record<StatutPresentation, string> = {
  identifie: "À contacter",
  contacte: "Contacté",
  relance: "Relancé",
  a_repondu: "A répondu",
  interesse: "Intéressé",
  confidentialite_signee: "Confidentialité signée",
  rendez_vous: "Rendez-vous proposé",
  sans_suite: "Sans suite",
};
const CONTACTES: StatutPresentation[] = ["contacte", "relance", "a_repondu", "interesse", "confidentialite_signee", "rendez_vous", "sans_suite"];
const REPONSES: StatutPresentation[] = ["a_repondu", "interesse", "confidentialite_signee", "rendez_vous", "sans_suite"];
const INTERESSES: StatutPresentation[] = ["interesse", "confidentialite_signee", "rendez_vous"];

const date = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const compter = (liste: Presentation[], statuts: StatutPresentation[]) => liste.filter((p) => statuts.includes(p.statut)).length;

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <ol className="etapes" aria-label="Étapes">
          <li className="fait">1</li><li>2</li><li>3</li><li className="fait">4</li>
          <li className="ici">Suivi de l'approche</li>
        </ol>
      </header>
      {children}
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const jeton = (await searchParams).d ?? "";
  let suivi = null;
  let panne = false;
  try {
    suivi = await lireSuivi(jeton);
  } catch (e) {
    if (!(e instanceof BaseIndisponible)) throw e;
    panne = true;
  }

  if (!suivi) {
    return (
      <Cadre>
        <div className="corps">
          <main className="resultat" style={{ margin: "0 auto" }}>
            <div><h1>{panne ? "Le suivi est momentanément indisponible." : "Ce lien de suivi n'est pas reconnu."}</h1></div>
            <div className="carte">
              <p className="message">{panne ? "Rechargez la page dans quelques minutes." : "Vérifiez que l'adresse est complète, ou reprenez depuis l'accueil."}</p>
              <div className="actions"><a className="lien" href="/">Revenir à l'accueil</a></div>
            </div>
          </main>
        </div>
      </Cadre>
    );
  }

  const actifs = suivi.presentations.filter((p) => !p.exclu);
  const autorise = suivi.mandat?.autorisation_approche === true;

  return (
    <Cadre>
      <div className="corps">
        <aside className="journal">
          <div className="qui"><b>{suivi.societe.nom}</b><span>SIREN {suivi.societe.siren}</span></div>
          <h2>Ce qui s'est passé</h2>
          <ul className="lignes fil">
            {suivi.evenements.map((e, i) => (
              <li key={i}><span>{e.texte}<small>{date(e.cree_le)}</small></span></li>
            ))}
          </ul>
          <p className="promesse">Gardez l'adresse de cette page : c'est votre accès au suivi.</p>
        </aside>

        <main className="resultat">
          <div>
            <h1>{autorise ? "Shlomo travaille pour vous." : "Votre mandat est signé."}</h1>
            <p className="sous">
              {suivi.mandat ? `Mandat de test signé par ${suivi.mandat.signataire} le ${date(suivi.mandat.signe_le)}, sans valeur juridique. ` : ""}
              {autorise ? "Vous n'avez rien à faire : cette page se met à jour à chaque étape." : "Vous n'avez pas autorisé l'approche : aucun repreneur ne sera contacté."}
            </p>
          </div>

          <div className="entonnoir">
            <div className="chiffre"><span>Repreneurs présentés</span><b>{actifs.length}</b></div>
            <div className="chiffre"><span>Contactés</span><b>{compter(actifs, CONTACTES)}</b></div>
            <div className="chiffre"><span>Ont répondu</span><b>{compter(actifs, REPONSES)}</b></div>
            <div className="chiffre cle"><span>Intéressés</span><b>{compter(actifs, INTERESSES)}</b></div>
          </div>

          <div className="carte liste">
            {ordonner(suivi.presentations).map((p) => (
              <div key={p.siren} className={p.exclu ? "ligne ecartee" : "ligne"}>
                <span className="quoi">
                  <b>{p.rang}. {p.nom}</b>
                  <small>{[p.ville, p.effectif, ...p.raisons].filter(Boolean).join(" · ")}</small>
                  {p.decideur && <small>Décideur : {p.decideur}{p.qualite ? `, ${p.qualite}` : ""}</small>}
                  {p.signaux?.map((x) => (
                    <small key={x.source + x.texte} className={x.genre === "alerte" ? "signal alerte" : "signal"}>{x.genre === "alerte" ? "À vérifier : " : ""}{x.texte} <a href={x.source} target="_blank" rel="noreferrer nofollow">source</a></small>
                  ))}
                  {p.message && (
                    <details className="pli">
                      <summary>Lire le message préparé</summary>
                      <p className="lettre">{p.message}</p>
                    </details>
                  )}
                </span>
                <span className="ou">
                  <b className={INTERESSES.includes(p.statut) ? "etat fort" : "etat"}>{p.exclu ? "Rayé à votre demande" : p.canal === "refus_demarchage" ? "Ne veut pas être démarché" : p.statut === "identifie" && p.canal === "a_envoyer" ? (prioriteDe(p.signaux) === "a_verifier" ? "À vérifier avant envoi" : prioriteDe(p.signaux) === "prioritaire" ? "Approche prête, en priorité" : "Approche prête") : STATUT[p.statut]}</b>
                  <br />
                  <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${p.siren}`} target="_blank" rel="noreferrer">Fiche publique</a>
                  {p.statut === "identifie" && !p.canal && <> · <Exclusion jeton={jeton} siren={p.siren} exclu={p.exclu} /></>}
                </span>
                <span className="note">{p.score ?? ""}</span>
              </div>
            ))}
          </div>

          <div className="carte">
            <p className="message">
              {autorise
                ? "Les agents préparent, pour chaque repreneur, le nom du décideur et un message qui ne cite ni votre nom ni votre ville. À ce stade du projet, l'équipe Shlomo relit chaque message et l'envoie elle-même ; chaque étape s'inscrit ici."
                : "Pour lancer l'approche, il faudra signer un mandat qui l'autorise."}
            </p>
            {autorise && (
              <div className="actions">
                <a className="lien" href={`/atelier?d=${jeton}`}>Voir les agents au travail</a>
                {suivi.jeton_fiche && <a className="lien" href={`/fiche?f=${suivi.jeton_fiche}`} target="_blank" rel="noreferrer">Voir la présentation anonyme remise aux repreneurs</a>}
              </div>
            )}
            <p className="source">Vous pouvez rayer un repreneur tant que son approche n'est pas préparée. C'est facultatif.</p>
          </div>
        </main>
      </div>
    </Cadre>
  );
}
