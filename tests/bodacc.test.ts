import { describe, expect, it } from "vitest";
import { etatDesComptes, lireAnnonce } from "@/lib/bodacc";

const base = { id: "C202400123456", dateparution: "2024-07-12", registre: ["812 781 797", "812781797"] };

describe("annonces du bulletin officiel", () => {
  it("lit un dépôt de comptes confidentiel", () => {
    const a = lireAnnonce({ ...base, familleavis: "dpc", familleavis_lib: "Dépôts des comptes", depot: JSON.stringify({ dateCloture: "2023-12-31", typeDepot: "Comptes annuels et rapports", descriptif: "Les comptes annuels sont accompagnés d'une déclaration de confidentialité en application de l'article L. 232-25." }) }, "812781797")!;
    expect(a.genre).toBe("comptes");
    expect(a.confidentiel).toBe(true);
    expect(a.detail).toContain("31/12/2023");
    expect(a.url).toBe("https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:C202400123456");
  });
  it("lit une procédure collective", () => {
    const a = lireAnnonce({ ...base, id: "A202400999", familleavis: "collective", familleavis_lib: "Procédures collectives", jugement: { nature: "Jugement d'ouverture de liquidation judiciaire" } }, "812781797")!;
    expect(a.genre).toBe("procedure");
    expect(a.detail).toContain("liquidation");
  });
  it("écarte l'annonce d'une autre société", () => {
    expect(lireAnnonce({ ...base, registre: "123 456 789,123456789", familleavis: "vente" }, "812781797")).toBeNull();
  });
  it("écarte un enregistrement mal formé", () => {
    expect(lireAnnonce({ ...base, id: "<script>" }, "812781797")).toBeNull();
    expect(lireAnnonce({ ...base, dateparution: "hier" }, "812781797")).toBeNull();
  });
  it("résume l'état des comptes à partir du dépôt le plus récent", () => {
    const depot = (confidentiel: boolean) => ({ date: "2024-01-01", famille: "Dépôts des comptes", genre: "comptes" as const, confidentiel, url: "" });
    expect(etatDesComptes([])).toBe("aucun_depot");
    expect(etatDesComptes([depot(true), depot(false)])).toBe("confidentiels");
    expect(etatDesComptes([depot(false), depot(true)])).toBe("deposes");
  });
});
