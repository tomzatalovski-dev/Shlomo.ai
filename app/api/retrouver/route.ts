import { liensParCourriel } from "@/lib/base";
import { courrielActif, envoyer } from "@/lib/courriel";
import { COURRIEL } from "@/lib/qualite";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renvoie par courriel les liens de suivi rattachés à une adresse. La réponse est la même que l'adresse soit connue ou non :
 * on ne révèle jamais si une société a un dossier chez Shlomo.
 */
export async function POST(requete: Request) {
  if (tropDappels(`retrouver:${adresseDe(requete)}`, 4)) return Response.json({ erreur: "Trop de demandes. Réessayez dans une minute." }, { status: 429 });
  const c = (await requete.json().catch(() => null)) as { courriel?: unknown } | null;
  const courriel = typeof c?.courriel === "string" ? c.courriel.trim().toLowerCase() : "";
  if (!COURRIEL.test(courriel)) return Response.json({ erreur: "Indiquez l'adresse donnée à la signature du mandat." }, { status: 400 });
  if (!courrielActif() || !process.env.CLE_SERVEUR) return Response.json({ erreur: "L'envoi de courriels n'est pas encore activé. Écrivez-nous pour retrouver votre lien." }, { status: 503 });
  try {
    const liens = (await liensParCourriel(process.env.CLE_SERVEUR, courriel)) ?? [];
    const origine = new URL(requete.url).origin;
    if (liens.length) await envoyer(courriel, "Votre lien de suivi Shlomo", `Bonjour,\n\nVoici ${liens.length > 1 ? "vos liens" : "votre lien"} de suivi :\n${liens.map((l) => `${l.nom} : ${origine}/suivi?d=${l.jeton}`).join("\n")}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`);
  } catch {}
  return Response.json({ fait: true });
}
