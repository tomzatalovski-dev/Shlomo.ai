import { arrondir } from "./estimation";
import type { FicheAnonyme } from "./base";

const REGIONS: Record<string, string> = {
  "11": "Île-de-France", "24": "Centre-Val de Loire", "27": "Bourgogne-Franche-Comté", "28": "Normandie", "32": "Hauts-de-France",
  "44": "Grand Est", "52": "Pays de la Loire", "53": "Bretagne", "75": "Nouvelle-Aquitaine", "76": "Occitanie",
  "84": "Auvergne-Rhône-Alpes", "93": "Provence-Alpes-Côte d'Azur", "94": "Corse",
  "01": "Guadeloupe", "02": "Martinique", "03": "Guyane", "04": "La Réunion", "06": "Mayotte",
};

/** Ancienneté en tranche large : une année de création exacte aiderait à reconnaître la société. */
export function anciennete(anneeCreation: number, aujourdhui = new Date().getFullYear()): string {
  const age = aujourdhui - anneeCreation;
  if (age < 5) return "Moins de 5 ans";
  if (age < 10) return "Entre 5 et 10 ans";
  if (age < 20) return "Entre 10 et 20 ans";
  if (age < 40) return "Entre 20 et 40 ans";
  return "Plus de 40 ans";
}

/** Chiffre d'affaires à un seul chiffre significatif : 1 870 000 devient « environ 2 M€ ». */
export function ventesArrondies(montant: number): string {
  const pas = 10 ** Math.floor(Math.log10(montant));
  const rond = arrondir(Math.round(montant / pas) * pas);
  return rond >= 1_000_000 ? `Environ ${(rond / 1_000_000).toLocaleString("fr-FR")} M€` : `Environ ${Math.round(rond / 1_000).toLocaleString("fr-FR")} k€`;
}

/** Les lignes de la présentation anonyme. Une donnée absente n'est pas affichée. */
export function lignesFiche(f: FicheAnonyme, aujourdhui = new Date().getFullYear()): { libelle: string; valeur: string }[] {
  const lignes: { libelle: string; valeur: string }[] = [];
  lignes.push({ libelle: "Activité", valeur: f.activite || "Même métier que le vôtre, précisé lors de l'échange" });
  if (f.region && REGIONS[f.region]) lignes.push({ libelle: "Région", valeur: REGIONS[f.region] });
  if (f.effectif) lignes.push({ libelle: "Effectif", valeur: f.effectif });
  if (typeof f.anneeCreation === "number") lignes.push({ libelle: "Ancienneté", valeur: anciennete(f.anneeCreation, aujourdhui) });
  if (typeof f.chiffreAffaires === "number" && f.chiffreAffaires > 0) lignes.push({ libelle: "Chiffre d'affaires", valeur: ventesArrondies(f.chiffreAffaires) });
  if (f.resultatPositif === true) lignes.push({ libelle: "Résultat", valeur: "Positif au dernier exercice publié" });
  return lignes;
}
