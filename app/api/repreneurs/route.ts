import { analyserSaisie } from "@/lib/saisie";
import { chercherSociete, RegistreIndisponible } from "@/lib/registre";
import { masquer, trouverRepreneurs } from "@/lib/repreneurs";
import { adresseDe, tropDappels } from "@/lib/limite";
import type { EvenementRepreneurs } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PASSAGE = {
  departement: "dans votre département",
  region: "dans votre région",
  national: "dans toute la France",
} as const;

export async function GET(requete: Request) {
  const saisie = analyserSaisie(new URL(requete.url).searchParams.get("siren") ?? "");
  const encodeur = new TextEncoder();

  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      const dire = (e: EvenementRepreneurs) => controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (tropDappels(`repreneurs:${adresseDe(requete)}`, 6)) {
          dire({ type: "erreur", message: "Trop de recherches en peu de temps. Réessayez dans une minute." });
          return;
        }
        if (saisie.type !== "siren") {
          dire({ type: "erreur", message: "Il me faut le numéro SIREN de votre société pour chercher ses repreneurs." });
          return;
        }

        dire({ type: "encours", texte: "Relecture de votre fiche au registre" });
        const vendeur = await chercherSociete(saisie.siren);
        if (!vendeur) {
          dire({ type: "erreur", message: `Le registre ne connaît pas de société au SIREN ${saisie.siren}.` });
          return;
        }
        dire({ type: "vendeur", nom: vendeur.nom, siren: vendeur.siren });

        if (!vendeur.codeActivite) {
          dire({ type: "erreur", message: "Le registre n'indique pas votre code d'activité. Je ne peux pas chercher de sociétés du même métier." });
          return;
        }
        dire({ type: "journal", texte: `Votre métier au registre : code ${vendeur.codeActivite}`, etat: "ok" });

        dire({ type: "encours", texte: "Recherche des sociétés du même métier, plus grandes que vous" });
        const { repreneurs, examinees } = await trouverRepreneurs(vendeur, (p) =>
          dire(p.echec ? { type: "journal", texte: `Le registre n'a pas répondu ${PASSAGE[p.profil]} : je continue sans`, etat: "alerte" } : {
            type: "journal",
            texte: `${p.trouvees} société${p.trouvees > 1 ? "s" : ""} examinée${p.trouvees > 1 ? "s" : ""} ${PASSAGE[p.profil]}`,
            etat: p.trouvees ? "ok" : "alerte",
          }),
        );

        // Seule la version masquée quitte le serveur : ni nom, ni SIREN, ni ville.
        dire({ type: "repreneurs", liste: masquer(repreneurs), examinees });
        dire({
          type: "journal",
          texte: repreneurs.length ? `${repreneurs.length} repreneur${repreneurs.length > 1 ? "s" : ""} classé${repreneurs.length > 1 ? "s" : ""}` : "Aucun repreneur retenu à ce stade",
          etat: repreneurs.length ? "ok" : "alerte",
        });
        dire({ type: "fin" });
      } catch (e) {
        dire({
          type: "erreur",
          message:
            e instanceof RegistreIndisponible
              ? "Le registre des entreprises ne répond pas. Réessayez dans quelques minutes."
              : "Un imprévu a interrompu la recherche. Réessayez.",
        });
      } finally {
        controleur.close();
      }
    },
  });

  return new Response(flux, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
