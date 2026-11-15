import type { Metadata } from "next";
import { lireAccord } from "@/lib/base";
import { REGIONS } from "@/lib/fiche";
import Signer from "./Signer";

export const dynamic = "force-dynamic";
// L'adresse contient le jeton propre à ce repreneur : ni indexation, ni fuite vers d'autres sites.
export const metadata: Metadata = { title: "Accord de confidentialité — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

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
                <h1>{a.cedant ? "Voici la société à céder." : a.accord ? "Accord signé." : "Un accord, puis le nom."}</h1>
                <p className="sous">
                  {a.cedant
                    ? "Vous avez signé l'accord de confidentialité et le cédant a donné son feu vert."
                    : a.accord
                      ? a.revelation === "refusee"
                        ? "Le cédant n'a pas souhaité que son nom vous soit communiqué. L'équipe Shlomo revient vers vous."
                        : "Le cédant est prévenu. Son nom s'affichera sur cette page dès qu'il aura donné son feu vert : gardez cette adresse."
                      : "Une page, quatre articles. Le cédant ne se nomme qu'auprès des repreneurs qui s'engagent à la discrétion."}
                </p>
              </div>

              {a.cedant && (
                <div className="carte apparait">
                  <p className="source">Société à céder</p>
                  <p className="message"><b style={{ fontSize: 22 }}>{a.cedant.nom}</b></p>
                  <p className="message">{[a.cedant.ville, `SIREN ${a.cedant.siren}`].filter(Boolean).join(" · ")}</p>
                  <div className="actions">
                    <a className="lien" href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${a.cedant.siren}`} target="_blank" rel="noreferrer">Fiche publique</a>
                    {a.cedant.site && <a className="lien" href={a.cedant.site.startsWith("http") ? a.cedant.site : `https://${a.cedant.site}`} target="_blank" rel="noreferrer">Site</a>}
                  </div>
                  <p className="source">Ces informations sont couvertes par l'accord que vous avez signé. L'équipe Shlomo vous propose un rendez-vous avec le cédant.</p>
                </div>
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
