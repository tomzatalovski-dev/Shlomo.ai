import { analyserSaisie } from "@/lib/saisie";
import { chercherParNom, chercherSociete, compterMetier, RegistreIndisponible } from "@/lib/registre";
import { lireSite } from "@/lib/site";
import { iaActive, lireNom, resumer } from "@/lib/ia";
import { choisirSociete, nomsCandidats } from "@/lib/identite";
import { composerMetiers } from "@/lib/metiers";
import { mesurer } from "@/lib/base";
import type { Evenement, LectureSite, Societe } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      const dire = (e: Evenement) => controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (tropDappels(ip)) {
          dire({ type: "erreur", message: "Trop de recherches en peu de temps. Réessayez dans une minute." });
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

        if (societe.formeJuridique === "Association") {
          dire({ type: "journal", texte: "C'est une association : elle ne se vend pas comme une société, ce parcours n'est pas fait pour elle", etat: "alerte" });
        }
        if (!societe.active) dire({ type: "journal", texte: "Le registre indique une société cessée", etat: "alerte" });

        const annees = societe.finances.map((f) => f.annee);
        dire(
          annees.length
            ? { type: "journal", texte: `Comptes publiés récupérés : ${annees.join(", ")}`, etat: "ok" }
            : { type: "journal", texte: "Aucun compte publié accessible", etat: "alerte" },
        );

        if (site && iaActive()) {
          dire({ type: "encours", texte: "Rédaction de la fiche" });
          try {
            const resume = await resumer(societe, site.texte);
            if (resume) {
              dire({ type: "resume", resume });
              dire({ type: "journal", texte: "Fiche rédigée à partir du site", etat: "ok" });

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
              dire({ type: "journal", texte: "Le site ne permet pas de rédiger une description", etat: "alerte" });
            }
          } catch (e) {
            const detail = e instanceof Error ? e.message : "inconnu";
            console.error("Rédaction de la fiche :", detail);
            dire({ type: "journal", texte: "Description indisponible pour le moment", etat: "alerte", detail } as Evenement);
          }
        } else if (site) {
          dire({ type: "journal", texte: "Rédaction par IA non activée sur ce serveur", etat: "alerte" });
        }

        await mesurer("fiche_vue", societe.siren);
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
