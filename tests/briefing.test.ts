import { describe, expect, it } from "vitest";
import { arrondi, briefingRepreneurSur, chiffresConnus, interditsDe, nomme, quiIlEst, rapprochement, societeAnonyme } from "@/lib/briefing";
import { direComparables, fourchetteDe, lirePrix } from "@/lib/comparables";
import type { Societe } from "@/lib/types";

const vendeur = { nom: "ZM AGENCEMENTS", ville: "VAULX-EN-VELIN", site: "zm-agencements.fr", siren: "812781797", metier: "Travaux de menuiserie bois et PVC", region: "84", effectif: "10 à 19 salariés", anneeCreation: 2015, finances: [{ annee: 2024, chiffreAffaires: 1_840_000, resultat: 41_000 }] };
const repreneur = { siren: "887050391", nom: "ETABLISSEMENTS PIERRE GIRAUD", active: true, region: "84", departement: "69", effectif: "50 à 99 salariés", etablissements: 2, anneeCreation: 1982, dirigeants: [], finances: [{ annee: 2024, chiffreAffaires: 9_300_000, resultat: 830_000 }] } as unknown as Societe;

describe("briefings", () => {
  it("décrit le cédant sans le nommer ni le situer", () => {
    const lignes = societeAnonyme(vendeur, 2026);
    expect(lignes).toEqual(["Travaux de menuiserie bois et PVC", "Installée en Auvergne-Rhône-Alpes", "Équipe de 10 à 19 salariés", "Plus de 10 ans d'activité", "Chiffre d'affaires d'environ 1,8 M€ en 2024", "Résultat net positif en 2024"]);
    expect(lignes.some((l) => nomme(l, interditsDe(vendeur)))).toBe(false);
  });
  it("chiffre le rapprochement en valeurs arrondies", () => {
    expect(arrondi(1_840_000)).toBe(1_800_000);
    expect(rapprochement(vendeur, repreneur)[0]).toBe("Votre chiffre d'affaires passerait d'environ 9,3 M€ à environ 11,1 M€");
    expect(rapprochement({ ...vendeur, finances: [] }, repreneur)).toEqual(["Une équipe de 10 à 19 salariés déjà en place rejoindrait la vôtre", "Un site de plus dans votre région, Auvergne-Rhône-Alpes"]);
  });
  it("dit qui est le repreneur d'après ses comptes", () => {
    expect(quiIlEst({ societe: repreneur, nom: repreneur.nom, raisons: [], signaux: [] }, 2026)).toEqual(["50 à 99 salariés, 2 établissements", "Chiffre d'affaires de 9,3 M€ en 2024", "Résultat net de 830 k€ en 2024", "Créée en 1982"]);
  });
  it("refuse ce qui nomme le cédant ou avance un chiffre inconnu", () => {
    const interdits = interditsDe(vendeur);
    expect(nomme("Cette menuiserie de Vaulx-en-Velin compléterait votre offre", interdits)).toBe(true);
    expect(nomme("ZM Agencements vous apporterait un atelier", interdits)).toBe(true);
    expect(nomme("SIREN 812 781 797", interdits)).toBe(true);
    expect(nomme("Cette société vous apporterait un atelier en Auvergne-Rhône-Alpes", interdits)).toBe(false);
    expect(chiffresConnus("Une équipe de 10 à 19 salariés", "Équipe de 10 à 19 salariés")).toBe(true);
    expect(chiffresConnus("Marge de 12 %", "Équipe de 10 à 19 salariés")).toBe(false);
    expect(briefingRepreneurSur({ accroche: "Un atelier à Vaulx", pourquoiVous: [], societe: [], rapprochement: [] }, vendeur)).toBe(false);
  });
  it("lit les prix de vente du bulletin officiel", () => {
    const annonce = (origine: string) => ({ listeetablissements: JSON.stringify({ etablissement: { origineFonds: origine } }) });
    expect(lirePrix(annonce("établissement principal acquis par achat au prix stipulé de 195000.00 euros"))).toBe(195000);
    expect(lirePrix(annonce("Fonds artisanal acquis par achat au prix stipulé de 50 000,00 euros"))).toBe(50000);
    expect(lirePrix(annonce("acquis dans le cadre d'une liquidation judiciaire au prix stipulé de 60000.00 euros"))).toBeNull();
    expect(lirePrix(annonce("précédemment exploité en location-gérance acquis par achat au prix stipulé de 5050.00 euros"))).toBeNull();
    expect(lirePrix(annonce("acquis par apport au montant évalué à 125417.00 euros"))).toBeNull();
    expect(fourchetteDe([50000, 90000])).toBeNull();
    expect(fourchetteDe([50000, 90000, 120000, 195000, 300000])).toEqual({ bas: 90000, median: 120000, haut: 195000 });
    expect(direComparables({ ventes: 12, bas: 90000, median: 120000, haut: 195000, depuis: 2023, ou: "region", mots: ["menuiserie"] }, "Bretagne")).toContain("12 ventes de fonds « menuiserie » publiées en Bretagne depuis 2023");
  });
});
