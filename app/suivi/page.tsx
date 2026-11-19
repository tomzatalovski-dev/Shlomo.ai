import type { Metadata } from "next";
import { BaseIndisponible, lireSuivi, lireTravail, type Presentation, type StatutPresentation, type Travail } from "@/lib/base";
import { PISTE, etapeDe, horsCourse, phraseEtat, prochaineEtape } from "@/lib/parcours";
import Direct from "./Direct";
import { Exclusion } from "./Exclusion";
import { Prix } from "./Prix";
import { Revelation } from "./Revelation";
import { Documents } from "./Documents";
import { Creneaux } from "./Creneaux";
import { Offres } from "./Offres";
import { direCreneau } from "@/lib/creneaux";
import { chercherSociete } from "@/lib/registre";
import { estimer } from "@/lib/estimation";
import { ordonner, prioriteDe } from "@/lib/priorite";

export const dynamic = "force-dynamic";
// L'adresse de cette page contient le jeton secret du dossier : ni indexation, ni fuite vers d'autres sites.
export const metadata: Metadata = { title: "Vos repreneurs — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATUT: Record<StatutPresentation, string> = {
  identifie: "À contacter",
  contacte: "Contacté",
  relance: "Relancé",
  a_repondu: "A répondu",
  interesse: "Intéressé",
  confidentialite_signee: "Confidentialité signée",
  rendez_vous: "Rendez-vous pris",
  offre: "Offre remise",
  conclu: "Cession conclue",
  sans_suite: "Sans suite",
};
const CONTACTES: StatutPresentation[] = ["contacte", "relance", "a_repondu", "interesse", "confidentialite_signee", "rendez_vous", "offre", "conclu", "sans_suite"];
const REPONSES: StatutPresentation[] = ["a_repondu", "interesse", "confidentialite_signee", "rendez_vous", "offre", "conclu", "sans_suite"];
const INTERESSES: StatutPresentation[] = ["interesse", "confidentialite_signee", "rendez_vous", "offre", "conclu"];

