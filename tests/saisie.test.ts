import { describe, expect, it } from "vitest";
import { analyserSaisie, luhnValide } from "@/lib/saisie";

describe("analyserSaisie", () => {
  it("reconnaît un SIREN valide, avec ou sans espaces", () => {
    expect(analyserSaisie("552 032 534")).toEqual({ type: "siren", siren: "552032534" });
    expect(luhnValide("552032534")).toBe(true);
  });
  it("tire le SIREN d'un SIRET et d'un numéro de TVA français", () => {
    expect(analyserSaisie("55203253400646")).toEqual({ type: "siren", siren: "552032534" });
    expect(analyserSaisie("FR 12 552032534")).toEqual({ type: "siren", siren: "552032534" });
  });
  it("refuse un SIREN faux ou de mauvaise longueur", () => {
    expect(analyserSaisie("552032535").type).toBe("invalide");
    expect(analyserSaisie("12345").type).toBe("invalide");
  });
  it("reconnaît un site, quelle que soit la façon de l'écrire", () => {
    expect(analyserSaisie("https://www.Exemple.fr/contact?x=1")).toEqual({ type: "site", domaine: "exemple.fr", url: "https://exemple.fr/" });
  });
  it("refuse le reste, dont les numéros belges pour l'instant", () => {
    expect(analyserSaisie("bonjour").type).toBe("invalide");
    expect(analyserSaisie("BE 0123.456.749").type).toBe("invalide");
    expect(analyserSaisie("   ").type).toBe("invalide");
  });
});
