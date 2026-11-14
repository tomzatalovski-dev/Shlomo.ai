import { describe, expect, it } from "vitest";
import { choisirSociete, correspondance, nomsCandidats, normaliser } from "@/lib/identite";
import { composerMetiers, lireMetiers, nettoyerMetiers } from "@/lib/metiers";
import type { Societe } from "@/lib/types";

const soc = (siren: string, nom: string, plus: Partial<Societe> = {}): Societe => ({ siren, nom, active: true, dirigeants: [], finances: [], source: "test", ...plus });

describe("retrouver la société du site", () => {
  it("normalise les noms", () => {
    expect(normaliser("La Fourche SAS")).toBe("lafourche");
    expect(normaliser("Société Générale d'Électricité")).toBe("generaledelectricite");
  });
  it("tire des noms du titre et du domaine", () => {
    expect(nomsCandidats("www.la-fourche.fr", "La Fourche | Épicerie bio en ligne")).toEqual(["La Fourche", "Épicerie bio en ligne"].slice(0, 2));
    expect(nomsCandidats("atelier-morel.fr", undefined, "Atelier Morel SARL")[0]).toBe("Atelier Morel SARL");
  });
  it("n'est sûre que si le nom est exact et l'adresse sur le site", () => {
    const bonne = soc("111111118", "ATELIER MOREL", { codePostal: "74000", ville: "ANNECY" });
    const homonyme = soc("222222226", "ATELIER MOREL ET FILS", { codePostal: "33000", ville: "BORDEAUX" });
    const fiches = [{ candidat: "Atelier Morel", societes: [homonyme, bonne] }];
    expect(choisirSociete(fiches, "Atelier Morel, 12 rue du Lac, 74000 Annecy").sure?.siren).toBe("111111118");
    const sansAdresse = choisirSociete(fiches, "Menuiserie sur mesure");
    expect(sansAdresse.sure).toBeUndefined();
    expect(sansAdresse.propositions.map((p) => p.siren)).toEqual(["111111118"]);
    const homonymes = [1, 2, 3, 4].map((i) => soc(`90000000${i}`, "ALAN"));
    expect(choisirSociete([{ candidat: "Alan", societes: homonymes }], "Assurance santé").propositions).toEqual([]);
  });
  it("ne propose pas une société sans rapport ni un indépendant", () => {
    expect(correspondance(soc("1", "BOULANGERIE DUPONT"), "Atelier Morel", "")).toBe(0);
    expect(choisirSociete([{ candidat: "Morel", societes: [soc("333333334", "MOREL", { entrepreneurIndividuel: true })] }], "").propositions).toEqual([]);
  });
  it("reconnaît le sigle entre parenthèses", () => {
    expect(correspondance(soc("1", "SOCIETE NOUVELLE DE DISTRIBUTION (LA FOURCHE)"), "La Fourche", "")).toBe(3);
  });
});

describe("activités où chercher", () => {
  it("rejette les codes mal formés et limite à quatre", () => {
    const liste = nettoyerMetiers([{ code: "62.01z", libelle: "Programmation <b>", lien: "meme" }, { code: "6201Z" }, { code: "58.29C" }, { code: "62.02A" }, { code: "63.11Z" }, { code: "70.22Z" }]);
    expect(liste.map((m) => m.code)).toEqual(["62.01Z", "58.29C", "62.02A", "63.11Z"]);
    expect(liste[0]).toEqual({ code: "62.01Z", libelle: "Programmation b", lien: "meme" });
    expect(liste[1].lien).toBe("voisin");
  });
  it("suit l'IA quand elle écarte un code administratif, garde le registre sinon", () => {
    expect(composerMetiers("82.11Z", [{ code: "62.01Z", libelle: "", lien: "meme" }]).map((m) => m.code)).toEqual(["62.01Z"]);
    expect(composerMetiers("43.32A", [{ code: "43.91B", libelle: "", lien: "voisin" }]).map((m) => m.code)).toEqual(["43.32A", "43.91B"]);
    expect(composerMetiers("43.32A", [])).toEqual([{ code: "43.32A", libelle: "", lien: "meme" }]);
  });
  it("revient au code du registre si le paramètre est absent ou illisible", () => {
    expect(lireMetiers("pas du json", "43.32A")).toEqual([{ code: "43.32A", libelle: "", lien: "meme" }]);
    expect(lireMetiers(null, undefined)).toEqual([]);
    expect(lireMetiers(JSON.stringify([{ code: "43.91B", lien: "voisin" }, { code: "43.32A", lien: "meme" }]), "43.32A").map((m) => m.code)).toEqual(["43.32A", "43.91B"]);
  });
});
