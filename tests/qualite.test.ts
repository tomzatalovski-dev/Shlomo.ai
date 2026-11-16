import { describe, expect, it } from "vitest";
import { adresseDeLaSociete, dirigeantCorrespondant, indicesDeQualite } from "@/lib/qualite";

const dirigeants = [{ nom: "Pierre Antoine Jean GIRAUD", qualite: "Président" }, { nom: "HOLDING GIRAUD", societe: true }];

describe("signataire et dirigeants du registre", () => {
  it("reconnaît un dirigeant malgré les prénoms multiples, les accents et le trait d'union", () => {
    expect(dirigeantCorrespondant("Pierre-Antoine Giraud", dirigeants)?.qualite).toBe("Président");
    expect(dirigeantCorrespondant("GIRAUD Pierre", dirigeants)).not.toBeNull();
  });
  it("ne reconnaît ni un prénom seul, ni un autre nom, ni une société dirigeante", () => {
    expect(dirigeantCorrespondant("Pierre", dirigeants)).toBeNull();
    expect(dirigeantCorrespondant("Pierre Martin", dirigeants)).toBeNull();
    expect(dirigeantCorrespondant("Holding Giraud", dirigeants)).toBeNull();
  });
});

describe("adresse du signataire", () => {
  it("compte quand elle est au domaine du site de la société", () => {
    expect(adresseDeLaSociete("p.giraud@zm-agencements.fr", "https://www.zm-agencements.fr/contact")).toBe(true);
    expect(adresseDeLaSociete("p.giraud@mail.zm-agencements.fr", "zm-agencements.fr")).toBe(true);
  });
  it("ne compte pas pour une messagerie grand public, un domaine voisin ou un site inconnu", () => {
    expect(adresseDeLaSociete("p.giraud@gmail.com", "zm-agencements.fr")).toBe(false);
    expect(adresseDeLaSociete("p.giraud@faux-zm-agencements.fr", "zm-agencements.fr")).toBe(false);
    expect(adresseDeLaSociete("p.giraud@zm-agencements.fr", null)).toBe(false);
  });
  it("rassemble les deux indices", () => {
    expect(indicesDeQualite("Pierre Giraud", "p@gmail.com", "zm-agencements.fr", dirigeants)).toMatchObject({ nom: true, adresse: false, fonction: "Président" });
  });
});
