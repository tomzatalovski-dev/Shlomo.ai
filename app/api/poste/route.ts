import { BaseIndisponible, changerStatut, marquerEssai, opposer, purgerContacts, validerQualite, lirePosteDossier, proposerReponse, rattacherInteret, recevoirReponse, traiterEchange, type StatutPresentation } from "@/lib/base";
import { iaActive } from "@/lib/ia";
import { verifier } from "@/lib/negociation/gardefous";
import { VERSION } from "@/lib/negociation/manuel";
import { repondre } from "@/lib/negociation/negociateur";
import { ETAPES, conversation, dossierPour } from "@/lib/negociation/poste";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const refus = (message: string, statut = 400) => Response.json({ erreur: message }, { status: statut });
const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Poste de négociation, réservé aux fondateurs (code de pilotage, vérifié par la base à chaque appel).
 * Rien n'est envoyé d'ici : le négociateur propose, une personne envoie puis le note.
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
      const faits = d && dossierPour(d, siren);
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
      const faits = d && dossierPour(d, siren);
      if (!d || !lui || !faits) return refus("Repreneur introuvable.", 404);
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
