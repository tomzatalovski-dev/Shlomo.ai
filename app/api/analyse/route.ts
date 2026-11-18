import { analyserSaisie } from "@/lib/saisie";
import { clore, ouvrir } from "@/lib/compteur";
import { noterConsommation } from "@/lib/base";
import { relireFaits } from "@/lib/relecture";
import { sansDateContraire } from "@/lib/taille";
import { chercherParNom, chercherSociete, compterMetier, RegistreIndisponible } from "@/lib/registre";
import { lireSite } from "@/lib/site";
import { iaActive, lireNom, resumer } from "@/lib/ia";
import { choisirSociete, nomsCandidats } from "@/lib/identite";
import { composerMetiers } from "@/lib/metiers";
import { mesurer } from "@/lib/base";
import { messagePlafond, plafondAtteint } from "@/lib/limite";
import { enqueter, siteConfirme } from "@/lib/enquete";
import { etatDesComptes, lireAnnonces } from "@/lib/bodacc";
import type { Evenement, LectureSite, Societe } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Limite simple par adresse : 10 analyses par minute. À remplacer par un stockage partagé en production. */
const appels = new Map<string, number[]>();
function tropDappels(ip: string): boolean {
  const maintenant = Date.now();
  const recents = (appels.get(ip) ?? []).filter((t) => maintenant - t < 60_000);
  recents.push(maintenant);
  appels.set(ip, recents);
  return recents.length > 10;
}

