import type { Societe } from "./types";

/**
 * Une société présidée ou gérée par une autre société n'est pas forcément à vendre par la personne qui est devant l'écran :
 * soit c'est sa propre holding et elle décide, soit c'est un groupe et la décision se prend ailleurs.
 * Le registre ne permet pas de trancher : on le dit, et on pose la question.
 */
const DIRIGE = /pr[ée]sident|g[ée]rant/i;
const NE_DIRIGE_PAS = /commissaire|suppl[ée]ant|vice|conseil de surveillance|d'administration/i;

/** Les sociétés qui président ou gèrent celle-ci. Liste vide quand un dirigeant personne physique tient ce rôle. */
export function societesQuiDirigent(societe: Societe): string[] {
  const tete = societe.dirigeants.filter((d) => DIRIGE.test(d.qualite ?? "") && !NE_DIRIGE_PAS.test(d.qualite ?? ""));
  if (tete.some((d) => !d.societe)) return [];
  return [...new Set(tete.filter((d) => d.societe).map((d) => d.nom))];
}
