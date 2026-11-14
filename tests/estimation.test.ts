import { describe, expect, it } from "vitest";
import { arrondir, estimer } from "@/lib/estimation";

describe("ordre de grandeur de valeur", () => {
  it("arrondit à deux chiffres significatifs", () => {
    expect(arrondir(437_500)).toBe(440_000);
    expect(arrondir(1_260_000)).toBe(1_300_000);
    expect(arrondir(0)).toBe(0);
  });
  it("prend la moyenne des trois derniers résultats publiés, fois 4 à 8", () => {
    const e = estimer([
      { annee: 2020, resultat: 900_000 },
      { annee: 2021, resultat: 100_000 },
      { annee: 2022, chiffreAffaires: 2_000_000 },
      { annee: 2023, resultat: 200_000 },
      { annee: 2024, resultat: 150_000 },
    ]);
    expect(e).toEqual({ possible: true, bas: 600_000, haut: 1_200_000, resultatMoyen: 150_000, annees: [2021, 2023, 2024] });
  });
  it("ne donne aucun chiffre sans comptes ou avec un résultat négatif", () => {
    expect(estimer([])).toEqual({ possible: false, raison: "sans_comptes" });
    expect(estimer([{ annee: 2024, chiffreAffaires: 500_000 }])).toEqual({ possible: false, raison: "sans_comptes" });
    expect(estimer([{ annee: 2024, resultat: -20_000 }])).toEqual({ possible: false, raison: "resultat_negatif" });
  });
});
