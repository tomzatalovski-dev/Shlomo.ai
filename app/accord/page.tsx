import type { Metadata } from "next";
import { lireAccord, lireBriefingRepreneur } from "@/lib/base";
import { REGIONS } from "@/lib/fiche";
import Signer from "./Signer";
import { Creneau, DeposerOffre } from "./Suite";
import { direCreneau, euros, poids } from "@/lib/creneaux";

export const dynamic = "force-dynamic";
// L'adresse contient le jeton propre à ce repreneur : ni indexation, ni fuite vers d'autres sites.
export const metadata: Metadata = { title: "Une société à reprendre — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

const ARTICLES = [
  { titre: "Objet", texte: "Shlomo.ai vous communique des informations sur une société à céder, à commencer par son nom, afin que vous puissiez étudier son rachat. Ces informations ne servent à rien d'autre." },
  { titre: "Confidentialité", texte: "Vous ne révélez à personne que cette société est à céder, ni les informations reçues, sauf à vos conseils tenus au même secret. Cet engagement dure deux ans." },
  { titre: "Pas de contact direct", texte: "Vous ne contactez ni le cédant, ni ses salariés, ni ses clients, ni ses fournisseurs au sujet de la cession sans passer par Shlomo.ai." },
  { titre: "Si vous ne donnez pas suite", texte: "Vous détruisez les documents reçus et vous n'utilisez pas les informations contre la société, notamment pour démarcher ses clients ou recruter ses salariés." },
];

const date = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Accord de confidentialité d'un repreneur. Le nom du cédant ne s'affiche qu'après signature et feu vert du cédant. */
export default async function Page({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const jeton = (await searchParams).a ?? "";
  const a = await lireAccord(jeton).catch(() => null);
  // Le briefing écrit pour ce repreneur : anonyme, lisible avant toute signature.
  const b = a ? await lireBriefingRepreneur(jeton).catch(() => null) : null;
  const brief = b && (b.pourquoiVous?.length || b.societe?.length) ? b : null;
  const cession = a ? [a.cession.activite, REGIONS[a.cession.region ?? ""], a.cession.effectif].filter(Boolean).join(" · ") : "";

  return (
    <div className="page">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul contrat-page">
        <main className="resultat">
          {!a ? (
            <><h1>Cet accord n'est pas disponible.</h1><p className="sous">Le lien est incomplet, ou la société n'est plus à céder.</p></>
          ) : (
            <>
              <div>
                <h1>{a.cedant ? "Voici la société à céder." : a.accord ? "Accord signé." : brief ? "Une société à reprendre, choisie pour vous." : "Un accord, puis le nom."}</h1>
                <p className="sous">
                  {a.cedant
                    ? "Vous avez signé l'accord de confidentialité et le cédant a donné son feu vert."
                    : a.accord
                      ? a.revelation === "refusee"
                        ? "Le cédant n'a pas souhaité que son nom vous soit communiqué. L'équipe Shlomo revient vers vous."
                        : "Le cédant est prévenu. Son nom s'affichera sur cette page dès qu'il aura donné son feu vert : gardez cette adresse."
                      : brief
                        ? brief.accroche || "Shlomo a comparé cette société à celles qui pourraient la reprendre. Voici pourquoi la vôtre est sur la liste."
                        : "Une page, quatre articles. Le cédant ne se nomme qu'auprès des repreneurs qui s'engagent à la discrétion."}
                </p>
              </div>

              {brief && !a.cedant && (
                <div className="carte brief apparait">
                  {brief.pourquoiVous.length > 0 && (
                    <section><h3>Pourquoi vous</h3><ul>{brief.pourquoiVous.map((x) => <li key={x}>{x}</li>)}</ul></section>
                  )}
                  {brief.societe.length > 0 && (
                    <section><h3>La société, sans son nom</h3><ul className="serre">{brief.societe.map((x) => <li key={x}>{x}</li>)}</ul></section>
                  )}
                  {brief.rapprochement.length > 0 && (
                    <section><h3>Ce que le rachat donnerait</h3><ul>{brief.rapprochement.map((x) => <li key={x}>{x}</li>)}</ul></section>
                  )}
                  {brief.comparables && <section><h3>Ce que des fonds comparables se sont vendus</h3><p className="mention">{brief.comparables}</p></section>}
                  <p className="mention">
                    Shlomo.ai agit pour le compte du cédant. Les chiffres viennent des comptes publiés et sont arrondis ; les raisons sont une analyse rédigée par une intelligence artificielle à partir de sources publiques, pas un conseil d'achat.
                    {a.accord ? "" : " Le nom de la société vous est communiqué après signature de l'accord ci-dessous et feu vert du cédant."}
                  </p>
                </div>
              )}

              {a.cedant && (
                <div className="carte apparait">
                  <p className="source">Société à céder</p>
                  <p className="message"><b style={{ fontSize: 22 }}>{a.cedant.nom}</b></p>
                  <p className="message">{[a.cedant.ville, `SIREN ${a.cedant.siren}`].filter(Boolean).join(" · ")}</p>
                  <div className="actions">
                    <a className="lien" href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${a.cedant.siren}`} target="_blank" rel="noreferrer">Fiche publique</a>
                    {a.cedant.site && <a className="lien" href={a.cedant.site.startsWith("http") ? a.cedant.site : `https://${a.cedant.site}`} target="_blank" rel="noreferrer">Site</a>}
                  </div>
                  <p className="source">Ces informations sont couvertes par l'accord que vous avez signé.</p>
                </div>
              )}

              {a.cedant && a.dossier && (
                <>
                  <div className="carte">
                    <p className="message"><b>Le dossier.</b>{a.dossier.fourchette ? ` Prix annoncé par le cédant : ${euros(a.dossier.fourchette.bas)} à ${euros(a.dossier.fourchette.haut)}.` : " Le cédant n'a pas encore annoncé de prix."}</p>
                    {a.dossier.documents.length > 0 ? (
                      <div>
                        {a.dossier.documents.map((d) => (
                          <div key={d.id} className="ligne">
                            <span className="quoi"><b><a href={`/api/document?a=${jeton}&id=${d.id}`}>{d.nom}</a></b><small>{poids(d.taille)}</small></span>
                            <span className="ou"><a className="lien" href={`/api/document?a=${jeton}&id=${d.id}`}>Télécharger</a></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="source">Le cédant n'a pas encore déposé de documents. Ils apparaîtront ici.</p>
                    )}
                    <p className="source">Chaque téléchargement est signalé au cédant. Ces documents sont couverts par l'accord que vous avez signé.</p>
                  </div>

                  <div className="carte">
                    {a.dossier.rendez_vous ? (
                      <p className="message"><b>Rendez-vous avec le cédant : {direCreneau(a.dossier.rendez_vous)}.</b> L'équipe Shlomo vous confirme le lieu ou le lien de visioconférence.</p>
                    ) : a.dossier.creneaux.length > 0 ? (
                      <>
                        <p className="message"><b>Rencontrer le cédant.</b> Choisissez l'une de ses disponibilités.</p>
                        <Creneau jeton={jeton} creneaux={a.dossier.creneaux} />
                      </>
                    ) : (
                      <p className="message"><b>Rencontrer le cédant.</b> Il n'a pas encore indiqué ses disponibilités : l'équipe Shlomo revient vers vous.</p>
                    )}
                  </div>

                  <div className="carte">
                    <p className="message"><b>Votre offre.</b> Quand vous êtes prêt, déposez un prix et vos conditions.</p>
                    {a.dossier.offres.map((o) => (
                      <div key={o.id} className="ligne">
                        <span className="quoi"><b>{euros(o.prix)}</b><small>{[o.financement, o.calendrier, o.conditions].filter(Boolean).join(" · ")}</small></span>
                        <span className="ou"><b className={o.reponse === "acceptee" ? "etat fort" : "etat"}>{o.reponse === "acceptee" ? "Acceptée par le cédant" : o.reponse === "refusee" ? "Refusée par le cédant" : o.reponse === "a_ameliorer" ? "Le cédant attend mieux" : "En attente de sa réponse"}</b></span>
                      </div>
                    ))}
                    {!a.dossier.offres.some((o) => o.reponse === "acceptee") && <DeposerOffre jeton={jeton} deja={a.dossier.offres.length > 0} />}
                  </div>
                </>
              )}

              <article className="contrat">
                <header className="contrat-tete">
                  <div>
                    <p className="surtitre">Accord de confidentialité</p>
                    <p className="date">{a.accord ? `Signé le ${date(a.accord.signe_le)}` : cession}</p>
                  </div>
                  <span className="essai">Version d'essai, sans valeur juridique</span>
                </header>
                <div className="parties">
                  <div><span>Le repreneur</span><b>{a.repreneur}</b><small>{a.accord ? [a.accord.signataire, a.accord.qualite].filter(Boolean).join(", ") : "Représenté par le signataire"}</small></div>
                  <div><span>Pour le compte du cédant</span><b>Shlomo.ai</b><small>{a.cedant ? a.cedant.nom : "Société nommée après signature et accord du cédant"}</small></div>
                </div>
                <ol className="articles">
                  {ARTICLES.map((x, i) => (
                    <li key={x.titre}><span className="numero">Article {i + 1}</span><div><b>{x.titre}</b><p>{x.texte}</p></div></li>
                  ))}
                </ol>
                {a.accord ? (
                  <div className="paraphe rempli"><span className="trace-signature">{a.accord.signataire}</span><small>Signé électroniquement par {a.accord.signataire}, le {date(a.accord.signe_le)}</small></div>
                ) : (
                  <Signer jeton={jeton} decideur={a.decideur ?? ""} />
                )}
              </article>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
