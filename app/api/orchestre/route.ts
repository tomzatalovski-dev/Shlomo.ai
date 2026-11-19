import { BaseIndisponible, cleServeurValide, lireOrchestre, lirePoste, noterEnvoi } from "@/lib/base";
import { courrielActif, envoyer } from "@/lib/courriel";
import { composerRelance, destination, envoiReel, equipe, habillerEssai, lienCourt, relancesAuto } from "@/lib/envoi";
import { decider, estRelance, resumeDuJour, type AFaire } from "@/lib/orchestre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Le tour du chef d'orchestre. Appelé chaque matin par le planificateur de Vercel (en-tête `Authorization: Bearer CRON_SECRET`),
 * ou à la demande par un fondateur (`?c=` code de pilotage).
 * Il lit tous les dossiers avec la clé du serveur, envoie les relances là où c'est permis, et écrit à l'équipe ce qui attend quelqu'un.
 * Une relance ne part seule que sur un dossier d'essai (vers l'équipe), ou sur un dossier réel si `ENVOI_REEL` et `RELANCES_AUTO` valent « oui ».
 */
export async function GET(requete: Request) {
  const url = new URL(requete.url);
  const secret = process.env.CRON_SECRET;
  const parPlanificateur = Boolean(secret) && requete.headers.get("authorization") === `Bearer ${secret}`;
  const code = url.searchParams.get("c") ?? "";
  const cle = process.env.CLE_SERVEUR ?? "";
  try {
    if (!parPlanificateur && !(code && (await lirePoste(code)) !== null)) return Response.json({ erreur: "Accès refusé." }, { status: 401 });
    if (!cle || !(await cleServeurValide(cle))) return Response.json({ erreur: "La clé du serveur manque ou n'est pas la bonne." }, { status: 503 });
    const dossiers = (await lireOrchestre(cle)) ?? [];
    const aFaire = decider(dossiers);
    const faites: AFaire[] = [];
    const restantes: AFaire[] = [];
    const sec = url.searchParams.get("sec") === "1";

    for (const x of aFaire) {
      const d = dossiers.find((y) => y.id === x.dossier);
      const p = d?.presentations.find((y) => y.siren === x.siren);
      const seule = estRelance(x.action) && d && p && courrielActif() && !sec && (d.essai || (envoiReel() && relancesAuto()));
      if (!seule || !d || !p) { restantes.push(x); continue; }
      const dest = destination(d.essai, p.courriel);
      if ("refus" in dest) { restantes.push(d.essai ? x : { ...x, action: "saisir_adresse" }); continue; }
      const m = composerRelance(x.action === "relance_1" ? 1 : 2, { decideur: p.decideur, premierLe: p.premier_le, lien: lienCourt(url.origin, p.code_court) });
      const part = dest.essai ? habillerEssai(m, p.nom, p.courriel) : m;
      if ((await envoyer(dest.a, part.sujet, part.texte)) && (await noterEnvoi(cle, d.id, p.siren, { genre: "relance", destinataire: dest.a, essai: dest.essai, texte: m.texte }))) faites.push(x);
      else restantes.push(x);
    }

    // Le courriel du matin ne part que par le planificateur : un tour lancé à la main se lit à l'écran.
    const resume = resumeDuJour(faites, restantes, `${url.origin}/poste`);
    const ecrit = parPlanificateur && resume && equipe() ? await envoyer(equipe(), resume.sujet, resume.texte) : false;
    return Response.json({ dossiers: dossiers.length, faites, restantes, courriel_equipe: ecrit, reglages: { courriel: courrielActif(), equipe: Boolean(equipe()), envoi_reel: envoiReel(), relances_auto: relancesAuto(), planificateur: Boolean(secret) } });
  } catch (e) {
    return Response.json({ erreur: "Le tour a échoué." }, { status: e instanceof BaseIndisponible ? 503 : 500 });
  }
}
