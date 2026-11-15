import { BaseIndisponible, deposerDocument, supprimerDocument } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES = /\.(pdf|png|jpe?g|xlsx?|docx?|csv|txt)$/i;
const refus = (erreur: string, status = 400) => Response.json({ erreur }, { status });

/** Le vendeur dépose ou retire un document de son dossier. Trois mégaoctets au plus par fichier. */
export async function POST(requete: Request) {
  if (tropDappels(`depot:${adresseDe(requete)}`, 20)) return refus("Trop de dépôts en peu de temps.", 429);
  const c = (await requete.json().catch(() => null)) as { jeton?: unknown; nom?: unknown; type?: unknown; contenu?: unknown; retirer?: unknown } | null;
  const jeton = String(c?.jeton ?? "");
  try {
    if (typeof c?.retirer === "string") return (await supprimerDocument(jeton, c.retirer)) ? Response.json({ fait: true }) : refus("Document introuvable.", 404);
    const nom = typeof c?.nom === "string" ? c.nom.trim().slice(0, 160) : "";
    const contenu = typeof c?.contenu === "string" ? c.contenu : "";
    if (!nom || !TYPES.test(nom)) return refus("Formats acceptés : PDF, image, Excel, Word, CSV.");
    if (contenu.length < 8 || contenu.length > 4_400_000 || !/^[A-Za-z0-9+/=]+$/.test(contenu)) return refus("Ce fichier dépasse 3 Mo ou n'est pas lisible.");
    const id = await deposerDocument(jeton, nom, typeof c?.type === "string" ? c.type.slice(0, 100) : "", contenu);
    return id ? Response.json({ id }) : refus("Dépôt refusé : fichier trop lourd, ou vingt documents déjà déposés.", 409);
  } catch (e) {
    return refus("Le dépôt a échoué. Réessayez dans un instant.", e instanceof BaseIndisponible ? 503 : 500);
  }
}
