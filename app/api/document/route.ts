import { BaseIndisponible, lireDocumentRepreneur, lireDocumentVendeur } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remet un document du dossier. Avec `d`, c'est le vendeur (son jeton de suivi). Avec `a`, c'est un repreneur :
 * la base ne rend le fichier que s'il a signé l'accord et reçu le feu vert du vendeur, et elle note la consultation.
 */
export async function GET(requete: Request) {
  if (tropDappels(`document:${adresseDe(requete)}`, 30)) return new Response("Trop de demandes.", { status: 429 });
  const p = new URL(requete.url).searchParams;
  const id = p.get("id") ?? "";
  try {
    const fichier = p.get("a") ? await lireDocumentRepreneur(p.get("a")!, id) : await lireDocumentVendeur(p.get("d") ?? "", id);
    if (!fichier) return new Response("Document indisponible.", { status: 404 });
    const nom = fichier.nom.replace(/[^\w.\- àâäéèêëîïôöùûüçÀÂÉÈÊÎÔÙÇ]/g, "_");
    return new Response(Buffer.from(fichier.contenu, "base64"), {
      headers: {
        // Toujours en téléchargement, jamais affiché dans la page : un fichier déposé ne peut pas s'exécuter sur le site.
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (e) {
    return new Response("Document indisponible pour le moment.", { status: e instanceof BaseIndisponible ? 503 : 500 });
  }
}
