import { describe, expect, it } from "vitest";
import { choisirDecideur, citeLeVendeur, messageModele, nomLisible } from "@/lib/approche";

describe("décideur", () => {
  it("préfère le président au directeur général", () => {
    const d = choisirDecideur([{ nom: "PAUL MARTIN", qualite: "Directeur Général" }, { nom: "ANNE-LISE D'ORMESSON", qualite: "Président de SAS" }]);
    expect(d).toEqual({ nom: "Anne-Lise D'Ormesson", qualite: "Président de SAS" });
  });
  it("prend le premier dirigeant à défaut, et rien s'il n'y en a pas", () => {
    expect(choisirDecideur([{ nom: "JEAN DUPONT" }])?.nom).toBe("Jean Dupont");
    expect(choisirDecideur([])).toBeNull();
  });
  it("préfère une personne à une société dirigeante, et signale une société seule", () => {
    expect(choisirDecideur([{ nom: "TESSI", qualite: "Président de SAS", societe: true }, { nom: "MARIE DURAND", qualite: "Directeur Général" }])).toEqual({ nom: "Marie Durand", qualite: "Directeur Général" });
    expect(choisirDecideur([{ nom: "TESSI", qualite: "Président de SAS", societe: true }])).toEqual({ nom: "TESSI", qualite: "Président de SAS", societe: true });
  });
  it("retire le nom d'usage entre parenthèses", () => expect(nomLisible("ERIC VIALATOUX (VIALATOUX)")).toBe("Eric Vialatoux"));
  it("met les noms en forme", () => expect(nomLisible("ÉLODIE DE LA TOUR")).toBe("Élodie De La Tour"));
});

describe("message", () => {
  const faits = { repreneur: "MENUISERIE DURAND", decideur: "Jean Durand", profil: "region", effectifVendeur: "10 à 19 salariés", raisons: ["Environ 4 fois votre effectif"], interdits: ["ATELIER MOREL", "Annecy"] };
  it("ne cite jamais le vendeur dans le modèle", () => {
    const m = messageModele(faits);
    expect(citeLeVendeur(m, faits.interdits)).toBe(false);
    expect(m).toContain("Bonjour Jean Durand,");
    expect(m).toContain("dans une région où vous êtes implanté");
  });
  it("repère un texte qui cite le vendeur", () => {
    expect(citeLeVendeur("La société Atelier Morel est à céder.", faits.interdits)).toBe(true);
    expect(citeLeVendeur("Une société basée à ANNECY.", faits.interdits)).toBe(true);
  });
});

import { lireRelecture } from "@/lib/approche";

describe("relecture par un second agent", () => {
  it("lit un verdict bien formé", () => {
    expect(lireRelecture('{"verdict":"valide","problemes":[]}')).toEqual({ verdict: "valide", problemes: [] });
    expect(lireRelecture('Voici : {"verdict":"a_corriger","problemes":["Le message dit Monsieur."]}')).toEqual({ verdict: "a_corriger", problemes: ["Le message dit Monsieur."] });
  });
  it("ne tient jamais une réponse illisible pour une validation", () => {
    expect(lireRelecture(null)).toBeNull();
    expect(lireRelecture("tout va bien")).toBeNull();
    expect(lireRelecture('{"verdict":"parfait"}')).toBeNull();
    expect(lireRelecture('{"verdict":"a_corriger","problemes":[]}')).toBeNull();
  });
});
