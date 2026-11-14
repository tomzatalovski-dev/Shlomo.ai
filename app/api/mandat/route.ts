import { analyserSaisie } from "@/lib/saisie";
import { chercherSociete, RegistreIndisponible } from "@/lib/registre";
import { reveler, trouverRepreneurs } from "@/lib/repreneurs";
import { BaseIndisponible, signerMandat } from "@/lib/base";
import { lireMetiers } from "@/lib/metiers";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const refus = (message: string, statut = 400) => Response.json({ erreur: message }, { status: statut });

/**
 * Signature du mandat (version de test, sans valeur juridique).
 * Le serveur refait lui-même la recherche : la liste enregistrée ne vient jamais du navigateur.
 */
export async function POST(requete: Request) {
  if (tropDappels(`mandat:${adresseDe(requete)}`, 4)) return refus("Trop de signatures en peu de temps. Réessayez dans une minute.", 429);

  const corps = (await requete.json().catch(() => null)) as { siren?: unknown; signataire?: unknown; autorisation?: unknown; metiers?: unknown } | null;
  const saisie = analyserSaisie(typeof corps?.siren === "string" ? corps.siren : "");
  const signataire = typeof corps?.signataire === "string" ? corps.signataire.trim().slice(0, 120) : "";
  if (saisie.type !== "siren") return refus("Numéro SIREN manquant ou invalide.");
  if (signataire.length < 3) return refus("Indiquez votre nom et votre prénom.");

  try {
    const vendeur = await chercherSociete(saisie.siren);
    if (!vendeur) return refus("Le registre ne connaît pas cette société.", 404);

    const metiers = lireMetiers(typeof corps?.metiers === "string" ? corps.metiers : null, vendeur.codeActivite);
    const { repreneurs } = await trouverRepreneurs(vendeur, undefined, undefined, metiers);
    if (repreneurs.length === 0) return refus("Aucun repreneur à présenter pour l'instant : le mandat ne peut pas être signé.", 409);

    const jeton = await signerMandat({
      siren: vendeur.siren,
      nom: vendeur.nom,
      fiche: { formeJuridique: vendeur.formeJuridique, ville: vendeur.ville, codeActivite: vendeur.codeActivite, effectif: vendeur.effectif },
      signataire,
      autorisation: corps?.autorisation === true,
      repreneurs: reveler(repreneurs),
    });
    return Response.json({ jeton });
  } catch (e) {
    if (e instanceof RegistreIndisponible) return refus("Le registre des entreprises ne répond pas. Réessayez dans quelques minutes.", 503);
    if (e instanceof BaseIndisponible) return refus("L'enregistrement du mandat a échoué. Réessayez dans quelques minutes.", 503);
    return refus("Un imprévu a interrompu la signature. Réessayez.", 500);
  }
}
