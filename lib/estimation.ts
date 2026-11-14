import type { ExerciceFinancier } from "./types";

/**
 * Ordre de grandeur de la valeur d'une société, à partir de ses seuls résultats publiés.
 * Méthode : résultat net moyen des derniers exercices publiés, multiplié par 4 à 8.
 * Ce n'est pas une évaluation : ni la trésorerie, ni les dettes, ni la rémunération du dirigeant ne sont prises en compte.
 */
export const MULTIPLE_BAS = 4;
export const MULTIPLE_HAUT = 8;

export type Estimation =
  | { possible: true; bas: number; haut: number; resultatMoyen: number; annees: number[] }
  | { possible: false; raison: "sans_comptes" | "resultat_negatif" };

/** Arrondit à deux chiffres significatifs : 437 500 devient 440 000. */
export function arrondir(montant: number): number {
  if (montant <= 0) return 0;
  const pas = 10 ** Math.max(0, Math.floor(Math.log10(montant)) - 1);
  return Math.round(montant / pas) * pas;
}

/** Fourchette pour un résultat net annuel donné. */
export function fourchette(resultatMoyen: number): { bas: number; haut: number } {
  return { bas: arrondir(resultatMoyen * MULTIPLE_BAS), haut: arrondir(resultatMoyen * MULTIPLE_HAUT) };
}

export function estimer(finances: ExerciceFinancier[]): Estimation {
  const publies = finances.filter((f) => f.resultat !== undefined).slice(-3);
  if (publies.length === 0) return { possible: false, raison: "sans_comptes" };
  const resultatMoyen = publies.reduce((somme, f) => somme + f.resultat!, 0) / publies.length;
  if (resultatMoyen <= 0) return { possible: false, raison: "resultat_negatif" };
  return { possible: true, ...fourchette(resultatMoyen), resultatMoyen: Math.round(resultatMoyen), annees: publies.map((f) => f.annee) };
}
