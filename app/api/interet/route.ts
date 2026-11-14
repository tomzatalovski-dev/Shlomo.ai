import { BaseIndisponible, jetonValide, manifesterInteret, mesurer } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refus = (message: string, statut = 400) => Response.json({ erreur: message }, { status: statut });

/** Un repreneur, depuis la présentation anonyme, demande à en savoir plus. */
export async function POST(requete: Request) {
  if (tropDappels(`interet:${adresseDe(requete)}`, 3)) return refus("Trop de demandes en peu de temps.", 429);
  const corps = (await requete.json().catch(() => null)) as { jeton?: unknown; nom?: unknown; societe?: unknown; contact?: unknown } | null;
  const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const jeton = texte(corps?.jeton, 40);
  const nom = texte(corps?.nom, 120);
  const contact = texte(corps?.contact, 160);
  if (!jetonValide(jeton) || nom.length < 3 || contact.length < 5) return refus("Demande incomplète.");
  try {
    const recu = await manifesterInteret(jeton, { nom, societe: texte(corps?.societe, 160), contact });
    if (recu) await mesurer("interet", jeton);
    return recu ? Response.json({ recu: true }) : refus("Cette présentation n'est plus disponible.", 404);
  } catch (e) {
    return refus("L'enregistrement a échoué. Réessayez dans un instant.", e instanceof BaseIndisponible ? 503 : 500);
  }
}
