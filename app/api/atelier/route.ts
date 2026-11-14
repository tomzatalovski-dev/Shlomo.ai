import { chercherSociete } from "@/lib/registre";
import { BaseIndisponible, enregistrerApproche, jetonValide, lireSuivi, type Presentation } from "@/lib/base";
import { choisirDecideur, redigerMessage } from "@/lib/approche";
import { veiller } from "@/lib/veille";
import { iaActive } from "@/lib/ia";
import { adresseDe, tropDappels } from "@/lib/limite";
import type { EvenementAtelier, LigneAtelier } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AGENTS = 3;

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
      let ouvert = true;
      const dire = (e: EvenementAtelier) => {
        if (ouvert) controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        if (!jetonValide(jeton)) return dire({ type: "erreur", message: "Ce lien n'est pas reconnu." });
        if (tropDappels(`atelier:${adresseDe(requete)}`, 6)) return dire({ type: "erreur", message: "Trop de demandes en peu de temps. Réessayez dans une minute." });

        const suivi = await lireSuivi(jeton);
        if (!suivi) return dire({ type: "erreur", message: "Ce lien n'est pas reconnu." });
        if (!suivi.mandat?.autorisation_approche) return dire({ type: "erreur", message: "Vous n'avez pas autorisé l'approche : aucun message n'est préparé." });

        dire({
          type: "plan",
          societe: suivi.societe.nom,
          lignes: suivi.presentations.map((p) => ({ siren: p.siren, nom: p.nom, rang: p.rang, ville: p.ville, effectif: p.effectif, etat: etatDe(p), decideur: p.decideur, qualite: p.qualite, message: p.message, site: p.site, signaux: p.signaux })),
        });

        const aFaire = suivi.presentations.filter((p) => etatDe(p) === "a_faire");
        const interdits = [suivi.societe.nom, suivi.fiche?.ville ?? ""].filter(Boolean);

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
              const decideur = fiche ? choisirDecideur(fiche.dirigeants) : null;
              dire({ type: "decideur", agent, siren: p.siren, nom: decideur?.nom, qualite: decideur?.societe ? `${decideur.qualite ?? "Dirigeant"} (société : personne à identifier)` : decideur?.qualite });

              // Veille : ce que le web dit de ce repreneur. Sans IA, ou si la recherche échoue, on continue sans.
              let veille: Awaited<ReturnType<typeof veiller>> = null;
              if (iaActive()) {
                dire({ type: "etape", agent, siren: p.siren, etape: "veille" });
                veille = await veiller({ nom: p.nom, siren: p.siren, ville: p.ville });
                dire({ type: "signaux", agent, siren: p.siren, site: veille?.site, signaux: veille?.signaux ?? [] });
              }

              dire({ type: "etape", agent, siren: p.siren, etape: "redaction" });
              const texte = await redigerMessage({ repreneur: p.nom, decideur: decideur?.societe ? undefined : decideur?.nom, profil: p.profil, effectifVendeur: suivi.fiche?.effectif, raisons: p.raisons ?? [], signaux: veille?.signaux.map((x) => x.texte), interdits });
              dire({ type: "message", agent, siren: p.siren, texte });

              dire({ type: "etape", agent, siren: p.siren, etape: "enregistrement" });
              const garde = await enregistrerApproche(jeton, p.siren, { decideur: decideur?.nom, qualite: decideur?.societe ? `${decideur.qualite ?? "Dirigeant"} (société : personne à identifier)` : decideur?.qualite, message: texte, site: veille?.site, signaux: veille?.signaux });
              dire(garde ? { type: "pret", agent, siren: p.siren } : { type: "echec", agent, siren: p.siren });
            } catch {
              dire({ type: "echec", agent, siren: p.siren });
            }
          }
        };
        await Promise.all(Array.from({ length: AGENTS }, (_, i) => travailler(i + 1)));
        dire({ type: "fin" });
      } catch (e) {
        dire({ type: "erreur", message: e instanceof BaseIndisponible ? "Le dossier est momentanément indisponible. Rechargez la page dans quelques minutes." : "Un imprévu a interrompu la préparation. Rechargez la page." });
      } finally {
        ouvert = false;
        controleur.close();
      }
    },
  });

  return new Response(flux, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
