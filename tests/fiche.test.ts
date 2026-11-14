import { describe, expect, it } from "vitest";
import { anciennete, lignesFiche, ventesArrondies } from "@/lib/fiche";

describe("présentation anonyme", () => {
  it("arrondit le chiffre d'affaires à un chiffre", () => {
    expect(ventesArrondies(1_870_000)).toBe("Environ 2 M€");
    expect(ventesArrondies(640_000)).toBe("Environ 600 k€");
  });
  it("donne l'ancienneté en tranche, jamais l'année", () => {
    expect(anciennete(2001, 2026)).toBe("Entre 20 et 40 ans");
    expect(anciennete(2023, 2026)).toBe("Moins de 5 ans");
  });
  it("n'affiche que ce qui est connu, et rien qui nomme la société", () => {
    const lignes = lignesFiche({ activite: "Menuiserie", region: "84", effectif: "10 à 19 salariés", anneeCreation: 2001, chiffreAffaires: 1_870_000, resultatPositif: true }, 2026);
    expect(lignes.map((l) => l.libelle)).toEqual(["Activité", "Région", "Effectif", "Ancienneté", "Chiffre d'affaires", "Résultat"]);
    expect(lignes[1].valeur).toBe("Auvergne-Rhône-Alpes");
    expect(JSON.stringify(lignes)).not.toContain("2001");
    expect(lignesFiche({}).map((l) => l.libelle)).toEqual(["Activité"]);
  });
});
