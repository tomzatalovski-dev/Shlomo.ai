import type { DossierPoste, RepreneurPoste, StatutPresentation } from "../base";
import type { Dossier } from "./gardefous";
import type { Tour } from "./negociateur";

/** Étapes d'un repreneur, dans l'ordre. C'est la ligne unique que lisent le poste, le suivi du vendeur et le négociateur. */
export const ETAPES: [StatutPresentation, string][] = [
  ["identifie", "À contacter"],
  ["contacte", "Contacté"],
  ["relance", "Relancé"],
  ["a_repondu", "A répondu"],
  ["interesse", "Intéressé"],
  ["confidentialite_signee", "Confidentialité signée"],
  ["rendez_vous", "Rendez-vous"],
  ["offre", "Offre remise"],
  ["conclu", "Cession conclue"],
  ["sans_suite", "Sans suite"],
];

const EN_DISCUSSION: StatutPresentation[] = ["a_repondu", "interesse", "confidentialite_signee", "rendez_vous", "offre"];
const ACCORD: StatutPresentation[] = ["confidentialite_signee", "rendez_vous", "offre", "conclu"];

/**
 * Les faits que le négociateur et les garde-fous ont le droit d'utiliser pour ce repreneur.
 * Tout vient de la base : le nombre de repreneurs en discussion et d'offres est compté, jamais supposé.
 * Aucune fourchette n'est transmise tant que le vendeur n'en a pas validé une : aucun montant ne peut donc partir.
 */
export function dossierPour(d: DossierPoste, siren: string): Dossier | null {
  const lui = d.presentations.find((p) => p.siren === siren && !p.exclu);
  if (!lui) return null;
  const autres = d.presentations.filter((p) => !p.exclu && p.siren !== siren);
  return {
    vendeur: { nom: d.nom, ville: d.fiche?.ville ?? "", site: d.fiche?.site ?? undefined },
    activite: d.fiche?.activite ?? "",
    region: d.fiche?.region ?? "",
    effectif: d.fiche?.effectif ?? "",
    fourchette: null,
    accordSigne: ACCORD.includes(lui.statut),
    repreneursActifs: 1 + autres.filter((p) => EN_DISCUSSION.includes(p.statut)).length,
    offresRecues: d.presentations.filter((p) => !p.exclu && p.statut === "offre").length,
    echeance: null,
  };
}

/** La conversation telle qu'elle a réellement eu lieu : le premier message, puis ce qui a été reçu et envoyé. */
export function conversation(p: RepreneurPoste): Tour[] {
  const tours: Tour[] = [];
  if (p.message) tours.push({ de: "shlomo", texte: p.message });
  for (const e of p.echanges) if (e.etat === "recu" || e.etat === "envoye") tours.push({ de: e.de, texte: e.texte });
  return tours;
}