export async function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;
  const q = parametres.get("q") ?? "";
  const siteDonne = parametres.get("site") ?? "";
  const ip = requete.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const encodeur = new TextEncoder();

  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      const releve = ouvrir();
      const dire = (e: Evenement) => controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (tropDappels(ip)) {
          dire({ type: "erreur", message: "Trop de recherches en peu de temps. Réessayez dans une minute." });
          return;
        }
        const plafond = await plafondAtteint("analyse", requete, 20, 400);
        if (plafond) {
          dire({ type: "erreur", message: messagePlafond(plafond) });
          return;
        }

        const saisie = analyserSaisie(q);
        if (saisie.type === "invalide") {
          dire({ type: "erreur", message: saisie.raison });
          return;
        }

        let siren = saisie.type === "siren" ? saisie.siren : undefined;
        let site: LectureSite | null = null;

        if (saisie.type === "site") {
          dire({ type: "encours", texte: `Lecture de ${saisie.domaine}` });
          site = await lireSite(saisie.domaine);
          if (!site) {
            dire({ type: "journal", texte: `${saisie.domaine} n'est pas lisible`, etat: "alerte" });
            dire({ type: "besoin_siren", message: "Je n'arrive pas à lire ce site. Donnez-moi votre numéro SIREN pour continuer." });
            return;
          }
          dire({ type: "journal", texte: `${saisie.domaine} lu, ${site.pagesLues.length} page${site.pagesLues.length > 1 ? "s" : ""}`, etat: "ok" });
          dire({ type: "site", domaine: site.domaine, titre: site.titre, description: site.description });
          siren = site.sirenTrouve;
          if (!siren) {
            // Pas de SIREN sur le site : on cherche la société au registre par son nom.
            dire({ type: "journal", texte: "Pas de numéro SIREN sur le site", etat: "alerte" });
            dire({ type: "encours", texte: "Recherche de votre société au registre, par son nom" });
            const nomLu = iaActive() ? await lireNom(site.texte).catch(() => undefined) : undefined;
            const fiches: { candidat: string; societes: Societe[] }[] = [];
            // D'abord à l'adresse lue sur le site, puis dans toute la France.
            if (nomLu?.codePostal) fiches.push({ candidat: nomLu.nom, societes: await chercherParNom(nomLu.nom, nomLu.codePostal).catch(() => []) });
            for (const candidat of nomsCandidats(site.domaine, site.titre, nomLu?.nom)) {
              fiches.push({ candidat, societes: await chercherParNom(candidat).catch(() => []) });
            }
            const texteAdresse = nomLu?.codePostal ? `${site.texte} ${nomLu.codePostal}` : site.texte;
            const { sure, propositions } = choisirSociete(fiches, texteAdresse);
            if (!sure) {
              dire({
                type: "besoin_siren",
                message: propositions.length
                  ? "Votre site n'affiche pas de numéro SIREN. Est-ce l'une de ces sociétés ? Sinon, saisissez votre SIREN."
                  : "Votre site n'affiche pas de numéro SIREN et je ne retrouve pas votre société par son nom. Saisissez votre SIREN.",
                propositions: propositions.map((p) => ({ siren: p.siren, nom: p.nom, ville: p.ville, codePostal: p.codePostal })),
              });
              return;
            }
            siren = sure.siren;
            dire({ type: "journal", texte: `Société reconnue au registre : ${sure.nom}${sure.ville ? `, ${sure.ville}` : ""}`, etat: "ok" });
          } else {
            dire({ type: "journal", texte: `SIREN ${siren} trouvé dans les mentions légales`, etat: "ok" });
          }
        }

        // Le SIREN a été saisi après coup : on relit le site donné au départ pour rédiger la fiche.
        if (saisie.type === "siren" && siteDonne) {
          const rappel = analyserSaisie(siteDonne);
          if (rappel.type === "site") {
            dire({ type: "encours", texte: `Lecture de ${rappel.domaine}` });
            site = await lireSite(rappel.domaine);
            if (site) {
              dire({ type: "journal", texte: `${rappel.domaine} lu, ${site.pagesLues.length} page${site.pagesLues.length > 1 ? "s" : ""}`, etat: "ok" });
              dire({ type: "site", domaine: site.domaine, titre: site.titre, description: site.description });
            } else {
              dire({ type: "journal", texte: `${rappel.domaine} n'est pas lisible`, etat: "alerte" });
            }
          }
        }

        dire({ type: "encours", texte: "Interrogation du registre des entreprises" });
        const societe = await chercherSociete(siren!);
        if (!societe) {
          dire({ type: "erreur", message: `Le registre ne connaît pas de société au SIREN ${siren}.` });
          return;
        }
        dire({ type: "journal", texte: `Société trouvée : ${societe.nom}`, etat: "ok" });
        dire({ type: "societe", societe });

        // Ce qui ne se vend pas est dit tout de suite : ni recherche web, ni liste de repreneurs.
        if (societe.horsParcours) {
          dire({ type: "journal", texte: `${societe.formeJuridique ?? "Cette structure"} : hors du parcours de cession`, etat: "alerte" });
          dire({ type: "hors_parcours", message: societe.horsParcours });
          return;
        }
        if (!societe.active) dire({ type: "journal", texte: "Le registre indique une société cessée", etat: "alerte" });

        const annees = societe.finances.map((f) => f.annee);
        if (annees.length) dire({ type: "journal", texte: `Comptes publiés récupérés : ${annees.join(", ")}`, etat: "ok" });

        // Annonces légales : ce que le bulletin officiel a publié sur la société.
        dire({ type: "encours", texte: "Lecture des annonces légales au bulletin officiel" });
        const annonces = await lireAnnonces(societe.siren);
        if (!annonces) {
          dire({ type: "journal", texte: "Le bulletin officiel des annonces légales ne répond pas", etat: "alerte" });
          if (!annees.length) dire({ type: "journal", texte: "Comptes non publiés au registre : vous seul pouvez les fournir", etat: "alerte" });
        } else {
          const comptes = etatDesComptes(annonces);
          // Les modifications courantes encombrent : on montre d'abord ce qui compte pour une cession.
          // Seules les annonces qui pèsent sur une cession sont montrées : ventes, procédures, changements de dirigeants.
          const utiles = annonces.filter((a) => a.genre === "procedure" || a.genre === "vente" || /administration|dirigeant|capital|dissolution|fusion/i.test(a.detail ?? ""))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 6);
          dire({ type: "annonces", liste: utiles, total: annonces.length, comptes });
          dire({ type: "journal", texte: annonces.length ? `${annonces.length} annonce${annonces.length > 1 ? "s" : ""} légale${annonces.length > 1 ? "s" : ""} au bulletin officiel` : "Aucune annonce légale au bulletin officiel", etat: "ok" });
          if (annonces.some((a) => a.genre === "procedure")) dire({ type: "journal", texte: "Une procédure collective figure au bulletin officiel : un repreneur la verra aussi", etat: "alerte" });
          if (!annees.length) {
            dire({
              type: "journal",
              texte:
                comptes === "confidentiels"
                  ? "Comptes déposés avec une déclaration de confidentialité : ils existent, mais vous seul pouvez les montrer"
                  : comptes === "deposes"
                    ? "Des comptes ont été déposés, mais leurs chiffres ne sont pas en accès libre : vous pouvez les fournir"
                    : "Aucun dépôt de comptes au bulletin officiel : vous seul pouvez fournir vos chiffres",
              etat: "alerte",
            });
          }
        }

        // L'enquête : ce que le web public dit de la société. Elle tourne pendant que la fiche se rédige quand le site est connu ;
        // sans site, elle passe d'abord, car c'est elle qui peut le retrouver.
        let texteFiche = site?.texte;
        let origine = "du site";
        // Chaque fait est relu sur la page qu'il cite avant d'être montré : un détail ajouté par l'IA le fait retirer.
        const enquete = iaActive()
          ? enqueter(societe).then(async (e) => {
              if (!e) return e;
              const dates = sansDateContraire(e.faits, societe.anneeCreation);
              const relu = await relireFaits(dates).catch(() => ({ gardes: dates, retires: 0, nonRelus: dates.length }));
              return { ...e, faits: relu.gardes, ecartes: e.ecartes + (e.faits.length - dates.length) + relu.retires, relus: relu.gardes.length - relu.nonRelus };
            })
          : Promise.resolve(null);
        let enqueteDite = false;
        const direEnquete = (e: Awaited<typeof enquete>) => {
          enqueteDite = true;
          if (!e) return;
          dire({ type: "journal", texte: `${e.requetes.length} recherche${e.requetes.length > 1 ? "s" : ""} sur le web, ${e.pages.length} page${e.pages.length > 1 ? "s" : ""} lue${e.pages.length > 1 ? "s" : ""}`, etat: "ok" });
          if (e.relus) dire({ type: "journal", texte: `${e.relus} fait${e.relus > 1 ? "s" : ""} relu${e.relus > 1 ? "s" : ""} mot à mot sur ${e.relus > 1 ? "leur" : "sa"} page d'origine`, etat: "ok" });
          if (e.faits.length) dire({ type: "faits", faits: e.faits, requetes: e.requetes, pages: e.pages });
          dire(
            e.faits.length
              ? { type: "journal", texte: `${e.faits.length} fait${e.faits.length > 1 ? "s" : ""} public${e.faits.length > 1 ? "s" : ""} retenu${e.faits.length > 1 ? "s" : ""}, chacun avec sa source${e.ecartes ? ` ; ${e.ecartes} écarté${e.ecartes > 1 ? "s" : ""} faute de source vérifiable` : ""}`, etat: "ok" }
              : { type: "journal", texte: "Aucun fait public vérifiable trouvé sur le web", etat: "alerte" },
          );
        };

        if (!site && iaActive()) {
          dire({ type: "encours", texte: "Recherche de votre société sur le web" });
          const e = await enquete;
          if (!e) dire({ type: "journal", texte: "La recherche sur le web n'a pas abouti", etat: "alerte" });
          direEnquete(e);
          if (e?.site) {
            dire({ type: "encours", texte: `Lecture de ${e.site}` });
            const trouve = await lireSite(e.site).catch(() => null);
            const confirmation = trouve ? siteConfirme(trouve, societe) : false;
            if (trouve && confirmation) {
              site = trouve;
              texteFiche = trouve.texte;
              dire({ type: "journal", texte: confirmation === "sur" ? `Votre site retrouvé : ${trouve.domaine}, votre SIREN y figure` : `Site probable : ${trouve.domaine}, à confirmer`, etat: "ok" });
              dire({ type: "site", domaine: trouve.domaine, titre: trouve.titre, description: trouve.description, confirmation });
            } else {
              dire({ type: "journal", texte: `${e.site} écarté : rien n'y prouve que c'est votre société`, etat: "alerte" });
            }
          }
          if (!texteFiche && e?.activite) {
            texteFiche = [e.activite, ...e.faits.map((f) => f.texte)].join("\n");
            origine = "de sources publiques";
          }
          if (!texteFiche) dire({ type: "journal", texte: "Pas de site ni de description publique : décrivez votre activité en deux phrases, je ferai le reste", etat: "alerte" });
        }

        if (texteFiche && iaActive()) {
          dire({ type: "encours", texte: "Rédaction de la fiche" });
          try {
            const resume = await resumer(societe, texteFiche, origine === "du site" ? "site" : "web");
            if (resume) {
              dire({ type: "resume", resume });
              dire({ type: "journal", texte: `Fiche rédigée à partir ${origine}`, etat: "ok" });

              // Les codes proposés par l'IA ne servent que si le registre les connaît.
              const proposes = composerMetiers(societe.codeActivite, resume.codes ?? []);
              const totaux = await Promise.all(proposes.map((m) => compterMetier(m.code).catch(() => undefined)));
              const liste = proposes.map((m, i) => ({ ...m, total: totaux[i] })).filter((m) => (m.total ?? 0) > 0 || m.code === societe.codeActivite);
              if (liste.length) {
                dire({ type: "encours", texte: "Recherche des activités où trouver vos repreneurs" });
                dire({ type: "metiers", libelle: resume.metier, liste });
                dire({ type: "journal", texte: `${liste.length} activité${liste.length > 1 ? "s" : ""} où chercher vos repreneurs`, etat: "ok" });
              }
            } else {
              dire({ type: "journal", texte: "Les sources ne permettent pas de rédiger une description", etat: "alerte" });
            }
          } catch (e) {
            const detail = e instanceof Error ? e.message : "inconnu";
            console.error("Rédaction de la fiche :", detail);
            dire({ type: "journal", texte: "Description indisponible pour le moment", etat: "alerte", detail } as Evenement);
          }
        } else if (site) {
          dire({ type: "journal", texte: "Rédaction par IA non activée sur ce serveur", etat: "alerte" });
        }

        // Le site était connu dès le départ : l'enquête a tourné en parallèle, on montre maintenant ce qu'elle a trouvé.
        if (iaActive() && !enqueteDite) {
          dire({ type: "encours", texte: "Recherche de ce que le web dit de vous" });
          direEnquete(await enquete);
        }

        await mesurer("fiche_vue", societe.siren);
        dire({ type: "fin" });
      } catch (e) {
        dire({
          type: "erreur",
          message:
            e instanceof RegistreIndisponible
              ? "Le registre public des entreprises ne répond pas en ce moment. Ce n'est pas votre saisie : réessayez dans un instant."
              : "Un imprévu a interrompu la recherche. Réessayez.",
        });
      } finally {
        await noterConsommation("fiche", String(q).replace(/\s/g, "").slice(0, 40), clore(releve));
        controleur.close();
      }
    },
  });

  return new Response(flux, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
