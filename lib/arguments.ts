import type { Societe } from "./types";

const milliers = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")} M€` : `${Math.round(n / 1000)} k€`);

/**
 * Ce que le registre prouve et qui compte pour un repreneur. Aucune IA : chaque ligne se relit dans les tuiles de la fiche.
 * C'est la base des arguments quand la société n'a pas de site.
 */
export function argumentsDuRegistre(societe: Societe, annee = new Date().getFullYear()): string[] {
  const lignes: string[] = [];
  const age = societe.anneeCreation ? annee - societe.anneeCreation : 0;
  if (age >= 10) lignes.push(`${age} ans d'activité, créée en ${societe.anneeCreation}`);
  const publies = societe.finances.filter((f) => f.resultat !== undefined);
  const dernier = publies.at(-1);
  if (dernier && (dernier.resultat ?? 0) > 0) {
    const tous = publies.length >= 2 && publies.every((f) => (f.resultat ?? 0) > 0);
    lignes.push(tous ? `Résultat net positif ${publies.length} années de suite, ${milliers(dernier.resultat!)} en ${dernier.annee}` : `Résultat net de ${milliers(dernier.resultat!)} en ${dernier.annee}`);
  }
  const ca = societe.finances.filter((f) => f.chiffreAffaires);
  if (ca.length >= 2 && ca.at(-1)!.chiffreAffaires! > ca[0].chiffreAffaires! * 1.05) lignes.push(`Chiffre d'affaires en hausse de ${ca[0].annee} à ${ca.at(-1)!.annee}`);
  if (societe.effectif && /^\d/.test(societe.effectif) && !/^0\b/.test(societe.effectif)) lignes.push(`Équipe en place : ${societe.effectif}`);
  if ((societe.etablissements ?? 0) >= 2) lignes.push(`${societe.etablissements} établissements ouverts`);
  return lignes;
}

const cle = (t: string) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "");
/** Un argument de l'IA qui redit une ligne du registre (ancienneté, création) n'ajoute rien. */
const redit = (point: string) => /\b(depuis|cree|creee|creation|etabli|fonde|ans d)\b/.test(cle(point)) && /\b(19|20)\d\d\b|\bans\b/.test(point);

/**
 * Les quatre arguments montrés au vendeur. Avec un site, ce qu'il dit passe d'abord ; sans site, le registre passe d'abord.
 */
export function composerArguments(registre: string[], ia: string[], avecSite: boolean): string[] {
  const propres = ia.filter((p) => !redit(p));
  const ordre = avecSite ? [...propres.slice(0, 3), ...registre, ...propres.slice(3)] : [...registre.slice(0, 3), ...propres, ...registre.slice(3)];
  const vus = new Set<string>();
  return ordre.filter((p) => (vus.has(cle(p)) ? false : (vus.add(cle(p)), true))).slice(0, 4);
}
