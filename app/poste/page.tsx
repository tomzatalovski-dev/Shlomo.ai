import type { Metadata } from "next";
import { lireActes, lirePoste, lirePosteDossier, type Acte, type RepreneurPoste, type StatutPresentation } from "@/lib/base";
import { direCreneau, euros } from "@/lib/creneaux";
import { VERSION } from "@/lib/negociation/manuel";
import { ETAPES } from "@/lib/negociation/poste";
import Demande, { Essai } from "./Demande";
import Fil from "./Fil";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Poste de négociation — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
const ORDRE = new Map<StatutPresentation, number>(ETAPES.map(([s], i) => [s, i]));

/** D'abord ce qui attend une action, puis les repreneurs les plus avancés, puis le classement. Les « sans suite » ferment la marche. */
function poids(p: RepreneurPoste): number {
  if (p.echanges.some((e) => e.etat === "propose")) return -100;
  if (p.statut === "sans_suite" || p.canal === "refus_demarchage") return 100;
  return -(ORDRE.get(p.statut) ?? 0);
}

const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Paris" });

/** Un acte du journal, dit en clair. Le détail vient de la base, tel qu'elle l'a enregistré au moment de l'acte. */
function direActe(a: Acte): string {
  const d = a.detail as Record<string, string | number | boolean | null | undefined>;
  const qui = a.repreneur ?? "un repreneur";
  switch (a.acte) {
    case "mandat_signe": return `Mandat signé par ${d.signataire} (version ${d.version}${d.autorisation_approche ? ", approche autorisée" : ""})`;
    case "accord_signe": return `Accord de confidentialité signé par ${d.signataire}${d.qualite ? `, ${d.qualite}` : ""}, pour ${qui}`;
    case "nom_autorisee": return `Le vendeur a autorisé la communication de son nom à ${qui}`;
    case "nom_refusee": return `Le vendeur a refusé que son nom soit communiqué à ${qui}`;
    case "fourchette_validee": return `Le vendeur a validé sa fourchette : ${euros(Number(d.bas))} à ${euros(Number(d.haut))}`;
    case "rendez_vous_choisi": return d.creneau ? `${qui} a choisi le rendez-vous du ${direCreneau(String(d.creneau))}` : `Rendez-vous retiré pour ${qui}`;
    case "offre_deposee": return `${qui} a déposé une offre de ${euros(Number(d.prix))}`;
    case "offre_acceptee": return `Le vendeur a accepté l'offre de ${euros(Number(d.prix))} de ${qui}`;
    case "offre_refusee": return `Le vendeur a refusé l'offre de ${euros(Number(d.prix))} de ${qui}`;
    case "offre_a_ameliorer": return `Le vendeur a demandé à ${qui} d'améliorer son offre de ${euros(Number(d.prix))}`;
    case "repreneur_raye": return `Le vendeur a rayé ${qui} de la liste`;
    case "repreneur_retabli": return `Le vendeur a rétabli ${qui} dans la liste`;
    default: return a.acte;
  }
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul banc"><main className="resultat">{children}</main></div>
    </div>
  );
}

