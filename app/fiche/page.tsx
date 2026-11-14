import type { Metadata } from "next";
import { lireFiche, mesurer } from "@/lib/base";
import { lignesFiche } from "@/lib/fiche";
import Demande from "./Demande";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Société à céder, présentation anonyme — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Présentation anonyme remise aux repreneurs : aucun nom, aucun SIREN, aucune ville. */
export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const jeton = (await searchParams).f ?? "";
  const fiche = await lireFiche(jeton).catch(() => null);
  if (fiche) await mesurer("presentation_ouverte", jeton);

  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
      </header>
      <div className="corps seul">
        <main className="resultat">
          {!fiche ? (
            <>
              <h1>Cette présentation n'est pas disponible.</h1>
              <p className="sous">Le lien est incomplet, ou la société n'est plus à céder.</p>
            </>
          ) : (
            <>
              <div>
                <h1>Une société est à céder.</h1>
                <p className="sous">Présentation anonyme, à l'attention des repreneurs contactés par Shlomo. Le nom vous sera communiqué après un accord de confidentialité.</p>
              </div>
              {fiche.presentation && (
                <div className="carte">
                  <p className="source">La société, en quelques lignes</p>
                  <p className="lettre" style={{ minHeight: 0 }}>{fiche.presentation}</p>
                </div>
              )}
              <div className="carte">
                <dl className="fiche">
                  {lignesFiche(fiche).map((l) => (
                    <div key={l.libelle}><dt>{l.libelle}</dt><dd>{l.valeur}</dd></div>
                  ))}
                </dl>
                <p className="source">Chiffres tirés des comptes publiés, arrondis pour préserver l'anonymat du cédant.</p>
              </div>
              <Demande jeton={jeton} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
