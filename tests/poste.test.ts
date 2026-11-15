import { describe, expect, it } from "vitest";
import type { DossierPoste, RepreneurPoste } from "@/lib/base";
import { conversation, dossierPour } from "@/lib/negociation/poste";

const r = (siren: string, statut: RepreneurPoste["statut"], plus: Partial<RepreneurPoste> = {}): RepreneurPoste => ({ siren, nom: `R${siren}`, rang: 1, statut, exclu: false, jeton_accord: "a", echanges: [], ...plus });
const d = (presentations: RepreneurPoste[], plus: Partial<DossierPoste> = {}): DossierPoste => ({ id: "x", nom: "ATELIER VERDIER", siren: "123456789", jeton: "j", jeton_fiche: "f", fiche: { ville: "CHAMBERY", activite: "Menuiserie", region: "84", effectif: "10 à 19 salariés" }, presentations, interets: [], ...plus });

describe("faits transmis au négociateur", () => {
  it("ne compte que les repreneurs réellement en discussion", () => {
    const faits = dossierPour(d([r("111111111", "a_repondu"), r("222222222", "contacte"), r("333333333", "interesse"), r("444444444", "sans_suite"), r("555555555", "rendez_vous", { exclu: true })]), "111111111")!;
    expect(faits.repreneursActifs).toBe(2);
    expect(faits.offresRecues).toBe(0);
  });
  it("ne transmet ni fourchette ni échéance tant que le vendeur n'en a pas validé", () => {
    const faits = dossierPour(d([r("111111111", "a_repondu")]), "111111111")!;
    expect(faits.fourchette).toBeNull();
    expect(faits.echeance).toBeNull();
    expect(faits.repreneursActifs).toBe(1);
  });
  it("ne permet le nom qu'après l'accord signé et le feu vert du vendeur", () => {
    const accord = { signataire: "Jean Martin", signe_le: "" };
    expect(dossierPour(d([r("111111111", "confidentialite_signee")]), "111111111")!.accordSigne).toBe(false);
    expect(dossierPour(d([r("111111111", "confidentialite_signee", { accord })]), "111111111")!.accordSigne).toBe(false);
    expect(dossierPour(d([r("111111111", "confidentialite_signee", { accord, revelation: "refusee" })]), "111111111")!.accordSigne).toBe(false);
    expect(dossierPour(d([r("111111111", "confidentialite_signee", { revelation: "autorisee" })]), "111111111")!.accordSigne).toBe(false);
    expect(dossierPour(d([r("111111111", "confidentialite_signee", { accord, revelation: "autorisee" })]), "111111111")!.accordSigne).toBe(true);
  });
  it("transmet la fourchette validée par le vendeur", () => {
    expect(dossierPour(d([r("111111111", "a_repondu")], { fourchette: { bas: 400000, haut: 600000 } }), "111111111")!.fourchette).toEqual({ bas: 400000, haut: 600000 });
  });
  it("donne le nom de la région, pas son code", () => {
    expect(dossierPour(d([r("111111111", "a_repondu")]), "111111111")!.region).toBe("Auvergne-Rhône-Alpes");
  });
  it("compte les offres réellement remises", () => {
    expect(dossierPour(d([r("111111111", "a_repondu"), r("222222222", "offre")]), "111111111")!.offresRecues).toBe(1);
  });
  it("refuse un repreneur rayé ou inconnu", () => {
    expect(dossierPour(d([r("111111111", "a_repondu", { exclu: true })]), "111111111")).toBeNull();
    expect(dossierPour(d([]), "999999999")).toBeNull();
  });
});

describe("conversation réelle", () => {
  it("ne garde que ce qui est parti et ce qui est revenu", () => {
    const e = (id: number, de: "repreneur" | "shlomo", etat: "recu" | "propose" | "envoye" | "ecarte") => ({ id, de, texte: `m${id}`, etat, cree_le: "" });
    const tours = conversation(r("111111111", "a_repondu", { message: "premier", echanges: [e(1, "repreneur", "recu"), e(2, "shlomo", "ecarte"), e(3, "shlomo", "envoye"), e(4, "repreneur", "recu"), e(5, "shlomo", "propose")] }));
    expect(tours.map((t) => t.texte)).toEqual(["premier", "m1", "m3", "m4"]);
  });
});
