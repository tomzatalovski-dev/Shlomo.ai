import { analyserSaisie } from "@/lib/saisie";
import { clore, ouvrir } from "@/lib/compteur";
import { garderConcurrents, lireConcurrents, noterConsommation } from "@/lib/base";
import { chercherConcurrents, relireConcurrents } from "@/lib/concurrents";
import { chercherSociete, RegistreIndisponible } from "@/lib/registre";
import { libelleProfil, masquer, trouverRepreneurs } from "@/lib/repreneurs";
import { ecrireInteret } from "@/lib/interet";
import { lireSite } from "@/lib/site";
import { mesurer } from "@/lib/base";
import { iaActive } from "@/lib/ia";
import { veiller } from "@/lib/veille";
import { avecTaille, lireTaille } from "@/lib/taille";
import { bilanActif, direBilan, lireBilan } from "@/lib/bilan";
import { lireMetiers } from "@/lib/metiers";
import { adresseDe, messagePlafond, plafondAtteint, tropDappels } from "@/lib/limite";
import type { EvenementRepreneurs } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Les phrases d'intérêt des dix repreneurs arrivent après la liste : la requête peut durer, elle ne doit pas être coupée.
export const maxDuration = 300;

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
      const releve = ouvrir();
      const dire = (e: EvenementRepreneurs) => controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (tropDappels(`repreneurs:${adresseDe(requete)}`, 6)) {
          dire({ type: "erreur", message: "Trop de recherches en peu de temps. Réessayez dans une minute." });
          return;
        }
        const plafond = await plafondAtteint("repreneurs", requete, 20, 300);
        if (plafond) {
          dire({ type: "erreur", message: messagePlafond(plafond) });
          return;
        }
        if (saisie.type !== "siren") {
          dire({ type: "erreur", message: "Il me faut le numéro SIREN de votre société pour chercher ses repreneurs." });
          return;
        }

        dire({ type: "encours", texte: "Relecture de votre fiche au registre" });
        const fiche = await chercherSociete(saisie.siren);
        // La taille que le vendeur a retenue sur sa fiche (celle de son site quand elle dépasse nettement le registre).
        const taille = lireTaille(parametres.get("e"));
        const vendeur = fiche && avecTaille(fiche, taille);
        if (!vendeur) {
          dire({ type: "erreur", message: `Le registre ne connaît pas de société au SIREN ${saisie.siren}.` });
          return;
        }
        dire({ type: "vendeur", nom: vendeur.nom, siren: vendeur.siren });
        if (vendeur.horsParcours) {
          dire({ type: "erreur", message: vendeur.horsParcours });
          return;
        }

        const metiers = lireMetiers(parametres.get("m"), vendeur.codeActivite);
        if (metiers.length === 0) {
          dire({ type: "erreur", message: "Le registre n'indique pas votre code d'activité. Je ne peux pas chercher de sociétés du même métier." });
          return;
        }
        dire({ type: "metiers", liste: metiers });
        if (taille && fiche) dire({ type: "journal", texte: `Taille retenue : environ ${taille} personnes, d'après votre site${fiche.effectif ? ` (le registre en compte ${fiche.effectif.replace(/ salariés?$/, "")})` : ""}`, etat: "ok" });
        for (const m of metiers) {
          dire({ type: "journal", texte: `${m.lien === "meme" ? "Votre activité" : "Activité voisine"} : ${m.libelle ? `${m.libelle} (${m.code})` : `code ${m.code}`}`, etat: "ok" });
        }

        dire({ type: "encours", texte: metiers.length > 1 ? "Recherche des sociétés de ces activités, plus grandes que vous" : "Recherche des sociétés du même métier, plus grandes que vous" });
        // Le site du vendeur, lu une fois : il sert à trouver ses concurrents directs, puis à écrire ce que chacun y gagnerait.
        const siteSaisi = analyserSaisie(parametres.get("site") ?? "");
        const lecture = siteSaisi.type === "site" ? await lireSite(siteSaisi.domaine).catch(() => null) : null;
        // Sans site, la description que le vendeur a validée sur sa fiche tient lieu de présentation.
        const decrit = (parametres.get("d") ?? "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
        const texteSite = lecture ? [lecture.titre, lecture.description, lecture.texte].filter(Boolean).join(" ") : decrit.length >= 80 ? decrit : undefined;
        // Les concurrents directs, cherchés sur le web pendant que le registre est parcouru. Gardés trente jours :
        // un rechargement ne relance pas la recherche, et la liste signée au mandat est celle que le vendeur a vue.
        const directs = (async () => {
          const gardes = await lireConcurrents(vendeur.siren);
          if (gardes.length) return relireConcurrents(gardes, vendeur);
          if (!iaActive()) return [];
          const trouves = await chercherConcurrents(vendeur, texteSite, metiers.map((m) => m.libelle).filter(Boolean));
          if (!trouves) return [];
          await garderConcurrents(vendeur.siren, trouves.concurrents);
          dire({ type: "journal", texte: trouves.nommes ? `${trouves.nommes} concurrent${trouves.nommes > 1 ? "s" : ""} direct${trouves.nommes > 1 ? "s" : ""} repéré${trouves.nommes > 1 ? "s" : ""} sur le web, ${trouves.societes.length} retrouvé${trouves.societes.length > 1 ? "s" : ""} au registre et en mesure de vous racheter` : "Aucun concurrent direct repéré sur le web", etat: trouves.societes.length ? "ok" : "alerte" });
          return trouves.societes;
        })();
        const { repreneurs, examinees } = await trouverRepreneurs(vendeur, (p) => {
          dire({ type: "passage", profil: p.profil, libelle: p.libelle, candidats: p.candidats, echec: p.echec });
          if (p.rachats) {
            dire({ type: "journal", texte: `${p.ventes} vente${(p.ventes ?? 0) > 1 ? "s" : ""} de fonds de votre métier publiée${(p.ventes ?? 0) > 1 ? "s" : ""} dans votre région depuis trois ans, dont ${p.trouvees} par une société déjà installée`, etat: "ok" });
            return;
          }
          dire(p.echec ? { type: "journal", texte: `Le registre n'a pas répondu ${PASSAGE[p.profil]} : je continue sans`, etat: "alerte" } : {
            type: "journal",
            texte: `${p.trouvees} société${p.trouvees > 1 ? "s" : ""} examinée${p.trouvees > 1 ? "s" : ""} ${PASSAGE[p.profil]}${p.metier?.lien === "voisin" ? `, activité voisine${p.metier.libelle ? ` (${p.metier.libelle})` : ""}` : ""}`,
            etat: p.trouvees ? "ok" : "alerte",
          });
        }, (total) => dire({ type: "metier", total }), metiers, directs);

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
          // Ce que le vendeur fait, pour écrire ce que chaque repreneur y gagnerait : ses métiers, et son site s'il en a donné un.
          const contexte = { metiers: metiers.filter((m) => m.lien === "meme" && m.libelle).map((m) => m.libelle), site: texteSite };
          // Pour chaque repreneur : ce qu'il a annoncé, puis une phrase d'analyse sans rien qui le nomme (rien si elle n'est pas
          // propre aux deux sociétés). Pour dire ce qu'il y gagnerait, il faut savoir ce qu'il fait : on lit son site quand la veille l'a trouvé.
          const etudier = async (r: (typeof repreneurs)[number], rang: number, avecIndices: boolean) => {
            const veille = await veiller({ nom: r.societe.nom, siren: r.societe.siren, ville: r.societe.ville });
            if (veille) {
              pagesLues += veille.pages.length;
              // Seul le podium voit ses indices peser sur la note : au-delà, on n'écrit que la phrase.
              if (avecIndices) {
                const genres = [...new Set(veille.signaux.map((x) => x.genre).filter((g): g is "rachat" | "croissance" | "alerte" => Boolean(g)))];
                dire({ type: "indices", rang, genres, pages: veille.pages.length });
              }
            }
            const sonSite = veille?.site ? await lireSite(veille.site).catch(() => null) : null;
            const interet = await ecrireInteret(contexte, {
              site: sonSite ? [sonSite.titre, sonSite.description, sonSite.texte].filter(Boolean).join(" ") : undefined,
              nom: r.societe.nom,
              ville: r.societe.ville,
              activite: r.metier?.libelle || undefined,
              lien: libelleProfil(r.profil, r.metier),
              effectif: r.societe.effectif,
              raisons: r.raisons,
              annonces: (veille?.signaux ?? []).filter((x) => x.genre !== "alerte").map((x) => x.texte),
            });
            if (interet) dire({ type: "interet", rang, texte: interet });
          };
          await Promise.all(premiers.map((r, i) => etudier(r, i + 1, true)));
          dire({ type: "veille_faite" });
          // Les suivants, tous ensemble : sept études courtes en parallèle tiennent sous les limites du modèle.
          // Les suivants ne sont étudiés que si le site du vendeur est connu : sans lui, aucune phrase ne peut être écrite.
          const suivants = contexte.site && contexte.site.trim().length >= 80 ? repreneurs.slice(3) : [];
          if (suivants.length) dire({ type: "encours", texte: "Ce que chacun des suivants gagnerait à vous racheter" });
          await Promise.all(suivants.map((r, i) => etudier(r, 4 + i, false)));
          if (pagesLues) dire({ type: "journal", texte: `${pagesLues} pages web lues sur vos ${3 + suivants.length} repreneurs les mieux classés`, etat: "ok" });
        }
        // Lecture du dernier bilan des trois premiers : a-t-il de quoi payer ? Montants arrondis, rien qui nomme la société.
        if (bilanActif() && repreneurs.length > 0) {
          dire({ type: "encours", texte: "Lecture du dernier bilan de vos premiers repreneurs" });
          let lus = 0;
          await Promise.all(
            repreneurs.slice(0, 3).map(async (r, i) => {
              const bilan = await lireBilan(r.societe.siren);
              if (!bilan) return;
              lus++;
              dire({ type: "bilan", rang: i + 1, ...direBilan(bilan) });
            }),
          );
          dire({ type: "journal", texte: lus ? `${lus} bilan${lus > 1 ? "s" : ""} lu${lus > 1 ? "s" : ""} ligne à ligne` : "Bilans confidentiels ou trop anciens : je garde les chiffres du registre", etat: lus ? "ok" : "alerte" });
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
        await noterConsommation("repreneurs", String(parametres.get("siren") ?? "").replace(/\s/g, "").slice(0, 40), clore(releve));
        controleur.close();
      }
    },
  });

  return new Response(flux, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
