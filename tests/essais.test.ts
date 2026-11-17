import { describe, expect, it } from "vitest";
import { CAS, controlerFiche, controlerRepreneurs } from "@/lib/essais";
import { noter } from "@/lib/repreneurs";
import { mapperSociete } from "@/lib/registre";
import type { Societe } from "@/lib/types";

const soc = (siren: string, plus: Partial<Societe> = {}): Societe => ({ siren, nom: `S${siren}`, active: true, formeJuridique: "SAS", trancheEffectif: "12", effectif: "20 à 49 salariés", dirigeants: [], finances: [], source: "test", ...plus });
const vendeur = soc("100000009", { trancheEffectif: "11" });
const cessible = CAS.find((c) => c.attendu === "cessible" && c.minimum)!;

describe("banc d'essai", () => {
  it("n'a que des SIREN bien formés et distincts", () => {
    expect(CAS.every((c) => /^\d{9}$/.test(c.siren))).toBe(true);
    expect(new Set(CAS.map((c) => c.siren)).size).toBe(CAS.length);
  });

  it("valide une association annoncée comme ne se vendant pas, et signale celle qui passerait", () => {
    const asso = CAS.find((c) => c.attendu === "hors_parcours")!;
    expect(controlerFiche(asso, mapperSociete({ siren: asso.siren, nature_juridique: "9260", etat_administratif: "A" })).every((c) => c.ok)).toBe(true);
    expect(controlerFiche(asso, soc(asso.siren)).some((c) => !c.ok)).toBe(true);
    expect(controlerFiche(asso, null)[0].ok).toBe(false);
  });

  it("laisse passer une liste saine", () => {
    const liste = [soc("200000007", { etablissements: 3 }), soc("300000005", { anneeCreation: 1990 }), soc("400000003", { trancheEffectif: "21" })].map((s) => noter(vendeur, s, "departement")).sort((a, b) => b.score - a.score);
    liste[1] = { ...liste[1], raisons: ["Autre titre", ...liste[1].raisons] };
    liste[2] = { ...liste[2], raisons: ["Troisième titre", ...liste[2].raisons] };
    const controles = controlerRepreneurs({ ...cessible, minimum: 3 }, vendeur, liste);
    expect(controles.filter((c) => !c.ok)).toEqual([]);
  });

  it("attrape un repreneur plus petit, un doublon de titre, un défaut vendu comme argument et un vieux chiffre", () => {
    const petit = noter(vendeur, soc("200000007", { trancheEffectif: "02" }), "departement");
    const double = { ...noter(vendeur, soc("300000005"), "departement"), raisons: [petit.raisons[0]] };
    const defaut = { ...noter(vendeur, soc("400000003"), "departement"), raisons: ["Résultat négatif publié en 2025"] };
    const vieux = { ...noter(vendeur, soc("500000001"), "departement"), raisons: ["Rentable : 12 % de marge nette en 2017"] };
    const rates = controlerRepreneurs(cessible, vendeur, [petit, double, defaut, vieux], 2026).filter((c) => !c.ok).map((c) => c.nom);
    expect(rates).toContain("Aucun repreneur plus petit que le vendeur");
    expect(rates).toContain("Pas deux fois le même titre");
    expect(rates).toContain("Aucun défaut présenté comme un argument");
    expect(rates).toContain("Aucun chiffre de plus de trois ans");
  });
});
