import { describe, expect, it } from "vitest";
import { classer, masquer, noter, retenable, tranchesAuDessus } from "@/lib/repreneurs";
import type { Societe } from "@/lib/types";

const base: Societe = { siren: "100000009", nom: "VENDEUR", active: true, codeActivite: "43.32A", trancheEffectif: "11", effectif: "10 à 19 salariés", dirigeants: [], finances: [{ annee: 2023, chiffreAffaires: 1_800_000, resultat: 160_000 }], source: "test" };
const soc = (siren: string, plus: Partial<Societe> = {}): Societe => ({ ...base, siren, nom: `SOCIETE ${siren}`, ville: "LYON", trancheEffectif: "12", effectif: "20 à 49 salariés", finances: [], ...plus });

describe("repreneurs", () => {
  it("ne garde que les tranches au-dessus de celle du vendeur", () => {
    expect(tranchesAuDessus("11")[0]).toBe("12");
    expect(tranchesAuDessus("53")).toEqual([]);
    expect(tranchesAuDessus(undefined)[0]).toBe("11");
  });

  it("écarte le vendeur, les sociétés cessées, les indépendants et celles qui refusent la prospection", () => {
    expect(retenable(base, soc(base.siren))).toBe(false);
    expect(retenable(base, soc("200000007", { active: false }))).toBe(false);
    expect(retenable(base, soc("200000007", { entrepreneurIndividuel: true }))).toBe(false);
    expect(retenable(base, soc("200000007", { refuseProspection: true }))).toBe(false);
    expect(retenable(base, soc("200000007"))).toBe(true);
  });

  it("note mieux un voisin rentable qu'un groupe lointain sans comptes", () => {
    const voisin = noter(base, soc("200000007", { finances: [{ annee: 2023, chiffreAffaires: 6_000_000, resultat: 300_000 }] }), "departement");
    const lointain = noter(base, soc("300000005", { trancheEffectif: "42" }), "national");
    expect(voisin.score).toBeGreaterThan(lointain.score);
    expect(voisin.raisons).toContain("Résultat positif publié en 2023");
    expect(voisin.raisons).toContain("Chiffre d'affaires au moins trois fois supérieur au vôtre");
  });

  it("classe sans doublon et limite à dix", () => {
    const beaucoup = Array.from({ length: 14 }, (_, i) => soc(String(400000000 + i)));
    const liste = classer(base, [{ profil: "departement", societes: beaucoup }, { profil: "region", societes: beaucoup }]);
    expect(liste).toHaveLength(10);
    expect(new Set(liste.map((r) => r.societe.siren)).size).toBe(10);
    expect(liste.every((r) => r.profil === "departement")).toBe(true);
  });

  it("ne laisse sortir ni nom, ni SIREN, ni ville", () => {
    const masques = masquer(classer(base, [{ profil: "departement", societes: [soc("200000007")] }]));
    const texte = JSON.stringify(masques);
    expect(texte).not.toContain("200000007");
    expect(texte).not.toContain("SOCIETE");
    expect(texte).not.toContain("LYON");
    expect(masques[0]).toMatchObject({ rang: 1, zone: "Dans votre département" });
  });
});
