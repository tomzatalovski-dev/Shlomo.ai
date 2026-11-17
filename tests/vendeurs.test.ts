import { describe, expect, it } from "vitest";
import { lireVendeurProbable, ordonnerVendeurs } from "@/lib/vendeurs";

const brut = (dirigeants: Record<string, unknown>[], plus: Record<string, unknown> = {}) => ({ siren: "123456782", nom_complet: "ATELIER TEST", nature_juridique: "5710", etat_administratif: "A", date_creation: "1998-03-01", tranche_effectif_salarie: "12", dirigeants, ...plus });
const pp = (qualite: string, annee: string, nom = "DURAND") => ({ type_dirigeant: "personne physique", qualite, annee_de_naissance: annee, nom, prenoms: "CLAUDE" });

describe("vendeurs probables", () => {
  it("retient un seul dirigeant de plus de 60 ans, priorité forte", () => {
    const v = lireVendeurProbable(brut([pp("Président de SAS", "1958")]), 2026)!;
    expect(v.priorite).toBe("forte");
    expect(v.indices).toEqual(["Dirigeant de 68 ans environ", "Seul dirigeant, pas de relève visible au registre", "Société créée il y a 28 ans"]);
  });

  it("baisse la priorité quand un dirigeant plus jeune est déjà en place", () => {
    const v = lireVendeurProbable(brut([pp("Gérant", "1960"), pp("Gérant", "1988", "DURAND FILS")]), 2026)!;
    expect(v.priorite).toBe("moyenne");
    expect(v.dirigeants.map((d) => d.naissance)).toEqual([1960, 1988]);
  });

  it("ne compte pas le commissaire aux comptes ni le suppléant comme dirigeants", () => {
    expect(lireVendeurProbable(brut([pp("Commissaire aux comptes suppléant", "1949"), pp("Directeur Général", "1975")]), 2026)).toBeNull();
  });

  it("écarte la société qui refuse le démarchage, l'association et la société cessée", () => {
    expect(lireVendeurProbable(brut([pp("Gérant", "1955")], { opposition_diffusion_commerciale: true }), 2026)).toBeNull();
    expect(lireVendeurProbable(brut([pp("Président", "1955")], { nature_juridique: "9220" }), 2026)).toBeNull();
    expect(lireVendeurProbable(brut([pp("Gérant", "1955")], { etat_administratif: "C" }), 2026)).toBeNull();
  });

  it("signale la société tenue par une autre", () => {
    const v = lireVendeurProbable(brut([{ type_dirigeant: "personne morale", qualite: "Président de SAS", denomination: "HOLDING X" }, pp("Directeur Général", "1957")]), 2026)!;
    expect(v.tenueParUneSociete).toBe(true);
    expect(v.priorite).toBe("moyenne");
  });

  it("classe la priorité forte d'abord, puis le plus âgé", () => {
    const a = lireVendeurProbable(brut([pp("Gérant", "1962")]), 2026)!;
    const b = lireVendeurProbable(brut([pp("Gérant", "1950")]), 2026)!;
    const c = lireVendeurProbable(brut([pp("Gérant", "1945"), pp("Gérant", "1990", "X")]), 2026)!;
    expect(ordonnerVendeurs([a, c, b]).map((v) => v.dirigeants[0].naissance)).toEqual([1950, 1962, 1945]);
  });
});