const date = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const compter = (liste: Presentation[], statuts: StatutPresentation[]) => liste.filter((p) => statuts.includes(p.statut)).length;

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="page epure">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <span className="repere">Votre suivi</span>
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

  const travail: Travail = await lireTravail(jeton).catch(() => ({}));
  const actifs = suivi.presentations.filter((p) => !p.exclu);
  // Les plus avancés d'abord : c'est là que le cédant regarde.
  const enCourse = ordonner(suivi.presentations).filter((p) => !horsCourse(p)).sort((a, b) => etapeDe(b) - etapeDe(a));
  const sortis = suivi.presentations.filter(horsCourse);
  const autorise = suivi.mandat?.autorisation_approche === true;
  const aDecider = actifs.filter((p) => p.accord && !p.revelation);
  const offres = actifs.flatMap((p) => (p.offres ?? []).map((offre) => ({ nom: p.nom, offre }))).sort((x, y) => Number(Boolean(x.offre.reponse)) - Number(Boolean(y.offre.reponse)) || y.offre.prix - x.offre.prix);
  // Repère de prix tiré des comptes publiés, seulement tant que le vendeur n'a rien validé. Le registre peut être lent : on s'en passe alors.
  let repere: { bas: number; haut: number } | null = null;
  if (autorise && !suivi.fourchette) {
    const societe = await chercherSociete(suivi.societe.siren).catch(() => null);
    const estimation = societe ? estimer(societe.finances ?? []) : null;
    if (estimation?.possible) repere = { bas: estimation.bas, haut: estimation.haut };
  }

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
            <h1>{autorise ? phraseEtat(suivi) : "Votre mandat est signé."}</h1>
            <p className="sous">
              {suivi.mandat ? `Mandat de test${suivi.mandat.numero ? ` n° ${String(suivi.mandat.numero).padStart(4, "0")}` : ""} signé par ${suivi.mandat.signataire} le ${date(suivi.mandat.signe_le)}${suivi.mandat.echeance ? `, valable jusqu'au ${new Date(suivi.mandat.echeance).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}` : ""}, sans valeur juridique. ` : ""}
              {autorise ? (suivi.qualite === "validee" ? "" : suivi.qualite === "refusee" ? "Nous n'avons pas pu confirmer votre qualité de dirigeant : aucun message ne part. Écrivez-nous. " : "Nous confirmons votre qualité de dirigeant sous 24 heures ; aucun message ne part avant. ") + "Shlomo s'occupe de tout ; vos seules décisions s'affichent en haut de cette page." : "Vous n'avez pas autorisé l'approche : aucun repreneur ne sera contacté."}
            </p>
          </div>

          {autorise && <Direct faits={suivi.evenements.slice(0, 4).map((e) => ({ texte: e.texte, quand: date(e.cree_le) }))} suite={prochaineEtape(suivi)} />}

          {aDecider.length > 0 && (
            <div className="carte decider">
              <p className="message"><b>Une décision vous attend.</b> {aDecider.length > 1 ? "Ces repreneurs ont signé l'accord de confidentialité. Votre nom ne leur est communiqué que si vous le décidez." : "Ce repreneur a signé l'accord de confidentialité. Votre nom ne lui est communiqué que si vous le décidez."}</p>
              {aDecider.map((p) => (
                <div key={p.siren} className="ligne">
                  <span className="quoi"><b>{p.nom}</b><small>Signé par {p.accord!.signataire}{p.accord!.qualite ? `, ${p.accord!.qualite}` : ""}, le {date(p.accord!.signe_le)} · {[p.ville, p.effectif].filter(Boolean).join(" · ")}</small></span>
                  <span className="ou"><Revelation jeton={jeton} siren={p.siren} nom={p.nom} refusee={false} /></span>
                </div>
              ))}
            </div>
          )}

          {offres.length > 0 && <Offres jeton={jeton} offres={offres} fourchette={suivi.fourchette ?? null} />}

          {autorise && <Prix jeton={jeton} validee={suivi.fourchette ?? null} repere={repere} />}
          {autorise && <Documents jeton={jeton} documents={suivi.documents ?? []} />}
          {autorise && <Creneaux jeton={jeton} creneaux={suivi.creneaux ?? []} pris={actifs.filter((p) => p.rendez_vous).map((p) => ({ creneau: p.rendez_vous!, nom: p.nom }))} />}

          <section className="parcours">
            <h2>Vos repreneurs, un par un</h2>
            {enCourse.map((p) => {
              const etape = etapeDe(p);
              const t = travail[p.siren];
              const b = t?.briefing;
              const attente = p.statut === "identifie" && p.canal === "a_envoyer" && prioriteDe(p.signaux) === "a_verifier";
              return (
                <details key={p.siren} className="repreneur-piste" open={etape >= 3 && enCourse.filter((x) => etapeDe(x) >= 3).length === 1}>
                  <summary>
                    <span className="qui"><b>{p.nom}</b><small>{[p.ville, p.effectif].filter(Boolean).join(" · ")}</small></span>
                    <span className="piste" role="img" aria-label={etape ? `Étape ${etape} sur 6 : ${PISTE[etape - 1]}` : "Approche en préparation"}>
                      {PISTE.map((nom, i) => <i key={nom} className={i < etape - 1 ? "fait" : i === etape - 1 ? "ici" : ""} />)}
                    </span>
                    <span className="ou-piste">{etape ? (etape === 6 ? "Offre remise" : etape === 5 ? "Rendez-vous pris" : PISTE[etape - 1]) : "En préparation"}{attente ? " · à vérifier avant envoi" : ""}</span>
                  </summary>
                  <div className="dedans">
                    {(p.accord || p.rendez_vous) && (
                      <p className="source">
                        {[p.accord && (p.revelation === "autorisee" ? "Votre nom lui a été communiqué" : p.revelation === "refusee" ? "Vous avez refusé de vous nommer" : "Il a signé l'accord de confidentialité"), p.rendez_vous && `Rendez-vous ${direCreneau(p.rendez_vous)}`].filter(Boolean).join(" · ")}
                        {p.accord && p.revelation === "refusee" && <> <Revelation jeton={jeton} siren={p.siren} nom={p.nom} refusee /></>}
                      </p>
                    )}

                    {(t?.echanges.length ?? 0) > 0 && (
                      <div className="echanges">
                        <h3>La conversation</h3>
                        {t!.echanges.map((e, i) => (
                          <div key={i} className={e.de === "repreneur" ? "echange recu" : "echange envoye"}>
                            <small>{e.de === "repreneur" ? p.nom : "Shlomo, pour vous"} · {date(e.le)}</small>
                            <p>{e.texte}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {b ? (
                      <div className="brief">
                        {b.pourquoiVous.length > 0 && <section><h3>Pourquoi vous l'intéressez</h3><ul>{b.pourquoiVous.map((x) => <li key={x}>{x}</li>)}</ul></section>}
                        {b.quiIlEst.length > 0 && <section><h3>Qui il est, d'après ses comptes</h3><ul className="serre">{b.quiIlEst.map((x) => <li key={x}>{x}</li>)}</ul></section>}
                        {b.questions.length > 0 && <section><h3>Ce qu'il vous demandera</h3><ul>{b.questions.map((x) => <li key={x}>{x}</li>)}</ul></section>}
                        {b.aborder.length > 0 && <section><h3>Comment aborder la rencontre</h3><ul>{b.aborder.map((x) => <li key={x}>{x}</li>)}</ul></section>}
                        {b.comparables && <section><h3>Ce que des fonds comparables se sont vendus</h3><p className="mention">{b.comparables}</p></section>}
                        <p className="mention">Les chiffres viennent des comptes publiés. Les raisons, les questions et les conseils sont une analyse rédigée par une intelligence artificielle : à vérifier avec lui, pas à prendre pour acquis.</p>
                      </div>
                    ) : (
                      <p className="source">{[...p.raisons].join(" · ")}</p>
                    )}

                    {p.signaux?.map((x) => (
                      <small key={x.source + x.texte} className={x.genre === "alerte" ? "signal alerte" : "signal"}>{x.genre === "alerte" ? "À vérifier : " : ""}{x.texte} <a href={x.source} target="_blank" rel="noreferrer nofollow">source</a></small>
                    ))}
                    {p.message && (
                      <details className="pli">
                        <summary>Lire le premier message{p.decideur ? `, adressé à ${p.decideur}` : ""}</summary>
                        <p className="lettre">{p.message}</p>
                      </details>
                    )}
                    <p className="source">
                      <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${p.siren}`} target="_blank" rel="noreferrer">Fiche publique</a>
                      {p.score ? ` · Note ${p.score} sur 100` : ""}
                      {p.statut === "identifie" && !p.canal && <> · <Exclusion jeton={jeton} siren={p.siren} exclu={p.exclu} /></>}
                    </p>
                  </div>
                </details>
              );
            })}
            {sortis.length > 0 && (
              <p className="source">
                Sortis de la course : {sortis.map((p) => `${p.nom} (${p.exclu ? "rayé à votre demande" : p.canal === "refus_demarchage" ? "ne veut pas être démarché" : "sans suite"})`).join(", ")}.
              </p>
            )}
          </section>

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
