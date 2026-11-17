import type { Metadata } from "next";
import { lirePoste } from "@/lib/base";
import { REGIONS } from "@/lib/fiche";
import { RegistreIndisponible } from "@/lib/registre";
import { AGE_DE_TRANSMISSION, chercherVendeursProbables, type VendeurProbable } from "@/lib/vendeurs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendeurs probables — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

const TAILLES: [string, string, string[]][] = [
  ["petites", "6 à 19 salariés", ["03", "11"]],
  ["moyennes", "10 à 49 salariés", ["11", "12"]],
  ["grandes", "20 à 99 salariés", ["12", "21"]],
];

/** Liste de travail des fondateurs : qui approcher en premier, dans un métier et une région. Rien n'est envoyé d'ici. */
export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string; naf?: string; region?: string; taille?: string }> }) {
  const p = await searchParams;
  const code = p.c ?? "";
  if ((await lirePoste(code).catch(() => null)) === null) {
    return (
      <div className="page epure">
        <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
        <main className="colonne"><div><h1>Accès refusé.</h1><p className="sous">Cette page demande le code de pilotage.</p></div></main>
      </div>
    );
  }

  const naf = /^\d{2}\.\d{2}[A-Z]$/.test((p.naf ?? "").trim().toUpperCase()) ? (p.naf as string).trim().toUpperCase() : "";
  const region = p.region && REGIONS[p.region] ? p.region : "84";
  const taille = TAILLES.find(([id]) => id === p.taille) ?? TAILLES[1];

  let resultat: { vendeurs: VendeurProbable[]; lues: number; total: number } | null = null;
  let panne = false;
  if (naf) {
    try {
      resultat = await chercherVendeursProbables({ codeActivite: naf, region, tranches: taille[2] });
    } catch (e) {
      if (!(e instanceof RegistreIndisponible)) throw e;
      panne = true;
    }
  }
  const fortes = resultat?.vendeurs.filter((v) => v.priorite === "forte").length ?? 0;
  const annee = new Date().getFullYear();

  return (
    <div className="page epure">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a><span className="repere">Vendeurs probables</span></header>
      <main className="colonne">
        <div>
          <h1>{resultat ? `${resultat.vendeurs.length} vendeurs probables, dont ${fortes} sans relève visible.` : "Qui approcher en premier."}</h1>
          <p className="sous">
            Des sociétés dont un dirigeant a plus de {AGE_DE_TRANSMISSION} ans, d'après le registre public. C'est un indice, pas une intention de vendre. Celles qui ont demandé à ne pas être démarchées n'apparaissent pas. Rien n'est envoyé d'ici : l'envoi attend l'avis de l'avocat sur la prospection.
          </p>
        </div>

        <form className="filtres" method="get">
          <input type="hidden" name="c" value={code} />
          <label>Code d'activité<input name="naf" defaultValue={naf} placeholder="43.32A" required pattern="\d{2}\.\d{2}[A-Za-z]" /></label>
          <label>Région<select name="region" defaultValue={region}>{Object.entries(REGIONS).map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}</select></label>
          <label>Taille<select name="taille" defaultValue={taille[0]}>{TAILLES.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}</select></label>
          <button className="bouton petit" type="submit">Chercher</button>
        </form>

        {panne && <p className="message">Le registre des entreprises ne répond pas. Réessayez dans un instant.</p>}

        {resultat && (
          <>
            <p className="bilan">
              <b>{resultat.total}</b> sociétés du registre ont un dirigeant de plus de {AGE_DE_TRANSMISSION} ans sous ce code, dans cette région et à cette taille ; <b>{resultat.lues}</b> lues, <b>{resultat.vendeurs.length}</b> retenues.
            </p>
            <div className="flux">
              {resultat.vendeurs.map((v) => (
                <div key={v.societe.siren} className="flux-ligne">
                  <span className="quoi">
                    <b>{v.societe.nom}</b>
                    <small>{[v.societe.ville, v.societe.effectif, v.societe.formeJuridique, `SIREN ${v.societe.siren}`].filter(Boolean).join(" · ")}</small>
                    <small>{v.dirigeants.map((d) => `${d.nom}, ${d.qualite.toLowerCase()}, ${annee - d.naissance} ans environ`).join(" · ")}</small>
                    <small>{v.indices.slice(1).join(" · ")}</small>
                  </span>
                  <span className="ou"><a href={`/dossier?q=${v.societe.siren}`} target="_blank" rel="noreferrer">Préparer son rapport</a></span>
                  <span className="note mot">{v.priorite === "forte" ? "Forte" : "Moyenne"}</span>
                </div>
              ))}
            </div>
            {resultat.vendeurs.length === 0 && <p className="message">Aucune société retenue avec ces critères. Essayez une autre taille ou une autre région.</p>}
          </>
        )}
      </main>
    </div>
  );
}
