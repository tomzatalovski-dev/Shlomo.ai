import { describe, expect, it } from "vitest";
import { mapperSociete } from "@/lib/registre";

describe("mapperSociete", () => {
  it("transforme une réponse complète du registre", () => {
    const s = mapperSociete({
      siren: "123456782",
      nom_complet: "ATELIER EXEMPLE",
      nature_juridique: "5710",
      date_creation: "2009-03-12",
      activite_principale: "43.32A",
      tranche_effectif_salarie: "11",
      annee_tranche_effectif_salarie: "2023",
      etat_administratif: "A",
      siege: { libelle_commune: "LYON", code_postal: "69003" },
      dirigeants: [{ nom: "DUPONT", prenoms: "Claire", qualite: "Présidente" }, { denomination: "HOLDING X", qualite: "Associé" }],
      finances: { "2023": { ca: 1800000, resultat_net: 160000 }, "2022": { ca: 1500000, resultat_net: null } },
    });
    expect(s).toMatchObject({ nom: "ATELIER EXEMPLE", active: true, formeJuridique: "SAS", anneeCreation: 2009, effectif: "10 à 19 salariés", ville: "LYON" });
    expect(s.dirigeants).toEqual([{ nom: "Claire DUPONT", qualite: "Présidente" }, { nom: "HOLDING X", qualite: "Associé", societe: true }]);
    expect(s.finances).toEqual([{ annee: 2022, chiffreAffaires: 1500000, resultat: undefined }, { annee: 2023, chiffreAffaires: 1800000, resultat: 160000 }]);
  });
  it("n'invente rien quand le registre ne dit rien", () => {
    const s = mapperSociete({ siren: "123456782", etat_administratif: "C" });
    expect(s.active).toBe(false);
    expect(s.anneeCreation).toBeUndefined();
    expect(s.effectif).toBeUndefined();
    expect(s.dirigeants).toEqual([]);
    expect(s.finances).toEqual([]);
  });
});

describe("dirigeants", () => {
  it("ne compte pas les commissaires aux comptes parmi les dirigeants", () => {
    const s = mapperSociete({ siren: "123456782", dirigeants: [{ nom: "DUPONT", prenoms: "Claire", qualite: "Présidente de SAS" }, { denomination: "CABINET X", qualite: "Commissaire aux comptes titulaire" }] });
    expect(s.dirigeants).toEqual([{ nom: "Claire DUPONT", qualite: "Présidente de SAS" }]);
  });
});
