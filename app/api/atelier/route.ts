import { chercherSociete } from "@/lib/registre";
import { clore, ouvrir } from "@/lib/compteur";
import { noterConsommation } from "@/lib/base";
import { BaseIndisponible, enregistrerApproche, enregistrerBriefings, enregistrerPresentation, jetonValide, lireSuivi, lireTravail, mesurer, type Presentation } from "@/lib/base";
import { briefingRepreneurSur, ecrireBriefings, type VendeurBriefing } from "@/lib/briefing";
import { chercherComparables, direComparables } from "@/lib/comparables";
import { REGIONS } from "@/lib/fiche";
import type { Signal, Societe } from "@/lib/types";
import { presenter } from "@/lib/fiche";
import { lireSite } from "@/lib/site";
import { choisirDecideur, redigerEtRelire, MENTION_PROSPECTION } from "@/lib/approche";
import { veiller } from "@/lib/veille";
import { iaActive } from "@/lib/ia";
import { adresseDe, messagePlafond, plafondAtteint, tropDappels } from "@/lib/limite";
import type { EvenementAtelier, LigneAtelier } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AGENTS = 5;

function etatDe(p: Presentation): LigneAtelier["etat"] {
  if (p.exclu) return "raye";
  if (p.statut !== "identifie") return "contacte";
  if (p.canal === "refus_demarchage") return "refus";
  if (p.canal === "a_envoyer") return "pret";
  return "a_faire";
}

/**
 * Préparation des approches, après la signature du mandat.
 * Trois agents se partagent les repreneurs : fiche au registre, décideur, veille sur le web, message, enregistrement.
 * Rien n'est envoyé : les messages sont enregistrés, prêts à partir.
 */
