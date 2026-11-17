import { describe, expect, it } from "vitest";
import { avecTaille, ecartNet, lireTaille, sansDateContraire, trancheDe } from "@/lib/taille";
import type { Societe } from "@/lib/types";

const soc = (tranche?: string): Societe => ({ siren: "793842634", nom: "S", active: true, trancheEffectif: tranche, effectif: "10 à 19 salariés", dirigeants: [], finances: [], source: "test" });

describe("taille", () => {
  it("range un nombre de personnes dans sa tranche", () => {
    expect(trancheDe(1)).toBe("01");
    expect(trancheDe(15)).toBe("11");
    expect(trancheDe(70)).toBe("21");
    expect(trancheDe(250)).toBe("32");
  });

  it("ne retient qu'un écart net entre le site et le registre", () => {
    expect(ecartNet(soc("11"), 70)).toBe(true);
    expect(ecartNet(soc("11"), 25)).toBe(false);
    expect(ecartNet(soc("11"), undefined)).toBe(false);
    expect(ecartNet(soc(undefined), 8)).toBe(true);
    expect(ecartNet(soc("21"), 12)).toBe(false);
  });

  it("cherche à partir de la taille déclarée, sans toucher au reste", () => {
    const s = avecTaille(soc("11"), 70);
    expect(s.trancheEffectif).toBe("21");
    expect(s.effectif).toBe("environ 70 personnes");
    expect(avecTaille(soc("11"))).toEqual(soc("11"));
  });

  it("n'accepte qu'un entier plausible", () => {
    expect(lireTaille("70")).toBe(70);
    expect(lireTaille(70)).toBe(70);
    expect(lireTaille("0")).toBeUndefined();
    expect(lireTaille("70 personnes")).toBeUndefined();
    expect(lireTaille("9999999")).toBeUndefined();
  });

  it("retire le fait qui donne une autre année de création que le registre", () => {
    const faits = [{ texte: "Le studio affirme avoir été fondé en 2008 par deux associés." }, { texte: "Son site présente des publicités pour Oasis." }, { texte: "Créée en 2013 à Paris." }];
    expect(sansDateContraire(faits, 2013).map((f) => f.texte)).toEqual([faits[1].texte, faits[2].texte]);
    expect(sansDateContraire(faits)).toHaveLength(3);
  });
});
