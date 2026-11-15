import type { DossierPoste, RepreneurPoste, StatutPresentation } from "../base";
import type { Dossier } from "./gardefous";
import type { Tour } from "./negociateur";
import { REGIONS } from "../fiche";

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

/**
 * Les faits que le négociateur et les garde-fous ont le droit d'utiliser pour ce repreneur.
 * Tout vient de la base : le nombre de repreneurs en discussion et d'offres est compté, jamais supposé.
 * La fourchette est celle que le vendeur a validée lui-même ; sans elle, aucun montant ne peut partir.
 * Le nom du vendeur n'est permis que si ce repreneur a signé l'accord et que le vendeur a donné son feu vert.
 */
export function dossierPour(d: DossierPoste, siren: string): Dossier | null {
  const lui = d.presentations.find((p) => p.siren === siren && !p.exclu);
  if (!lui) return null;
  const autres = d.presentations.filter((p) => !p.exclu && p.siren !== siren);
  return {
    vendeur: { nom: d.nom, ville: d.fiche?.ville ?? "", site: d.fiche?.site ?? undefined },
    activite: d.fiche?.activite ?? "",
    // Le registre donne un code de région : le négociateur reçoit le nom.
    region: REGIONS[d.fiche?.region ?? ""] ?? "",
    effectif: d.fiche?.effectif ?? "",
    fourchette: d.fourchette && d.fourchette.bas > 0 && d.fourchette.haut >= d.fourchette.bas ? { bas: d.fourchette.bas, haut: d.fourchette.haut } : null,
    accordSigne: Boolean(lui.accord) && lui.revelation === "autorisee",
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
