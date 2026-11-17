import { describe, expect, it } from "vitest";
import { extraitPour, lireVerdicts, motsPropres } from "@/lib/relecture";

describe("relecture des faits", () => {
  it("repère les mots propres d'un fait", () => {
    expect(motsPropres("Une publicité pour Grenelle, réalisée avec le réalisateur NoBrain en 2019.")).toEqual(["publicite", "grenelle", "realisateur", "nobrain", "2019"]);
  });

  it("trouve le passage de la page qui porte le fait", () => {
    const page = `${"Lorem ipsum ".repeat(300)} Le spot Grenelle a été réalisé par NoBrain pour l'agence. ${"dolor sit ".repeat(300)}`;
    const e = extraitPour(page, "Une publicité pour Grenelle, réalisée avec NoBrain.");
    expect(e).toContain("Grenelle a été réalisé par NoBrain");
    expect(e.length).toBeLessThan(3000);
  });

  it("rend une chaîne vide quand rien du fait n'est sur la page", () => {
    expect(extraitPour("Bienvenue sur notre site de plomberie à Lyon.", "Le studio a travaillé pour Hermès et Cartier en 2021.")).toBe("");
  });

  it("lit les verdicts du second passage, et rien d'autre", () => {
    expect(lireVerdicts('{"verdicts":[{"n":1,"ecrit":true},{"n":2,"ecrit":false},{"n":9,"ecrit":false}]}', 3)).toEqual([true, false, undefined]);
    expect(lireVerdicts("pas de json", 2)).toEqual([undefined, undefined]);
    expect(lireVerdicts(null, 1)).toEqual([undefined]);
  });
});
