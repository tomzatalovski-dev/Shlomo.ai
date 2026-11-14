import { describe, expect, it } from "vitest";
import { montants, verifier, type Dossier } from "@/lib/negociation/gardefous";

const dossier: Dossier = {
  vendeur: { nom: "ATELIER MOREL", ville: "ANNECY", site: "atelier-morel.fr" },
  activite: "Menuiserie d'agencement",
  region: "Auvergne-Rhône-Alpes",
  effectif: "10 à 19 salariés",
  fourchette: { bas: 600_000, haut: 1_200_000 },
  accordSigne: false,
  repreneursActifs: 1,
  offresRecues: 0,
  echeance: null,
};
const regles = (texte: string, d: Dossier = dossier, repreneur = "") => verifier(texte, d, repreneur).map((f) => f.regle);

describe("montants cités", () => {
  it("lit les écritures courantes", () => {
    expect(montants("entre 600 000 € et 1,2 M€")).toEqual([600_000, 1_200_000]);
    expect(montants("450 k€, soit 450000 euros, ou 1.200.000 €")).toEqual([450_000, 450_000, 1_200_000]);
    expect(montants("15 minutes, 10 à 19 salariés")).toEqual([]);
  });
});

describe("garde-fous du négociateur", () => {
  it("laisse passer un message loyal", () => {
    expect(regles("Merci de votre retour. La fourchette validée par le cédant va de 600 000 € à 1 200 000 €. Le nom vous sera communiqué après l'accord de confidentialité.")).toEqual([]);
  });
  it("arrête le nom, la ville ou le site avant l'accord, pas après", () => {
    expect(regles("Il s'agit de la société Morel.")).toContain("identite");
    expect(regles("Elle est installée à Annecy.")).toContain("identite");
    expect(regles("Il s'agit de la société Morel, à Annecy.", { ...dossier, accordSigne: true })).toEqual([]);
  });
  it("arrête un prix hors des bornes validées, ou tout prix sans fourchette", () => {
    expect(regles("Le cédant accepterait 500 000 €.")).toContain("prix");
    expect(regles("Autour de 900 000 €.")).toContain("prix");
    expect(regles("Environ 600 000 €.", { ...dossier, fourchette: null })).toContain("prix");
  });
  it("ne reproche pas de reprendre le montant avancé par le repreneur", () => {
    expect(regles("Je transmets votre proposition de 300 000 € au cédant.", dossier, "Je propose 300 000 €, pas plus.")).toEqual([]);
  });
  it("arrête une concurrence, une offre ou une échéance qui ne sont pas au dossier", () => {
    expect(regles("Vous n'êtes pas seul sur ce dossier.")).toContain("concurrence");
    expect(regles("D'autres repreneurs ont déjà pris rendez-vous.")).toContain("concurrence");
    expect(regles("Nous avons reçu une offre.")).toContain("concurrence");
    expect(regles("La date limite est vendredi.")).toContain("echeance");
    expect(regles("Il faudra vous positionner d'ici vendredi.")).toContain("echeance");
    expect(regles("À ce jour, aucun autre repreneur n'est en discussion. Je reviens vers vous d'ici jeudi, et je vous propose un appel avant le 20.")).toEqual([]);
    expect(regles("Voici ce qui rendrait votre offre forte : un calendrier clair. Vous pourrez remettre une offre après l'accord.")).toEqual([]);
  });
  it("les autorise quand le dossier les établit", () => {
    const reel: Dossier = { ...dossier, repreneursActifs: 3, offresRecues: 1, echeance: "30 novembre 2026" };
    expect(regles("Vous n'êtes pas seul : d'autres repreneurs étudient le dossier, une offre a été reçue, et la remise des offres est fixée au 30 novembre.", reel)).toEqual([]);
  });
  it("relève les fautes mineures sans les tenir pour graves", () => {
    const fautes = verifier("Bonjour Monsieur, c'est une occasion unique.", dossier);
    expect(fautes.map((f) => f.regle)).toEqual(["civilite", "promesse"]);
    expect(fautes.some((f) => f.grave)).toBe(false);
  });
});
