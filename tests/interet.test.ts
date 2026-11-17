import { describe, expect, it } from "vitest";
import { interetAcceptable, type ContexteRepreneur } from "@/lib/interet";

const r: ContexteRepreneur = { nom: "MIKROS IMAGE (MIKROS)", ville: "LEVALLOIS-PERRET", lien: "Même activité, votre région", effectif: "500 à 999 salariés", raisons: ["Rentable : 8,3 % de marge nette en 2024"], annonces: [] };
const elements = JSON.stringify(r);

describe("intérêt du repreneur", () => {
  it("accepte une phrase propre aux deux sociétés", () => {
    expect(interetAcceptable("Elle ajouterait à son offre vos outils maison d'animation et vos références dans le luxe.", r, elements)).toBe(true);
  });

  it("refuse une phrase qui nomme ou situe le repreneur", () => {
    expect(interetAcceptable("Mikros élargirait son offre d'animation avec vos outils maison.", r, elements)).toBe(false);
    expect(interetAcceptable("Basée à Levallois-Perret, elle gagnerait vos références dans le luxe.", r, elements)).toBe(false);
  });

  it("refuse un chiffre absent des éléments fournis, accepte un chiffre présent", () => {
    expect(interetAcceptable("Elle gagnerait 30 % de capacité de production avec votre équipe.", r, elements)).toBe(false);
    expect(interetAcceptable("Avec 8,3 % de marge, elle a de quoi financer la reprise de votre équipe.", r, elements)).toBe(true);
  });

  it("refuse un nom propre qui vient du repreneur, accepte celui qui vient du vendeur", () => {
    const vendeur = "Studio VFX et animation, références Hermès et Cartier";
    expect(interetAcceptable("Votre savoir-faire en VFX renforcerait ses cinématiques de jeux narratifs comme Detroit.", r, elements, vendeur)).toBe(false);
    expect(interetAcceptable("Votre savoir-faire en VFX renforcerait ses cinématiques de jeux narratifs.", r, elements, vendeur)).toBe(true);
    expect(interetAcceptable("Elle ajouterait à son offre vos références dans le luxe, comme Hermès.", r, elements, vendeur)).toBe(true);
  });

  it("refuse le vide, RIEN et les débordements", () => {
    expect(interetAcceptable("RIEN", r, elements)).toBe(false);
    expect(interetAcceptable("Rien de précis ne ressort des éléments fournis ici.", r, elements)).toBe(false);
    expect(interetAcceptable("x".repeat(300), r, elements)).toBe(false);
    expect(interetAcceptable("Première phrase correcte ici.\nDeuxième ligne en trop.", r, elements)).toBe(false);
  });
});
