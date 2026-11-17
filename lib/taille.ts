import type { Societe } from "./types";

/**
 * La taille d'une société se lit à deux endroits qui ne disent pas toujours la même chose :
 * le registre compte les salariés déclarés une année donnée ; le site compte souvent toute l'équipe, indépendants compris.
 * Quand l'écart est net, on ne laisse pas les deux chiffres se contredire à l'écran : on dit lequel sert à chercher, et pourquoi.
 */

const BORNES: [number, string][] = [[2, "01"], [5, "02"], [9, "03"], [19, "11"], [49, "12"], [99, "21"], [199, "22"], [249, "31"], [499, "32"], [999, "41"], [1999, "42"], [4999, "51"], [9999, "52"], [Infinity, "53"]];
const ORDRE = ["NN", "00", "01", "02", "03", "11", "12", "21", "22", "31", "32", "41", "42", "51", "52", "53"];

/** Tranche d'effectif de l'INSEE pour un nombre de personnes. */
export function trancheDe(personnes: number): string {
  return BORNES.find(([max]) => personnes <= max)![1];
}

/** Lit une taille déclarée : un entier entre 1 et 100 000, sinon rien. */
export function lireTaille(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,6}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : undefined;
}

/**
 * Vrai si le site annonce une équipe nettement plus grande que le registre : au moins deux tranches d'écart,
 * ou un registre muet. Un écart d'une tranche est du bruit (une embauche, une année de décalage).
 */
export function ecartNet(societe: Societe, annonce?: number): boolean {
  if (!annonce) return false;
  const registre = ORDRE.indexOf(societe.trancheEffectif ?? "NN");
  return ORDRE.indexOf(trancheDe(annonce)) - Math.max(registre, 1) >= 2 || registre <= 1;
}

/** La société telle qu'on la compare aux repreneurs : sa taille déclarée remplace celle du registre. Le reste ne bouge pas. */
export function avecTaille(societe: Societe, annonce?: number): Societe {
  return annonce ? { ...societe, trancheEffectif: trancheDe(annonce), effectif: `environ ${annonce} personnes` } : societe;
}

/** Retire les faits qui contredisent l'année de création du registre : on n'affiche pas deux dates de naissance. */
export function sansDateContraire<T extends { texte: string }>(faits: T[], anneeCreation?: number): T[] {
  if (!anneeCreation) return faits;
  return faits.filter((f) => {
    const m = f.texte.match(/(?:fond[ée]e?s?|cré[ée]e?s?|lanc[ée]e?s?|n[ée]e?|existe|depuis)\s+(?:en\s+|depuis\s+)?(\d{4})/i);
    return !m || Number(m[1]) === anneeCreation;
  });
}
