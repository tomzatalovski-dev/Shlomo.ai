import { describe, expect, it } from "vitest";
import { choisir, memeNom, nettoyerConcurrents } from "@/lib/concurrents";
import { avecConcurrent, noter } from "@/lib/repreneurs";
import type { Societe } from "@/lib/types";

const soc = (siren: string, nom: string, plus: Partial<Societe> = {}): Societe => ({ siren, nom, active: true, trancheEffectif: "32", dirigeants: [], finances: [], source: "test", ...plus });
const vendeur = soc("428927966", "PRECIPHAR");
const pages = [{ url: "https://www.exemple.fr/prestataires-visite-medicale" }];

describe("concurrents directs", () => {
  it("ne garde qu'un nom dont la page citée a bien été reçue", () => {
    const { noms, metier } = nettoyerConcurrents({ metier: "Prestataire de visite médicale", concurrents: [
      { nom: "ALPHA SANTE", source: "https://exemple.fr/prestataires-visite-medicale/" },
      { nom: "BETA PHARMA", source: "https://ailleurs.fr/page" },
      { nom: "Alpha Santé", source: "https://www.exemple.fr/prestataires-visite-medicale" },
      { nom: "", source: "https://www.exemple.fr/prestataires-visite-medicale" },
    ] }, pages);
    expect(noms).toEqual([{ nom: "ALPHA SANTE", source: "https://exemple.fr/prestataires-visite-medicale/" }]);
    expect(metier).toBe("Prestataire de visite médicale");
    expect(nettoyerConcurrents(null, pages).noms).toEqual([]);
  });

  it("reconnaît le nom exact, le sigle, ou un nom d'usage assez long que le registre complète", () => {
    expect(memeNom("Mac Guff", soc("1", "MAC GUFF LIGNE"))).toBe(true);
    expect(memeNom("Guff", soc("1", "MAC GUFF LIGNE"))).toBe(false);
    expect(memeNom("Alpha Santé", soc("1", "ALPHA SANTE SAS"))).toBe(true);
    expect(memeNom("ASF", soc("1", "ALPHA SANTE FRANCE (ASF)"))).toBe(true);
    expect(memeNom("Alpha", soc("1", "ALPHA SANTE"))).toBe(false);
    expect(memeNom("Sante", soc("1", "ALPHA SANTE"))).toBe(false);
    expect(memeNom("AB", soc("1", "AB"))).toBe(false);
  });

  it("choisit la plus grande société de ce nom capable de racheter, jamais le vendeur ni une société cessée", () => {
    const liste = [soc("200000007", "ALPHA SANTE", { trancheEffectif: "12" }), soc("300000005", "ALPHA SANTE", { trancheEffectif: "41" }), soc("400000003", "ALPHA SANTE", { trancheEffectif: "42", active: false }), soc("428927966", "ALPHA SANTE", { trancheEffectif: "51" })];
    expect(choisir("Alpha Santé", liste, vendeur)?.siren).toBe("300000005");
    expect(choisir("Alpha Santé", [liste[0]], vendeur)).toBeUndefined();
    expect(choisir("Alpha Santé", [soc("500000001", "ALPHA SANTE", { refuseProspection: true })], vendeur)).toBeUndefined();
  });

  it("met « concurrent direct » en première raison et relève la note", () => {
    const sans = noter(vendeur, soc("300000005", "ALPHA SANTE", { trancheEffectif: "41" }), "region");
    const avec = avecConcurrent(sans, true);
    expect(avec.raisons[0]).toMatch(/^Concurrent direct/);
    expect(avec.score).toBe(Math.min(97, sans.score + 15));
    expect(avec.criteres.at(-1)).toEqual({ nom: "Concurrent direct", niveau: 3 });
    expect(avecConcurrent(sans, false)).toBe(sans);
  });
});
