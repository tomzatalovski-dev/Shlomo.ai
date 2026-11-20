import { cleServeurValide, lireConsommations, lirePoste } from "@/lib/base";
import { cout, PRIX } from "@/lib/compteur";
import { courrielActif } from "@/lib/courriel";
import { bilanActif } from "@/lib/bilan";
import { iaActive, modeles, sonderModeleFin } from "@/lib/ia";

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
  // Ce que coûte chaque étape, en moyenne sur trente jours, au prix public du modèle par défaut.
  const moyennes = (await lireConsommations(code).catch(() => null)) ?? {};
  const consommation = Object.fromEntries(Object.entries(moyennes).map(([etape, m]) => [etape, { ...m, cout_usd: cout(m) === null ? null : Number(cout(m)!.toFixed(4)) }]));
  return Response.json({
    consommation,
    prix: PRIX,
    ia: iaActive(),
    courriel: courrielActif(),
    cle_serveur: !cle ? "absente" : (await cleServeurValide(cle)) ? "bonne" : "fausse",
    bilans_inpi: bilanActif(),
    modeles: modeles(),
    // Sur demande seulement (`&sonde=1`) : un appel minimal au modèle fin, pour savoir s'il répond à cette clé.
    modele_fin: new URL(requete.url).searchParams.get("sonde") === "1" ? await sonderModeleFin() : undefined,
  });
}
