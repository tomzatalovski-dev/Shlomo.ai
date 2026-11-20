import type { Metadata } from "next";
import { headers } from "next/headers";
import { BaseIndisponible, lireSuivi, lireTravail, type Presentation, type StatutPresentation, type Travail } from "@/lib/base";
import { PISTE, direEtape, etapeDe, horsCourse, phraseEtat, prochaineEtape } from "@/lib/parcours";
import Direct from "./Direct";
import { direVille, nomLisible } from "@/lib/lieu";
import { Exclusion } from "./Exclusion";
import { Prix } from "./Prix";
import { Revelation } from "./Revelation";
import { Documents } from "./Documents";
import { Creneaux } from "./Creneaux";
import { Offres } from "./Offres";
import { direCreneau } from "@/lib/creneaux";
import { chercherSociete } from "@/lib/registre";
import { estimer } from "@/lib/estimation";
import { prioriteDe } from "@/lib/priorite";

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

// La personne que le cédant peut joindre. Les coordonnées ne s'affichent que si elles sont réglées : aucune n'est inventée.
const CONTACT = {
  nom: process.env.CONTACT_NOM ?? "Tom Zatalovski",
  role: process.env.CONTACT_ROLE ?? "Dirigeant de Shlomo, il suit votre dossier",
  telephone: process.env.CONTACT_TELEPHONE ?? "",
  courriel: process.env.CONTACT_COURRIEL ?? "",
};

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
  const entetes = await headers();
  const origine = `${entetes.get("x-forwarded-proto") ?? "https"}://${entetes.get("host") ?? "shlomo-ai.vercel.app"}`;
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
  const enCourse = suivi.presentations.filter((p) => !horsCourse(p)).sort((a, b) => etapeDe(b) - etapeDe(a) || a.rang - b.rang);
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

  const [phrase, ...suitePhrase] = (autorise ? phraseEtat(suivi) : "Votre mandat est signé.").split(/(?<=\.)\s+/);
  const actif = autorise && suivi.qualite === "validee";
  const heure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(",", "");
  // Ce que les agents ont réellement produit pour ce dossier : chaque nombre se recompte dans la liste plus bas.
  const produit = [
    { n: enCourse.length, quoi: enCourse.length > 1 ? "repreneurs suivis" : "repreneur suivi" },
    { n: enCourse.filter((p) => p.decideur).length, quoi: "interlocuteurs identifiés" },
    { n: enCourse.reduce((t, p) => t + (p.signaux?.length ?? 0), 0), quoi: "informations vérifiées sur le web" },
    { n: enCourse.filter((p) => p.message).length, quoi: "messages rédigés et relus" },
    { n: enCourse.filter((p) => travail[p.siren]?.briefing).length, quoi: "fiches d'acheteur rédigées" },
  ].filter((x) => x.n > 0);
  const rdvPris = actifs.filter((p) => p.rendez_vous).map((p) => ({ creneau: p.rendez_vous!, nom: p.nom }));

  return (
    <div className="page epure">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
        <span className={actif ? "voyant actif" : "voyant"}><i aria-hidden />{actif ? "Dossier actif" : autorise ? (suivi.qualite === "refusee" ? "Dossier arrêté" : "Vérification en cours") : "Approche non autorisée"}</span>
      </header>

      <main className="console">
        <section className="tete">
          <p className="fil-tete">{nomLisible(suivi.societe.nom)}{suivi.mandat?.numero ? ` · mandat ${String(suivi.mandat.numero).padStart(4, "0")}` : ""}</p>
          <h1>{phrase}{suitePhrase.length > 0 && <span> {suitePhrase.join(" ")}</span>}</h1>
          {autorise && <Direct faits={suivi.evenements.slice(0, 5).map((e) => ({ texte: e.texte, quand: heure(e.cree_le) }))} suite={prochaineEtape(suivi)} />}
        </section>

        {(aDecider.length > 0 || offres.length > 0) && (
          <section className="a-vous">
            <h2>À vous</h2>
            {aDecider.length > 0 && (
              <div className="carte decider">
                <p className="message"><b>{aDecider.length > 1 ? "Ils ont signé l'accord de confidentialité." : "Il a signé l'accord de confidentialité."}</b> Votre nom n'est communiqué que si vous le décidez.</p>
                {aDecider.map((p) => (
                  <div key={p.siren} className="ligne">
                    <span className="quoi"><b>{nomLisible(p.nom)}</b><small>Signé par {p.accord!.signataire}{p.accord!.qualite ? `, ${p.accord!.qualite}` : ""}, le {date(p.accord!.signe_le)}</small></span>
                    <span className="ou"><Revelation jeton={jeton} siren={p.siren} nom={p.nom} refusee={false} /></span>
                  </div>
                ))}
              </div>
            )}
            {offres.length > 0 && <Offres jeton={jeton} offres={offres} fourchette={suivi.fourchette ?? null} />}
          </section>
        )}

        {autorise && enCourse.length > 0 && (
          <section className="carte-etapes">
            <h2>Où en est chaque repreneur</h2>
            <div className="etapes-carte">
              {PISTE.map((nom, i) => {
                const ici = enCourse.filter((p) => etapeDe(p) === i + 1);
                return (
                  <div key={nom} className={ici.length ? "etape-col pleine" : "etape-col"}>
                    <div className="pts">
                      {ici.map((p, k) => <a key={p.siren} href={`#r-${p.siren}`} title={nomLisible(p.nom)} aria-label={`${nomLisible(p.nom)} : ${nom}`} style={{ animationDelay: `${(i * 3 + k) * 45}ms` }} />)}
                    </div>
                    <b>{ici.length || "·"}</b>
                    <span>{nom}</span>
                  </div>
                );
              })}
            </div>
            {produit.length > 0 && (
              <dl className="produit-agents">
                {produit.map((x) => <div key={x.quoi}><dt>{x.n}</dt><dd>{x.quoi}</dd></div>)}
              </dl>
            )}
          </section>
        )}

        <section className="parcours">
          <h2>Repreneurs</h2>
          {enCourse.some((p) => p.statut === "identifie") && (
            <p className="choisir"><b>Vous choisissez à qui Shlomo écrit.</b> Un voisin, un concurrent qui vous connaît, un ancien associé : retirez-le d'un clic, il ne recevra rien. Tant qu'un message n'est pas parti, vous pouvez changer d'avis.</p>
          )}
          {enCourse.map((p) => {
            const etape = etapeDe(p);
            const t = travail[p.siren];
            const b = t?.briefing;
            const attente = p.statut === "identifie" && p.canal === "a_envoyer" && prioriteDe(p.signaux) === "a_verifier";
            return (
              <details key={p.siren} id={`r-${p.siren}`} className="repreneur-piste" open={etape >= 3 && enCourse.filter((x) => etapeDe(x) >= 3).length === 1}>
                <summary>
                  <span className="rang">{String(p.rang).padStart(2, "0")}</span>
                  <span className="qui"><b>{nomLisible(p.nom)}</b><small>{[direVille(p.ville ?? undefined), p.effectif].filter(Boolean).join(" · ")}</small></span>
                  <span className="piste" role="img" aria-label={etape ? `Étape ${etape} sur 6 : ${PISTE[etape - 1]}` : "Message en préparation"}>
                    {PISTE.map((nom, i) => <i key={nom} className={i < etape - 1 ? "fait" : i === etape - 1 ? "ici" : ""} />)}
                  </span>
                  <span className="ou-piste">
                    {direEtape(p)}{attente ? " · à vérifier" : ""}
                    {p.statut === "identifie" && <Exclusion jeton={jeton} siren={p.siren} exclu={false} />}
                  </span>
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
                          <small>{e.de === "repreneur" ? nomLisible(p.nom) : "Shlomo, pour vous"} · {date(e.le)}</small>
                          <p>{e.texte}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {b && b.pourquoiVous.length > 0 ? (
                    <div className="brief"><section><h3>Pourquoi vous l'intéressez</h3><ul>{b.pourquoiVous.map((x) => <li key={x}>{x}</li>)}</ul></section></div>
                  ) : (
                    <p className="source">{p.raisons.join(" · ")}</p>
                  )}

                  {b && (
                    <details className="pli">
                      <summary>Sa fiche complète : qui il est, ce qu'il vous demandera, comment préparer la rencontre</summary>
                      <div className="brief">
                        {b.quiIlEst.length > 0 && <section><h3>Qui il est, d'après ses comptes</h3><ul className="serre">{b.quiIlEst.map((x) => <li key={x}>{x}</li>)}</ul></section>}
                        {(p.signaux?.length ?? 0) > 0 && (
                          <section><h3>Ce que le web dit de lui</h3>
                            {p.signaux!.map((x) => <small key={x.source + x.texte} className={x.genre === "alerte" ? "signal alerte" : "signal"}>{x.genre === "alerte" ? "À vérifier : " : ""}{x.texte} <a href={x.source} target="_blank" rel="noreferrer nofollow">source</a></small>)}
                          </section>
                        )}
                        {b.questions.length > 0 && <section><h3>Ce qu'il vous demandera</h3><ul>{b.questions.map((x) => <li key={x}>{x}</li>)}</ul></section>}
                        {b.aborder.length > 0 && <section><h3>Pour préparer la rencontre</h3><ul>{b.aborder.map((x) => <li key={x}>{x}</li>)}</ul></section>}
                        {b.comparables && <section><h3>Ce que des fonds comparables se sont vendus</h3><p className="mention">{b.comparables}</p></section>}
                        <p className="mention">Les chiffres viennent des comptes publiés. Les raisons, les questions et les conseils sont une analyse rédigée par une intelligence artificielle : à vérifier avec lui, pas à prendre pour acquis.</p>
                      </div>
                    </details>
                  )}
                  {p.message && (
                    <details className="pli">
                      <summary>Premier message{p.decideur ? `, adressé à ${p.decideur}` : ""}</summary>
                      <p className="lettre">{p.message}</p>
                    </details>
                  )}
                  <p className="source">
                    <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${p.siren}`} target="_blank" rel="noreferrer">Fiche publique</a>
                    {p.score ? ` · Note ${p.score} sur 100` : ""}
                  </p>
                </div>
              </details>
            );
          })}
          {sortis.length > 0 && (
            <ul className="sortis">
              {sortis.map((p) => (
                <li key={p.siren}>
                  <span>{nomLisible(p.nom)}</span>
                  <small>{p.exclu ? "retiré à votre demande" : p.canal === "refus_demarchage" ? "a demandé à ne pas être démarché" : "sans suite"}</small>
                  {p.exclu && p.statut === "identifie" && <Exclusion jeton={jeton} siren={p.siren} exclu />}
                </li>
              ))}
            </ul>
          )}
        </section>

        {autorise && (
          <section className="reglages">
            <h2>Votre dossier</h2>
            <details className="reglage" open={!suivi.fourchette && enCourse.some((p) => etapeDe(p) >= 3)}>
              <summary><span>Prix annoncé</span><b className={suivi.fourchette ? "" : "manque"}>{suivi.fourchette ? "Fixé" : "À fixer"}</b></summary>
              <Prix jeton={jeton} validee={suivi.fourchette ?? null} repere={repere} />
            </details>
            <details className="reglage">
              <summary><span>Documents</span><b>{(suivi.documents ?? []).length || "Aucun"}</b></summary>
              <Documents jeton={jeton} documents={suivi.documents ?? []} />
            </details>
            <details className="reglage">
              <summary><span>Disponibilités</span><b>{(suivi.creneaux ?? []).length ? `${(suivi.creneaux ?? []).length} créneau${(suivi.creneaux ?? []).length > 1 ? "x" : ""}` : "Aucune"}</b></summary>
              <Creneaux jeton={jeton} creneaux={suivi.creneaux ?? []} pris={rdvPris} />
            </details>
          </section>
        )}

        <section className="interlocuteur">
          <h2>Votre interlocuteur</h2>
          <div className="personne">
            <p><b>{CONTACT.nom}</b><span>{CONTACT.role}</span></p>
            {(CONTACT.telephone || CONTACT.courriel) && (
              <p className="joindre">
                {CONTACT.telephone && <a href={`tel:${CONTACT.telephone.replace(/[^+\d]/g, "")}`}>{CONTACT.telephone}</a>}
                {CONTACT.courriel && <a href={`mailto:${CONTACT.courriel}`}>{CONTACT.courriel}</a>}
              </p>
            )}
          </div>
          <p className="mention">Shlomo est une intelligence artificielle ; une personne relit son travail et répond de ce qu'elle fait.</p>
          <p className="mention"><b>Rien à payer avant la vente.</b> La commission est de 5 % du prix, avec un minimum de 5 000 €, seulement si la vente se fait avec un repreneur présenté par Shlomo.</p>
          <p className="mention">
            <a href={`mailto:?subject=${encodeURIComponent("Cession de ma société avec Shlomo.ai")}&body=${encodeURIComponent(`Bonjour,\n\nJ'ai confié à Shlomo.ai la recherche d'un repreneur pour ma société. Cette page explique leur méthode, ce qu'ils font et ce qui reste de votre ressort :\n${origine}/expert-comptable\n\nJ'aimerais votre avis.\n`)}`}>En parler à mon expert-comptable</a>
            {" · "}<a href="/expert-comptable" target="_blank" rel="noreferrer">Voir la page qui lui est destinée</a>
          </p>
        </section>

        <section className="journal-agents">
          <h2>Journal</h2>
          <ol>
            {suivi.evenements.slice(0, 6).map((e, i) => <li key={i}><time>{heure(e.cree_le)}</time><span>{e.texte}</span></li>)}
          </ol>
          {suivi.evenements.length > 6 && (
            <details className="pli">
              <summary>Les {suivi.evenements.length - 6} lignes précédentes</summary>
              <ol>{suivi.evenements.slice(6).map((e, i) => <li key={i}><time>{heure(e.cree_le)}</time><span>{e.texte}</span></li>)}</ol>
            </details>
          )}
        </section>

        <footer className="pied-console">
          <p>
            {suivi.mandat ? `Mandat de test${suivi.mandat.numero ? ` n° ${String(suivi.mandat.numero).padStart(4, "0")}` : ""}, sans valeur juridique, signé par ${suivi.mandat.signataire} le ${date(suivi.mandat.signe_le)}${suivi.mandat.echeance ? `, valable jusqu'au ${new Date(suivi.mandat.echeance).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}` : ""}. ` : ""}
            {autorise ? "Chaque message est relu par l'équipe Shlomo avant envoi. Vous seul décidez de donner votre nom et de répondre à une offre." : "Pour lancer l'approche, il faudra signer un mandat qui l'autorise."}
          </p>
          <p>
            {autorise && <a href={`/atelier?d=${jeton}`}>Voir Shlomo préparer les messages</a>}
            {autorise && suivi.jeton_fiche && <> · <a href={`/fiche?f=${suivi.jeton_fiche}`} target="_blank" rel="noreferrer">Présentation anonyme remise aux repreneurs</a></>}
            {" · "}Gardez l'adresse de cette page : c'est votre accès.
          </p>
        </footer>
      </main>
    </div>
  );
}
