import type { Metadata } from "next";
import { lireEntonnoir, type Etape } from "@/lib/base";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pilotage — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

const VENDEUR: [Etape, string][] = [
  ["fiche_vue", "Fiche de la société affichée"],
  ["repreneurs_vus", "Repreneurs masqués vus"],
  ["mandat_ouvert", "Page du mandat ouverte"],
  ["mandat_signe", "Mandat signé"],
  ["approches_pretes", "Approches préparées"],
];
const REPRENEUR: [Etape, string][] = [
  ["presentation_ouverte", "Présentation anonyme ouverte"],
  ["interet", "Demande d'en savoir plus"],
];

function Etapes({ titre, etapes, chiffres }: { titre: string; etapes: [Etape, string][]; chiffres: Partial<Record<Etape, number>> }) {
  const premier = chiffres[etapes[0][0]] ?? 0;
  return (
    <div className="carte">
      <p className="source">{titre}</p>
      <dl className="fiche">
        {etapes.map(([cle, libelle], i) => {
          const n = chiffres[cle] ?? 0;
          const avant = i > 0 ? (chiffres[etapes[i - 1][0]] ?? 0) : 0;
          return (
            <div key={cle}>
              <dt>{libelle}</dt>
              <dd>
                {n}
                {i > 0 && avant > 0 && <small className="part"> · {Math.round((n / avant) * 100)} % de l'étape précédente</small>}
                {i > 0 && premier > 0 && i === etapes.length - 1 && <small className="part"> · {Math.round((n / premier) * 100)} % du départ</small>}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** Tableau de bord des fondateurs. L'adresse contient le code de pilotage : ne la partagez pas. */
export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const code = (await searchParams).c ?? "";
  const chiffres = await lireEntonnoir(code).catch(() => null);
  return (
    <div className="page">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul">
        <main className="resultat">
          {!chiffres ? (
            <><h1>Accès refusé.</h1><p className="sous">Cette page demande le code de pilotage.</p></>
          ) : (
            <>
              <div>
                <h1>Où le parcours perd du monde.</h1>
                <p className="sous">Nombre de dossiers ayant atteint chaque étape sur les trente derniers jours. Un même dossier compte une fois par jour et par étape ; les essais internes sont inclus.</p>
              </div>
              <Etapes titre="Côté vendeur" etapes={VENDEUR} chiffres={chiffres} />
              <Etapes titre="Côté repreneur" etapes={REPRENEUR} chiffres={chiffres} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
