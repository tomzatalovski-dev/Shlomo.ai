import { describe, expect, it } from "vitest";
import { societesQuiDirigent } from "@/lib/filiale";
import type { Societe } from "@/lib/types";

const soc = (dirigeants: Societe["dirigeants"]): Societe => ({ siren: "849195482", nom: "S", active: true, dirigeants, finances: [], source: "test" });

describe("filiale", () => {
  it("signale la société présidée par une autre société", () => {
    expect(societesQuiDirigent(soc([{ nom: "GROUPE X", qualite: "Président de SAS", societe: true }]))).toEqual(["GROUPE X"]);
    expect(societesQuiDirigent(soc([{ nom: "POLE Y", qualite: "Président de SAS", societe: true }, { nom: "GH INVEST", qualite: "Directeur Général", societe: true }]))).toEqual(["POLE Y"]);
  });

  it("ne signale rien quand une personne préside ou gère", () => {
    expect(societesQuiDirigent(soc([{ nom: "CLAUDE DURAND", qualite: "Président de SAS" }]))).toEqual([]);
    expect(societesQuiDirigent(soc([{ nom: "HOLDING", qualite: "Gérant", societe: true }, { nom: "CLAUDE DURAND", qualite: "Gérant" }]))).toEqual([]);
  });

  it("ignore le commissaire aux comptes, même s'il est une société", () => {
    expect(societesQuiDirigent(soc([{ nom: "CABINET Z", qualite: "Commissaire aux comptes titulaire", societe: true }, { nom: "CLAUDE DURAND", qualite: "Gérant" }]))).toEqual([]);
    expect(societesQuiDirigent(soc([]))).toEqual([]);
  });
});
