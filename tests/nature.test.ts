import { describe, expect, it } from "vitest";
import { natureDe } from "@/lib/nature";
import { mapperSociete } from "@/lib/registre";

describe("nature juridique", () => {
  it("laisse passer les sociétés commerciales et civiles", () => {
    for (const c of ["5710", "5499", "5599", "6540", "5785"]) expect(natureDe(c).horsParcours).toBeUndefined();
    expect(natureDe("5710").libelle).toBe("SAS");
  });

  it("nomme en clair une association de droit local et l'écarte", () => {
    const n = natureDe("9260");
    expect(n.libelle).toBe("Association de droit local (Alsace-Moselle)");
    expect(n.horsParcours).toMatch(/ne se vend pas/);
  });

  it("écarte ce qui n'est pas une société à céder", () => {
    for (const c of ["1000", "9220", "9300", "7210", "4110", "3120", "6220", "8410"]) expect(natureDe(c).horsParcours, c).toBeTruthy();
  });

  it("ne montre jamais un code brut", () => {
    for (const c of ["5458", "6316", "9900", "2110"]) expect(natureDe(c).libelle).not.toMatch(/\d/);
    expect(mapperSociete({ siren: "779982453", nature_juridique: "9260" }).formeJuridique).toBe("Association de droit local (Alsace-Moselle)");
    expect(mapperSociete({ siren: "779982453", nature_juridique: "9260" }).horsParcours).toBeTruthy();
  });
});
