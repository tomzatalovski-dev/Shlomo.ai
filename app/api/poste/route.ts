import { BaseIndisponible, changerStatut, lireFiche, fixerCourrielRepreneur, lireEnvois, lirePoste, noterEnvoi, marquerEssai, opposer, purgerContacts, validerQualite, lirePosteDossier, proposerReponse, rattacherInteret, recevoirReponse, traiterEchange, type StatutPresentation } from "@/lib/base";
import { iaActive } from "@/lib/ia";
import { verifier } from "@/lib/negociation/gardefous";
import { VERSION } from "@/lib/negociation/manuel";
import { repondre } from "@/lib/negociation/negociateur";
import { ETAPES, conversation, dossierPour } from "@/lib/negociation/poste";
import { adresseDe, tropDappels } from "@/lib/limite";
import { courrielActif, envoyer, prevenirVendeur } from "@/lib/courriel";
import { composerPremier, composerRelance, destination, habillerEssai, lienCourt } from "@/lib/envoi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const refus = (message: string, statut = 400) => Response.json({ erreur: message }, { status: statut });
const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Poste de négociation, réservé aux fondateurs (code de pilotage, vérifié par la base à chaque appel).
 * Le négociateur propose, une personne décide. Un premier message ou une relance peut partir d'ici, d'un clic :
 * vers l'équipe pour un dossier d'essai, vers le repreneur seulement si l'envoi réel est ouvert.
 */
