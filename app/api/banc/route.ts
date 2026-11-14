import { enregistrerEssai, lireEntonnoir } from "@/lib/base";
import { iaActive } from "@/lib/ia";
import { PERSONAS, jouer } from "@/lib/negociation/banc";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Lance une conversation du banc d'essai : le négociateur contre un repreneur simulé.
 * Réservé aux fondateurs (code de pilotage). Chaque tour est envoyé au navigateur dès qu'il est joué.
 */
export async function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;
  const code = parametres.get("c") ?? "";
  const persona = PERSONAS.find((p) => p.id === parametres.get("p"));
  const encodeur = new TextEncoder();

  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      const dire = (e: unknown) => controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        // Le code de pilotage est vérifié par la base : sans lui, rien ne tourne et rien n'est dépensé.
        const autorise = (await lireEntonnoir(code, 1).catch(() => null)) !== null;
        if (!autorise) return dire({ type: "erreur", message: "Accès refusé." });
        if (!persona) return dire({ type: "erreur", message: "Repreneur simulé inconnu." });
        if (!iaActive()) return dire({ type: "erreur", message: "La clé d'IA n'est pas configurée : le banc d'essai ne peut pas tourner." });
        if (tropDappels(`banc:${adresseDe(requete)}`, 40)) return dire({ type: "erreur", message: "Trop d'essais en peu de temps. Réessayez dans une minute." });

        const essai = await jouer(persona, (tour) => dire({ type: "tour", tour }));
        const garde = await enregistrerEssai(code, essai).catch(() => false);
        dire({ type: "fin", essai: { persona: essai.persona, graves: essai.graves, fautes: essai.fautes, rendezVous: essai.rendezVous, note: essai.note, avis: essai.avis }, garde });
      } catch {
        dire({ type: "erreur", message: "L'essai s'est interrompu." });
      } finally {
        controleur.close();
      }
    },
  });

  return new Response(flux, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