/** Poste de négociation des fondateurs. L'adresse contient le code de pilotage : ne la partagez pas. */
export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string; d?: string }> }) {
  const { c: code = "", d: choisi } = await searchParams;

  if (choisi) {
    const d = await lirePosteDossier(code, choisi).catch(() => null);
    if (!d) return <Cadre><h1>Dossier introuvable.</h1><p className="sous">Le code de pilotage est faux, ou ce dossier n'autorise pas l'approche.</p></Cadre>;
    const actifs = d.presentations.filter((p) => !p.exclu).sort((a, b) => poids(a) - poids(b) || a.rang - b.rang);
    const compte = (statuts: StatutPresentation[]) => actifs.filter((p) => statuts.includes(p.statut)).length;
    const libres = d.interets.filter((i) => !i.siren);
    const [actes, liste] = await Promise.all([lireActes(code, choisi).catch(() => null), lirePoste(code).catch(() => null)]);
    const essai = liste?.find((x) => x.id === d.id)?.essai ?? false;
    return (
      <Cadre>
        <div>
          <p className="source"><a href={`/poste?c=${code}`}>← Tous les dossiers</a></p>
          <h1>{d.nom}</h1>
          <p className="sous">
            {[d.fiche?.activite, d.fiche?.ville, d.fiche?.effectif].filter(Boolean).join(" · ")}. Le négociateur propose, vous envoyez : rien ne part de cette page.
            {d.fourchette ? ` Fourchette validée par le vendeur : ${d.fourchette.bas.toLocaleString("fr-FR")} € à ${d.fourchette.haut.toLocaleString("fr-FR")} €.` : " Aucun prix n'est validé par le vendeur, il n'en annoncera donc aucun."}
          </p>
          <div className="actions">
            <a className="lien" href={`/suivi?d=${d.jeton}`} target="_blank" rel="noreferrer">Suivi vu par le vendeur</a>
            <a className="lien" href={`/fiche?f=${d.jeton_fiche}`} target="_blank" rel="noreferrer">Présentation anonyme</a>
            <Essai code={code} dossier={d.id} essai={essai} />
          </div>
        </div>

        <div className="entonnoir">
          <div className="chiffre"><span>Repreneurs</span><b>{actifs.length}</b></div>
          <div className="chiffre"><span>Contactés</span><b>{actifs.filter((p) => p.statut !== "identifie").length}</b></div>
          <div className="chiffre"><span>Ont répondu</span><b>{actifs.filter((p) => !["identifie", "contacte", "relance"].includes(p.statut)).length}</b></div>
          <div className="chiffre"><span>Intéressés</span><b>{compte(["interesse", "confidentialite_signee", "rendez_vous", "offre", "conclu"])}</b></div>
          <div className="chiffre cle"><span>Rendez-vous et offres</span><b>{compte(["rendez_vous", "offre", "conclu"])}</b></div>
        </div>

        {d.interets.length > 0 && (
          <div className="carte">
            <p className="source">Demandes venues de la présentation anonyme · ces coordonnées ne sont jamais montrées au vendeur</p>
            {d.interets.map((i) => (
              <div key={i.id} className="ligne">
                <span className="quoi"><b>{i.nom}{i.societe ? ` · ${i.societe}` : ""}</b><small>{i.contact} · {jour(i.cree_le)}</small></span>
                <span className="ou">
                  {i.siren ? `Relié à ${d.presentations.find((p) => p.siren === i.siren)?.nom ?? i.siren}` : <Demande code={code} dossier={d.id} interet={i.id} repreneurs={actifs.map((p) => ({ siren: p.siren, nom: p.nom }))} />}
                </span>
              </div>
            ))}
            {libres.length > 0 && <p className="source">Relier une demande au repreneur fait passer celui-ci à « Intéressé » dans le suivi du vendeur.</p>}
          </div>
        )}

        <div className="carte">
          <p className="source">Conversations · manuel v{VERSION}</p>
          {actifs.map((p, i) => <Fil key={p.siren} code={code} dossier={d.id} repreneur={p} etapes={ETAPES} ouvert={p.echanges.some((e) => e.etat === "propose") || (i === 0 && p.echanges.length > 0)} />)}
        </div>

        {actes && actes.length > 0 && (
          <div className="carte">
            <p className="source">Journal des actes · écrit par la base à l'instant de chaque acte, sans intervention du site ni de l'équipe</p>
            <div>
              {actes.map((x) => (
                <div key={x.id} className="ligne">
                  <span className="quoi"><b style={{ fontWeight: 500 }}>{direActe(x)}</b><small>{quand(x.cree_le)}</small></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Cadre>
    );
  }

  const dossiers = await lirePoste(code).catch(() => null);
  if (!dossiers) return <Cadre><h1>Accès refusé.</h1><p className="sous">Cette page demande le code de pilotage.</p></Cadre>;

  return (
    <Cadre>
      <div>
        <h1>Poste de négociation.</h1>
        <p className="sous">Un dossier par vendeur, une ligne par repreneur. Collez une réponse reçue : le négociateur la lit, la classe et propose la suite. Vous envoyez, puis vous le notez ; le suivi du vendeur se met à jour seul.</p>
        <div className="actions">
          <a className="lien" href={`/banc?c=${code}`}>Banc d'essai du négociateur</a>
          <a className="lien" href={`/pilotage?c=${code}`}>Pilotage</a>
        </div>
      </div>
      <div className="carte tableau-carte">
        <table className="tableau">
          <thead><tr><th>Dossier</th><th>Messages prêts</th><th>Contactés</th><th>Réponses</th><th>Intéressés</th><th>À traiter</th></tr></thead>
          <tbody>
            {dossiers.map((d) => (
              <tr key={d.id}>
                <td><a href={`/poste?c=${code}&d=${d.id}`}><b>{d.nom}</b></a>{d.essai && <span className="essai" style={{ marginLeft: 8 }}>Essai</span>}<br /><small>Signé par {d.signataire} le {jour(d.signe_le)}</small></td>
                <td>{d.prets}</td>
                <td>{d.contactes}</td>
                <td>{d.reponses}</td>
                <td>{d.interesses}</td>
                <td style={d.a_envoyer + d.demandes > 0 ? { color: "var(--ambre)", fontWeight: 600 } : undefined}>{d.a_envoyer + d.demandes > 0 ? `${d.a_envoyer} réponse${d.a_envoyer > 1 ? "s" : ""} · ${d.demandes} demande${d.demandes > 1 ? "s" : ""}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {dossiers.length === 0 && <p className="source">Aucun mandat n'autorise encore l'approche.</p>}
      </div>
    </Cadre>
  );
}
