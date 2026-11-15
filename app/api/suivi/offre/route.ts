import { BaseIndisponible, repondreOffre } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le vendeur répond lui-même à une offre : personne d'autre n'accepte ni ne refuse un prix à sa place. */
export async function POST(requete: Request) {
  if (tropDappels(`offre:${adresseDe(requete)}`, 20)) return Response.json({ erreur: "Trop de demandes." }, { status: 429 });
  const c = (await requete.json().catch(() => null)) as { jeton?: unknown; offre?: unknown; reponse?: unknown } | null;
  const reponse = c?.reponse;
  if (reponse !== "acceptee" && reponse !== "refusee" && reponse !== "a_ameliorer") return Response.json({ erreur: "Réponse inconnue." }, { status: 400 });
  try {
    const fait = await repondreOffre(String(c?.jeton ?? ""), Number(c?.offre), reponse);
    return Response.json({ fait }, { status: fait ? 200 : 409 });
  } catch (e) {
    return Response.json({ erreur: "Enregistrement impossible pour le moment." }, { status: e instanceof BaseIndisponible ? 503 : 500 });
  }
}
