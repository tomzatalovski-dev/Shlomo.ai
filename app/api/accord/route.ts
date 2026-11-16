import { BaseIndisponible, choisirCreneau, deposerOffre, jetonValide, signerAccord } from "@/lib/base";
import { creneauValide, direCreneau } from "@/lib/creneaux";
import { prevenirVendeur } from "@/lib/courriel";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refus = (message: string, statut = 400) => Response.json({ erreur: message }, { status: statut });
const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Ce qu'un repreneur fait depuis sa page : signer l'accord, puis, une fois le nom communiqué, choisir un rendez-vous et déposer une offre.
 * La base refuse le rendez-vous et l'offre tant que l'accord n'est pas signé et que le cédant n'a pas donné son feu vert.
 */
export async function POST(requete: Request) {
  if (tropDappels(`accord:${adresseDe(requete)}`, 10)) return refus("Trop de demandes en peu de temps.", 429);
  const c = (await requete.json().catch(() => null)) as Record<string, unknown> | null;
  const jeton = texte(c?.jeton, 40);
  if (!jetonValide(jeton)) return refus("Lien incomplet.");
  const origine = new URL(requete.url).origin;
  try {
    if (c?.action === "creneau") {
      if (!creneauValide(c.creneau)) return refus("Créneau inconnu.");
      if (!(await choisirCreneau(jeton, c.creneau))) return refus("Ce créneau n'est plus disponible.", 409);
      const creneau = direCreneau(c.creneau);
      await prevenirVendeur(jeton, origine, (r) => `Rendez-vous pris avec ${r}`, (r) => `${r} a choisi de vous rencontrer ${creneau}.`);
      return Response.json({ fait: true });
    }
    if (c?.action === "offre") {
      const prix = Math.round(Number(String(c.prix ?? "").replace(/[^\d]/g, "")));
      if (!Number.isFinite(prix) || prix < 1000) return refus("Indiquez le prix que vous proposez, en euros.");
      if (!(await deposerOffre(jeton, { prix, financement: texte(c.financement, 600), calendrier: texte(c.calendrier, 600), conditions: texte(c.conditions, 1200) }))) return refus("L'offre n'a pas pu être enregistrée.", 409);
      await prevenirVendeur(jeton, origine, (r) => `Une offre de ${r} attend votre réponse`, (r) => `${r} a déposé une offre de ${prix.toLocaleString("fr-FR")} €. Vous seul pouvez l'accepter, la refuser ou demander mieux.`);
      return Response.json({ fait: true });
    }
    const signataire = texte(c?.signataire, 120);
    if (signataire.length < 3 || c?.accepte !== true) return refus("Indiquez votre nom et acceptez l'accord.");
    if (!(await signerAccord(jeton, signataire, texte(c?.qualite, 120)))) return refus("Cet accord est déjà signé ou n'est plus disponible.", 409);
    await prevenirVendeur(jeton, origine, (r) => `${r} a signé l'accord de confidentialité`, (r) => `${r} a signé l'accord de confidentialité. Votre nom ne lui est communiqué que si vous le décidez, depuis votre suivi.`);
    return Response.json({ signe: true });
  } catch (e) {
    return refus("L'enregistrement a échoué. Réessayez dans un instant.", e instanceof BaseIndisponible ? 503 : 500);
  }
}
