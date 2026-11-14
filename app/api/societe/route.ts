import { analyserSaisie } from "@/lib/saisie";
import { chercherSociete } from "@/lib/registre";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Identité publique d'une société, pour l'en-tête du mandat. Données du registre, rien d'autre. */
export async function GET(requete: Request) {
  if (tropDappels(`societe:${adresseDe(requete)}`, 20)) return Response.json(null, { status: 429 });
  const saisie = analyserSaisie(new URL(requete.url).searchParams.get("siren") ?? "");
  if (saisie.type !== "siren") return Response.json(null, { status: 400 });
  const s = await chercherSociete(saisie.siren).catch(() => null);
  if (!s) return Response.json(null, { status: 404 });
  return Response.json({ nom: s.nom, formeJuridique: s.formeJuridique ?? null, ville: s.ville ?? null, siren: s.siren });
}
