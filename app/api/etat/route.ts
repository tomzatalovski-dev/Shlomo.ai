import { cleServeurValide, lirePoste } from "@/lib/base";
import { courrielActif } from "@/lib/courriel";
import { bilanActif } from "@/lib/bilan";
import { iaActive } from "@/lib/ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * État des branchements, réservé aux fondateurs (code de pilotage).
 * Ne rend jamais une valeur : seulement si chaque service est branché, et si la clé du serveur est la bonne.
 */
export async function GET(requete: Request) {
  const code = new URL(requete.url).searchParams.get("c") ?? "";
  if ((await lirePoste(code)) === null) return Response.json({ erreur: "Accès réservé." }, { status: 403 });
  const cle = process.env.CLE_SERVEUR;
  return Response.json({
    ia: iaActive(),
    courriel: courrielActif(),
    cle_serveur: !cle ? "absente" : (await cleServeurValide(cle)) ? "bonne" : "fausse",
    bilans_inpi: bilanActif(),
  });
}
