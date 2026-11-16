import { describe, expect, it } from "vitest";
import { direBilan, environ, extraire, montant } from "@/lib/bilan";

const complet = [
  { numero: "01", liasses: [{ code: "CF", m1: "000002100000", m3: "000002100000" }, { code: "CD", m3: "400000" }] },
  { numero: "02", liasses: [{ code: "DL", m1: "3000000", m2: "2500000" }, { code: "DU", m1: "800000" }, { code: "DV", m1: "200000" }, { code: "EE", m1: "7500000" }] },
];

describe("bilan", () => {
  it("lit un montant de liasse, zéros et signe compris", () => {
    expect(montant("000000012345")).toBe(12345);
    expect(montant("-500")).toBe(-500);
    expect(montant("")).toBeUndefined();
    expect(montant("abc")).toBeUndefined();
  });

  it("tire trésorerie, capitaux propres et dettes de comptes complets", () => {
    expect(extraire("C", "2024-12-31", complet)).toEqual({ annee: 2024, tresorerie: 2_500_000, capitauxPropres: 3_000_000, dettesFinancieres: 1_000_000, totalBilan: 7_500_000 });
  });

  it("lit les comptes simplifiés dans leurs propres colonnes", () => {
    const pages = [{ numero: "01", liasses: [{ code: "084", m3: "90000" }, { code: "142", m3: "150000", m1: "1" }, { code: "156", m3: "40000" }, { code: "180", m3: "400000" }] }];
    expect(extraire("S", "2025-06-30", pages)).toEqual({ annee: 2025, tresorerie: 90_000, capitauxPropres: 150_000, dettesFinancieres: 40_000, totalBilan: 400_000 });
  });

  it("ne lit pas un format qu'il ne connaît pas, ni une liasse vide", () => {
    expect(extraire("K", "2024-12-31", complet)).toBeNull();
    expect(extraire("C", "2024-12-31", [])).toBeNull();
    expect(extraire("C", undefined, complet)).toBeNull();
  });

  it("arrondit les montants pour qu'ils ne désignent pas la société", () => {
    expect(environ(2_543_210)).toBe("2,5 M€");
    expect(environ(87_400)).toBe("87 k€");
    expect(environ(-1_260_000)).toBe("-1,3 M€");
  });

  it("fait un titre quand la trésorerie couvre les dettes", () => {
    const l = direBilan({ annee: 2024, tresorerie: 2_500_000, capitauxPropres: 3_000_000, dettesFinancieres: 1_000_000, totalBilan: 7_500_000 });
    expect(l.titre).toBe("Environ 2,5 M€ de trésorerie fin 2024, plus que ses dettes financières");
    expect(l.lignes).toContain("Capitaux propres : environ 3 M€, soit 40 % du bilan");
    expect(l.reserves).toEqual([]);
  });

  it("ne fait pas de titre et pose une réserve quand le bilan est fragile", () => {
    const negatif = direBilan({ annee: 2024, tresorerie: 500_000, capitauxPropres: -200_000, dettesFinancieres: 100_000 });
    expect(negatif.titre).toBeUndefined();
    expect(negatif.reserves).toEqual(["Capitaux propres négatifs fin 2024"]);
    const charge = direBilan({ annee: 2024, tresorerie: 5_000_000, capitauxPropres: 1_000_000, dettesFinancieres: 4_000_000 });
    expect(charge.titre).toBeUndefined();
    expect(charge.reserves[0]).toMatch(/trois fois/);
  });

  it("ne fait pas de titre quand les dettes dépassent la trésorerie", () => {
    expect(direBilan({ annee: 2024, tresorerie: 300_000, capitauxPropres: 2_000_000, dettesFinancieres: 900_000 }).titre).toBeUndefined();
  });
});
