import { describe, expect, it } from "vitest";
import { faitsProuves, nettoyerEnquete, siteConfirme } from "@/lib/enquete";
import type { LectureSite, Societe } from "@/lib/types";

const societe: Societe = { siren: "812781797", nom: "ZM AGENCEMENTS", active: true, ville: "VAULX-EN-VELIN", codePostal: "69120", dirigeants: [], finances: [], source: "" };
const site = (plus: Partial<LectureSite>): LectureSite => ({ domaine: "zm-agencements.fr", pagesLues: ["/"], texte: "", ...plus });

describe("site retrouvé par la recherche", () => {
  it("est sûr quand le SIREN de la société figure dans les mentions légales", () => {
    expect(siteConfirme(site({ sirenTrouve: "812781797" }), societe)).toBe("sur");
  });
  it("est écarté quand il affiche le SIREN d'une autre société, même au même nom", () => {
    expect(siteConfirme(site({ sirenTrouve: "123456789", texte: "ZM Agencements, Vaulx-en-Velin" }), societe)).toBe(false);
  });
  it("est probable quand le nom et la ville y figurent", () => {
    expect(siteConfirme(site({ texte: "ZM Agencements, menuiserie à Vaulx-en-Velin" }), societe)).toBe("probable");
    expect(siteConfirme(site({ texte: "Z.M. Agencements — 12 rue X, 69120" }), societe)).toBe("probable");
  });
  it("est écarté quand seul le nom correspond : un homonyme donnerait une fiche fausse", () => {
    expect(siteConfirme(site({ texte: "ZM Agencements, cuisines sur mesure à Lille" }), societe)).toBe(false);
  });
});

describe("résultat de l'enquête", () => {
  it("refuse les annuaires et les réseaux sociaux comme site officiel", () => {
    expect(nettoyerEnquete({ site: "https://www.societe.com/societe/zm", faits: [] }).site).toBeUndefined();
    expect(nettoyerEnquete({ site: "fr.linkedin.com", faits: [] }).site).toBeUndefined();
    expect(nettoyerEnquete({ site: "https://www.zm-agencements.fr/contact", faits: [] }).site).toBe("zm-agencements.fr");
  });
  it("ne garde que des faits avec une adresse https", () => {
    const propre = nettoyerEnquete({ faits: [{ fait: "A ouvert un second atelier en 2023.", source: "https://exemple.fr/a" }, { fait: "Sans source valable ici.", source: "exemple" }, { fait: "court", source: "https://exemple.fr/b" }] });
    expect(propre.faits).toHaveLength(1);
  });
  it("écarte un fait dont la source n'a pas été réellement lue", () => {
    const { gardes, ecartes } = faitsProuves([{ texte: "Fait lu sur une page reçue.", source: "https://www.exemple.fr/a/" }, { texte: "Fait à la source inventée.", source: "https://exemple.fr/inventee" }], [{ url: "https://exemple.fr/a" }]);
    expect(gardes).toHaveLength(1);
    expect(ecartes).toBe(1);
  });
});
