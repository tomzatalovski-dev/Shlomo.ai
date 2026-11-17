import { describe, expect, it } from "vitest";
import { direRachat, lireRachat, motsDuMetier } from "@/lib/acheteurs";
import { avecRachat, noter } from "@/lib/repreneurs";
import type { Societe } from "@/lib/types";

const annonce = (plus: Record<string, unknown> = {}, categorie = "Achat d'un fonds par une personne morale (insertion provisoire)") => ({
  id: "A20260220103",
  dateparution: "2026-03-08",
  listepersonnes: JSON.stringify({ personne: { typePersonne: "pm", numeroImmatriculation: { numeroIdentification: "424 385 227" }, denomination: "ACHETEUR" } }),
  listeetablissements: JSON.stringify({ etablissement: { activite: "menuiserie, ébénisterie, agencement" } }),
  acte: JSON.stringify({ vente: { categorieVente: categorie } }),
  ...plus,
});

describe("acheteurs", () => {
  it("lit l'acheteur d'un rachat de fonds, pas le vendeur", () => {
    expect(lireRachat(annonce())).toEqual({ siren: "424385227", date: "2026-03-08", activite: "menuiserie, ébénisterie, agencement", url: "https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:A20260220103" });
  });

  it("écarte la société créée pour l'occasion, le locataire-gérant et la personne physique", () => {
    expect(lireRachat(annonce({}, "Achat d'un établissement principal par une personne morale lors de l'immatriculation"))).toBeNull();
    expect(lireRachat(annonce({}, "Achat d'un fonds par le locataire-gérant personne morale"))).toBeNull();
    expect(lireRachat(annonce({}, "Mise en activité d'une société suite à achat"))).toBeNull();
    expect(lireRachat(annonce({}, "Apport d'un établissement principal (immatriculation d'une personne morale, uniquement)"))).toBeNull();
    expect(lireRachat(annonce({}, "Achat d'un établissement secondaire ou complémentaire par une personne morale"))).not.toBeNull();
    expect(lireRachat(annonce({ listepersonnes: JSON.stringify({ personne: { typePersonne: "pp", nom: "DUPONT" } }) }))).toBeNull();
    expect(lireRachat(annonce({ listepersonnes: "pas du json" }))).toBeNull();
  });

  it("tire du libellé du métier les mots qui le désignent", () => {
    expect(motsDuMetier([{ code: "43.32A", libelle: "Travaux de menuiserie bois et PVC", lien: "meme" }])).toEqual(["menuiserie"]);
    expect(motsDuMetier([{ code: "56.10C", libelle: "Restauration de type rapide", lien: "meme" }])).toEqual(["restauration"]);
    expect(motsDuMetier([{ code: "43.32A", libelle: "", lien: "meme" }])).toEqual([]);
    expect(motsDuMetier([{ code: "43.32A", libelle: "Travaux de menuiserie bois et PVC", lien: "meme" }, { code: "25.11Z", libelle: "Fabrication de structures métalliques", lien: "voisin" }])).toEqual(["menuiserie"]);
  });

  it("met le rachat en première raison et relève la note", () => {
    const vendeur: Societe = { siren: "100000009", nom: "V", active: true, trancheEffectif: "11", dirigeants: [], finances: [], source: "test" };
    const candidat: Societe = { ...vendeur, siren: "424385227", trancheEffectif: "12" };
    const sans = noter(vendeur, candidat, "region");
    const avec = avecRachat(sans, { siren: "424385227", date: "2026-03-08", url: "x" });
    expect(avec.raisons[0]).toBe(direRachat({ siren: "424385227", date: "2026-03-08", url: "x" }));
    expect(avec.raisons[0]).toMatch(/mars 2026/);
    expect(avec.score).toBe(sans.score + 12);
    expect(avecRachat(sans)).toBe(sans);
  });
});
