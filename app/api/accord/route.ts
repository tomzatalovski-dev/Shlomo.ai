import { BaseIndisponible, choisirCreneau, deposerOffre, jetonValide, signerAccord } from "@/lib/base";
import { creneauValide } from "@/lib/creneaux";
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
  try {
    if (c?.action === "creneau") {
      if (!creneauValide(c.creneau)) return refus("Créneau inconnu.");
      return (await choisirCreneau(jeton, c.creneau)) ? Response.json({ fait: true }) : refus("Ce créneau n'est plus disponible.", 409);
    }
    if (c?.action === "offre") {
      const prix = Math.round(Number(String(c.prix ?? "").replace(/[^\d]/g, "")));
      if (!Number.isFinite(prix) || prix < 1000) return refus("Indiquez le prix que vous proposez, en euros.");
      return (await deposerOffre(jeton, { prix, financement: texte(c.financement, 600), calendrier: texte(c.calendrier, 600), conditions: texte(c.conditions, 1200) }))
        ? Response.json({ fait: true })
        : refus("L'offre n'a pas pu être enregistrée.", 409);
    }
    const signataire = texte(c?.signataire, 120);
    if (signataire.length < 3 || c?.accepte !== true) return refus("Indiquez votre nom et acceptez l'accord.");
    return (await signerAccord(jeton, signataire, texte(c?.qualite, 120))) ? Response.json({ signe: true }) : refus("Cet accord est déjà signé ou n'est plus disponible.", 409);
  } catch (e) {
    return refus("L'enregistrement a échoué. Réessayez dans un instant.", e instanceof BaseIndisponible ? 503 : 500);
  }
}
