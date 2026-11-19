import type { Metadata } from "next";
import { headers } from "next/headers";
import { lireEnvois, lirePosteDossier } from "@/lib/base";
import { composerPremier, lienCourt } from "@/lib/envoi";
import { direVille, nomLisible } from "@/lib/lieu";
import { chercherSociete } from "@/lib/registre";
import Imprimer from "./Imprimer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lettre — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * La lettre papier d'un repreneur, réservée aux fondateurs : le message préparé et relu, avec le lien court vers la page écrite pour lui.
 * Elle s'imprime ou s'enregistre en PDF depuis le navigateur. Rien n'est posté d'ici.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string; d?: string; s?: string }> }) {
  const { c: code = "", d: dossier = "", s: siren = "" } = await searchParams;
  const [d, envois] = await Promise.all([lirePosteDossier(code, dossier).catch(() => null), lireEnvois(code, dossier).catch(() => null)]);
  const p = d?.presentations.find((x) => x.siren === siren && !x.exclu && x.canal === "a_envoyer");
  const e = envois?.[siren];
  if (!d || !p || !e || !p.message) return <main className="lettre-papier"><p>Lettre introuvable : code de pilotage faux, ou aucun message prêt pour ce repreneur.</p></main>;

  const entetes = await headers();
  const origine = `${entetes.get("x-forwarded-proto") ?? "https"}://${entetes.get("host") ?? "shlomo-ai.vercel.app"}`;
  const lien = lienCourt(origine, e.code_court);
  // Le même texte que le courriel, sans la ligne de désinscription propre au courriel.
  const texte = composerPremier(p.message, lien).texte.replace(/\n\nPour ne plus recevoir[^\n]*$/, "").replace(/ ?Pour ne plus être contacté, répondez STOP[^\n]*/i, "");
  const societe = await chercherSociete(siren).catch(() => null);
  const aujourdhui = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

  return (
    <main className="lettre-papier">
      <Imprimer />
      <header>
        <p className="expediteur"><b>Shlomo.ai</b></p>
        <p className="destinataire">
          {p.decideur && <>{p.decideur}<br /></>}
          {nomLisible(p.nom)}<br />
          {societe?.adresse ? <>{societe.adresse}</> : direVille(p.ville ?? undefined)}
        </p>
        <p className="date">Le {aujourdhui}</p>
      </header>
      <p className="objet">Objet : une société à reprendre dans votre métier. Confidentiel.</p>
      <div className="texte">{texte}</div>
      {process.env.CONTACT_COURRIEL && <footer>Si vous ne souhaitez plus recevoir de courrier de notre part, écrivez à {process.env.CONTACT_COURRIEL} : nous ne vous écrirons plus.</footer>}
    </main>
  );
}
