import { analyserSaisie } from "@/lib/saisie";
import { chercherSociete, RegistreIndisponible } from "@/lib/registre";
import { masquer, trouverRepreneurs } from "@/lib/repreneurs";
import { mesurer } from "@/lib/base";
import { iaActive } from "@/lib/ia";
import { veiller } from "@/lib/veille";
import { lireMetiers } from "@/lib/metiers";
import { adresseDe, tropDappels } from "@/lib/limite";
import type { EvenementRepreneurs } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PASSAGE = {
  departement: "dans votre département",
  region: "dans votre région",
  national: "dans toute la France",
} as const;

export async function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;
  const saisie = analyserSaisie(parametres.get("siren") ?? "");

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

        const metiers = lireMetiers(parametres.get("m"), vendeur.codeActivite);
        if (metiers.length === 0) {
          dire({ type: "erreur", message: "Le registre n'indique pas votre code d'activité. Je ne peux pas chercher de sociétés du même métier." });
          return;
        }
        dire({ type: "metiers", liste: metiers });
        for (const m of metiers) {
          dire({ type: "journal", texte: `${m.lien === "meme" ? "Votre activité" : "Activité voisine"} : ${m.libelle ? `${m.libelle} (${m.code})` : `code ${m.code}`}`, etat: "ok" });
        }

        dire({ type: "encours", texte: metiers.length > 1 ? "Recherche des sociétés de ces activités, plus grandes que vous" : "Recherche des sociétés du même métier, plus grandes que vous" });
        const { repreneurs, examinees } = await trouverRepreneurs(vendeur, (p) => {
          dire({ type: "passage", profil: p.profil, libelle: p.libelle, candidats: p.candidats, echec: p.echec });
          dire(p.echec ? { type: "journal", texte: `Le registre n'a pas répondu ${PASSAGE[p.profil]} : je continue sans`, etat: "alerte" } : {
            type: "journal",
            texte: `${p.trouvees} société${p.trouvees > 1 ? "s" : ""} examinée${p.trouvees > 1 ? "s" : ""} ${PASSAGE[p.profil]}${p.metier?.lien === "voisin" ? `, activité voisine${p.metier.libelle ? ` (${p.metier.libelle})` : ""}` : ""}`,
            etat: p.trouvees ? "ok" : "alerte",
          });
        }, (total) => dire({ type: "metier", total }), metiers);

        // Seule la version masquée quitte le serveur ici : ni nom, ni SIREN, ni ville.
        // Les noms ne sont remis que par la page de suivi, après un mandat enregistré.
        dire({ type: "repreneurs", liste: masquer(repreneurs), examinees });
        dire({
          type: "journal",
          texte: repreneurs.length ? `${repreneurs.length} repreneur${repreneurs.length > 1 ? "s" : ""} classé${repreneurs.length > 1 ? "s" : ""}` : "Aucun repreneur retenu à ce stade",
          etat: repreneurs.length ? "ok" : "alerte",
        });

        // Avant le mandat, le vendeur apprend ce que ses trois premiers repreneurs ont annoncé, sans rien qui les nomme :
        // seuls le genre des faits et le nombre de pages lues quittent le serveur.
        if (iaActive() && repreneurs.length > 0) {
          dire({ type: "encours", texte: "Lecture de ce que vos premiers repreneurs ont annoncé publiquement" });
          const premiers = repreneurs.slice(0, 3);
          let pagesLues = 0;
          await Promise.all(
            premiers.map(async (r, i) => {
              const veille = await veiller({ nom: r.societe.nom, siren: r.societe.siren, ville: r.societe.ville });
              if (!veille) return;
              pagesLues += veille.pages.length;
              const genres = [...new Set(veille.signaux.map((x) => x.genre).filter((g): g is "rachat" | "croissance" | "alerte" => Boolean(g)))];
              dire({ type: "indices", rang: i + 1, genres, pages: veille.pages.length });
            }),
          );
          if (pagesLues) dire({ type: "journal", texte: `${pagesLues} pages web lues sur vos ${premiers.length > 1 ? `${premiers.length} premiers repreneurs` : "premier repreneur"}`, etat: "ok" });
        }
        await mesurer("repreneurs_vus", vendeur.siren);
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