export async function POST(requete: Request) {
  if (tropDappels(`poste:${adresseDe(requete)}`, 30)) return refus("Trop d'appels en peu de temps.", 429);
  const c = (await requete.json().catch(() => null)) as Record<string, unknown> | null;
  const code = texte(c?.code, 40);
  const dossier = texte(c?.dossier, 40);
  const siren = texte(c?.siren, 9);
  const action = texte(c?.action, 20);

  try {
    if (action === "opposition") {
      return (await opposer(code, siren, c?.oppose !== false)) ? Response.json({ fait: true }) : refus("Accès refusé.", 403);
    }

    if (action === "purge") {
      const n = await purgerContacts(code);
      return n === null ? refus("Accès refusé.", 403) : Response.json({ fait: true, nettoyes: n });
    }

    if (action === "qualite") {
      const etat = texte(c?.etat, 20);
      if (etat !== "validee" && etat !== "refusee" && etat !== "a_verifier") return refus("État inconnu.");
      return (await validerQualite(code, dossier, etat)) ? Response.json({ fait: true }) : refus("Accès refusé.", 403);
    }

    if (action === "essai") {
      return (await marquerEssai(code, dossier, c?.essai === true)) ? Response.json({ fait: true }) : refus("Accès refusé ou dossier introuvable.", 403);
    }

    if (action === "statut") {
      const statut = texte(c?.statut, 30) as StatutPresentation;
      if (!ETAPES.some(([s]) => s === statut)) return refus("Étape inconnue.");
      if (statut === "contacte" || statut === "relance") {
        const d = await lirePosteDossier(code, dossier);
        if (d && d.qualite !== "validee") return refus("Envoi verrouillé : validez d'abord la qualité du signataire du mandat, en haut du dossier.", 423);
      }
      return (await changerStatut(code, dossier, siren, statut)) ? Response.json({ fait: true }) : refus("Accès refusé ou repreneur introuvable.", 403);
    }

    if (action === "courriel") {
      return (await fixerCourrielRepreneur(code, dossier, siren, texte(c?.courriel, 250).toLowerCase())) ? Response.json({ fait: true }) : refus("Adresse refusée, ou accès refusé.", 403);
    }

    if (action === "envoyer" || action === "relancer") {
      const [d, envois, liste] = await Promise.all([lirePosteDossier(code, dossier), lireEnvois(code, dossier), lirePoste(code)]);
      const lui = d?.presentations.find((p) => p.siren === siren && !p.exclu);
      const e = envois?.[siren];
      if (!d || !lui || !e) return refus("Accès refusé ou repreneur introuvable.", 403);
      if (d.qualite !== "validee") return refus("Envoi verrouillé : validez d'abord la qualité du signataire du mandat, en haut du dossier.", 423);
      if (lui.canal !== "a_envoyer" || !lui.message) return refus("Aucun message n'est prêt pour ce repreneur.", 409);
      const dest = destination(liste?.find((x) => x.id === d.id)?.essai ?? false, e.courriel);
      if ("refus" in dest) return refus(dest.refus, 409);
      if (!courrielActif()) return refus("Le service d'envoi de courriels n'est pas réglé.", 503);
      const lien = lienCourt(new URL(requete.url).origin, e.code_court);
      let m: { sujet: string; texte: string };
      if (action === "envoyer") {
        if (lui.statut !== "identifie") return refus("Le premier message est déjà noté comme parti.", 409);
        m = composerPremier(lui.message, lien);
      } else {
        if ((lui.statut !== "contacte" && lui.statut !== "relance") || e.relances >= 2) return refus("Pas de relance possible à cette étape.", 409);
        m = composerRelance(e.relances === 0 ? 1 : 2, { decideur: lui.decideur, premierLe: e.envois[0]?.le, lien });
      }
      const part = dest.essai ? habillerEssai(m, lui.nom, e.courriel) : m;
      if (!(await envoyer(dest.a, part.sujet, part.texte))) return refus("Le service d'envoi a refusé le message. Rien n'est noté.", 502);
      const note = await noterEnvoi(code, dossier, siren, { genre: action === "envoyer" ? "premier" : "relance", destinataire: dest.a, essai: dest.essai, texte: m.texte });
      return note ? Response.json({ fait: true, essai: dest.essai }) : refus("Le message est parti, mais n'a pas pu être noté : notez l'étape à la main.", 500);
    }

    if (action === "rattacher") {
      return (await rattacherInteret(code, dossier, Number(c?.interet), siren)) ? Response.json({ fait: true }) : refus("Accès refusé ou demande introuvable.", 403);
    }

    if (action === "ecarter") {
      return (await traiterEchange(code, Number(c?.echange), "ecarte")) ? Response.json({ fait: true }) : refus("Cette proposition n'est plus en attente.", 409);
    }

    if (action === "envoye") {
      // Le texte a pu être retouché à la main : il repasse par les mêmes garde-fous que celui de l'IA.
      const envoye = texte(c?.texte, 6000);
      const d = await lirePosteDossier(code, dossier);
      const faits = d && dossierPour(d, siren, d.jeton_fiche ? (await lireFiche(d.jeton_fiche).catch(() => null))?.presentation : null);
      if (!d || !faits) return refus("Accès refusé ou repreneur introuvable.", 403);
      if (d.qualite !== "validee") return refus("Envoi verrouillé : validez d'abord la qualité du signataire du mandat, en haut du dossier.", 423);
      const recu = [...conversation(d.presentations.find((p) => p.siren === siren)!)].reverse().find((t) => t.de === "repreneur")?.texte ?? "";
      const graves = verifier(envoye, faits, recu).filter((f) => f.grave);
      if (graves.length) return Response.json({ erreur: "Ce texte ne peut pas partir.", fautes: graves }, { status: 422 });
      return (await traiterEchange(code, Number(c?.echange), "envoye", envoye)) ? Response.json({ fait: true }) : refus("Cette proposition n'est plus en attente.", 409);
    }

    if (action === "reponse") {
      const recu = texte(c?.texte, 6000);
      if (recu.length < 2) return refus("Collez la réponse du repreneur.");
      if (!iaActive()) return refus("La clé d'IA n'est pas configurée.", 503);
      if ((await recevoirReponse(code, dossier, siren, recu)) === null) return refus("Accès refusé ou repreneur introuvable.", 403);
      // Relecture après l'enregistrement : les faits (étape, nombre de repreneurs en discussion) tiennent compte de cette réponse.
      const d = await lirePosteDossier(code, dossier);
      const lui = d?.presentations.find((p) => p.siren === siren);
      const faits = d && dossierPour(d, siren, d.jeton_fiche ? (await lireFiche(d.jeton_fiche).catch(() => null))?.presentation : null);
      if (!d || !lui || !faits) return refus("Repreneur introuvable.", 404);
      // Le cédant apprend qu'une réponse est arrivée : c'est un fait réel, il le retrouve sur sa page.
      if (lui.jeton_accord) await prevenirVendeur(lui.jeton_accord, new URL(requete.url).origin, (n) => `${n} a répondu`, (n) => `${n} a répondu à notre message. Shlomo prépare la suite ; l'échange est sur votre page.`);
      const r = await repondre(faits, conversation(lui));
      const fautes = [...r.fautes.map((f) => ({ ...f, arretee: false })), ...r.arretees.map((f) => ({ ...f, arretee: true }))];
      const id = await proposerReponse(code, dossier, siren, { texte: r.texte, situation: r.situation, lecture: r.lecture, version: VERSION, fautes, repli: r.repli });
      return Response.json({ fait: id !== null });
    }

    return refus("Action inconnue.");
  } catch (e) {
    return refus("L'opération a échoué. Réessayez dans un instant.", e instanceof BaseIndisponible ? 503 : 500);
  }
}