export async function GET(requete: Request) {
  const jeton = new URL(requete.url).searchParams.get("d") ?? "";
  const encodeur = new TextEncoder();

  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      const releve = ouvrir();
      let ouvert = true;
      const dire = (e: EvenementAtelier) => {
        if (ouvert) controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        if (!jetonValide(jeton)) return dire({ type: "erreur", message: "Ce lien n'est pas reconnu." });
        if (tropDappels(`atelier:${adresseDe(requete)}`, 6)) return dire({ type: "erreur", message: "Trop de demandes en peu de temps. Réessayez dans une minute." });
        const plafond = await plafondAtteint("atelier", requete, 20, 100);
        if (plafond) return dire({ type: "erreur", message: messagePlafond(plafond) });

        const suivi = await lireSuivi(jeton);
        if (!suivi) return dire({ type: "erreur", message: "Ce lien n'est pas reconnu." });
        if (!suivi.mandat?.autorisation_approche) return dire({ type: "erreur", message: "Vous n'avez pas autorisé l'approche : aucun message n'est préparé." });

        dire({
          type: "plan",
          societe: suivi.societe.nom,
          lignes: suivi.presentations.map((p) => ({ siren: p.siren, nom: p.nom, rang: p.rang, ville: p.ville, effectif: p.effectif, etat: etatDe(p), decideur: p.decideur, qualite: p.qualite, message: p.message, site: p.site, signaux: p.signaux })),
        });

        // Chaque message se termine par le lien vers la présentation anonyme de la société.
        const lienFiche = suivi.jeton_fiche ? `${new URL(requete.url).origin}/fiche?f=${suivi.jeton_fiche}` : null;
        const aFaire = suivi.presentations.filter((p) => etatDe(p) === "a_faire");
        const interdits = [suivi.societe.nom, suivi.fiche?.ville ?? ""].filter(Boolean);

        // Les deux briefings de chaque rapprochement partent des mêmes faits : les comptes du cédant, lus une fois, et les prix de vente publiés pour son métier.
        const ficheVendeur = await chercherSociete(suivi.societe.siren).catch(() => null);
        // Les prix publiés sont ceux de fonds de commerce : ils ne disent rien d'une société de vingt salariés ou plus.
        const petite = Number((suivi.fiche?.effectif ?? "").match(/\d+/)?.[0] ?? 0) < 20;
        const repere = petite && suivi.fiche?.activite ? await chercherComparables([{ code: suivi.fiche.codeActivite ?? "", libelle: suivi.fiche.activite, lien: "meme" }], suivi.fiche.region ?? undefined) : null;
        const comparables = repere ? direComparables(repere, REGIONS[suivi.fiche?.region ?? ""]) : undefined;
        const cedant: VendeurBriefing = {
          nom: suivi.societe.nom, siren: suivi.societe.siren, codeActivite: suivi.fiche?.codeActivite, ville: suivi.fiche?.ville, site: suivi.fiche?.site, metier: suivi.fiche?.activite,
          presentation: suivi.presentation, region: suivi.fiche?.region, effectif: suivi.fiche?.effectif, anneeCreation: suivi.fiche?.anneeCreation, finances: ficheVendeur?.finances ?? [],
        };
        // La présentation anonyme s'écrit en parallèle ; les briefings l'attendent, car c'est elle qui dit ce que fait la société.
        let presentationPrete: Promise<string | null> = Promise.resolve(suivi.presentation ?? null);
        const briefer = async (agent: number, p: Presentation, fiche: Societe | null, signaux: Signal[]) => {
          if (!iaActive()) return;
          cedant.presentation = (await presentationPrete.catch(() => null)) ?? cedant.presentation;
          dire({ type: "etape", agent, siren: p.siren, etape: "briefing" });
          const b = await ecrireBriefings(cedant, { societe: fiche, nom: p.nom, raisons: p.raisons ?? [], signaux, profil: p.profil }, comparables);
          // Dernier contrôle : la partie lue par le repreneur avant l'accord ne nomme pas le cédant. Dans le doute, elle est vidée.
          // Le briefing du cédant, lui, est gardé : seule la partie du repreneur est vidée.
          if (!briefingRepreneurSur(b.repreneur, cedant)) b.repreneur = { accroche: "", pourquoiVous: [], societe: [], rapprochement: [] };
          await enregistrerBriefings(jeton, p.siren, b).catch(() => false);
        };
        // Dossiers préparés avant l'arrivée des briefings : on les complète, sans refaire l'approche.
        const dejaEcrits = await lireTravail(jeton).catch(() => ({}) as Awaited<ReturnType<typeof lireTravail>>);
        const aCompleter = suivi.presentations.filter((p) => !p.exclu && p.canal !== "refus_demarchage" && etatDe(p) !== "a_faire" && !dejaEcrits[p.siren]?.briefing?.pourquoiVous?.length);

        const travailler = async (agent: number) => {
          for (let p = aFaire.shift(); p; p = aFaire.shift()) {
            try {
              dire({ type: "etape", agent, siren: p.siren, etape: "registre" });
              const fiche = await chercherSociete(p.siren);
              if (fiche?.refuseProspection) {
                await enregistrerApproche(jeton, p.siren, { refus: true });
                dire({ type: "refus", agent, siren: p.siren });
                continue;
              }
              let decideur = fiche ? choisirDecideur(fiche.dirigeants) : null;
              // Le dirigeant inscrit est une société : on remonte, sur deux niveaux au plus, à la personne qui la dirige.
              const chaine: string[] = [];
              for (let niveau = 0; niveau < 2 && decideur?.societe && decideur.siren; niveau++) {
                const holding = await chercherSociete(decideur.siren).catch(() => null);
                const suivant = holding ? choisirDecideur(holding.dirigeants) : null;
                if (!holding || !suivant) break;
                chaine.push(holding.nom);
                decideur = suivant.societe ? suivant : { nom: suivant.nom, qualite: `${suivant.qualite ?? "Dirigeant"} de ${chaine.at(-1)}, qui dirige la société` };
              }
              const qualite = decideur?.societe ? `${decideur.qualite ?? "Dirigeant"} (société : personne à identifier)` : decideur?.qualite;
              dire({ type: "decideur", agent, siren: p.siren, nom: decideur?.nom, qualite });

              // Veille : ce que le web dit de ce repreneur. Sans IA, ou si la recherche échoue, on continue sans.
              let veille: Awaited<ReturnType<typeof veiller>> = null;
              if (iaActive()) {
                dire({ type: "etape", agent, siren: p.siren, etape: "veille" });
                veille = await veiller({ nom: p.nom, siren: p.siren, ville: p.ville });
                dire({ type: "signaux", agent, siren: p.siren, site: veille?.site, signaux: veille?.signaux ?? [], requetes: veille?.requetes, pages: veille?.pages, ecartes: veille?.ecartes });
              }

              dire({ type: "etape", agent, siren: p.siren, etape: "redaction" });
              const { texte: redige, issue, problemes } = await redigerEtRelire({ repreneur: p.nom, decideur: decideur?.societe ? undefined : decideur?.nom, profil: p.profil, effectifVendeur: suivi.fiche?.effectif, raisons: p.raisons ?? [], signaux: veille?.signaux.filter((x) => x.genre !== "alerte").map((x) => x.texte), interdits });
              if (issue !== "modele") {
                dire({ type: "etape", agent, siren: p.siren, etape: "relecture" });
                dire({ type: "relecture", agent, siren: p.siren, issue, problemes });
              }
              const texte = `${lienFiche ? `${redige}\n\nPrésentation anonyme de la société, sans nom ni ville : ${lienFiche}` : redige}\n\n${MENTION_PROSPECTION}`;
              dire({ type: "message", agent, siren: p.siren, texte });

              dire({ type: "etape", agent, siren: p.siren, etape: "enregistrement" });
              const garde = await enregistrerApproche(jeton, p.siren, { decideur: decideur?.nom, qualite, message: texte, site: veille?.site, signaux: veille?.signaux });
              if (garde) await briefer(agent, p, fiche, veille?.signaux ?? []).catch(() => undefined);
              dire(garde ? { type: "pret", agent, siren: p.siren } : { type: "echec", agent, siren: p.siren });
            } catch {
              dire({ type: "echec", agent, siren: p.siren });
            }
          }
          for (let p = aCompleter.shift(); p; p = aCompleter.shift()) {
            const fiche = await chercherSociete(p.siren).catch(() => null);
            await briefer(agent, p, fiche, p.signaux ?? []).catch(() => undefined);
          }
        };
        // En parallèle des agents : la présentation anonyme de la société, écrite une fois à partir de son site.
        const presentation = async (): Promise<string | null> => {
          if (suivi.presentation) return suivi.presentation;
          if (!suivi.fiche?.site || !iaActive()) return null;
          dire({ type: "presentation", etat: "debut" });
          const site = await lireSite(suivi.fiche.site).catch(() => null);
          const texte = site ? await presenter(site.texte, { nom: suivi.societe.nom, ville: suivi.fiche.ville, site: suivi.fiche.site, activite: suivi.fiche.activite }) : null;
          if (texte && (await enregistrerPresentation(jeton, texte).catch(() => false))) {
            dire({ type: "presentation", etat: "prete", texte });
            return texte;
          }
          dire({ type: "presentation", etat: "sans" });
          return null;
        };

        presentationPrete = presentation().catch(() => null);
        await Promise.all([presentationPrete, ...Array.from({ length: AGENTS }, (_, i) => travailler(i + 1))]);
        await mesurer("approches_pretes", suivi.societe.siren);
        dire({ type: "fin" });
      } catch (e) {
        dire({ type: "erreur", message: e instanceof BaseIndisponible ? "Le dossier est momentanément indisponible. Rechargez la page dans quelques minutes." : "Un imprévu a interrompu la préparation. Rechargez la page." });
      } finally {
        await noterConsommation("atelier", String("atelier").replace(/\s/g, "").slice(0, 40), clore(releve));
        ouvert = false;
        controleur.close();
      }
    },
  });

  return new Response(flux, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
