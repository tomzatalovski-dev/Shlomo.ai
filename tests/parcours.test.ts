import { describe, expect, it } from "vitest";
import { etapeDe, phraseEtat, prochaineEtape } from "@/lib/parcours";
import type { Presentation, Suivi } from "@/lib/base";

const p = (plus: Partial<Presentation>): Presentation => ({ siren: "1", nom: "GIRAUD", rang: 1, raisons: [], statut: "identifie", exclu: false, presente_le: "", ...plus }) as Presentation;
const suivi = (liste: Presentation[], plus: Partial<Suivi> = {}): Suivi => ({ societe: { siren: "9", nom: "ZM" }, mandat: { signataire: "x", signe_le: "", autorisation_approche: true, version: "1" }, qualite: "validee", presentations: liste, evenements: [], ...plus });

describe("parcours d'un repreneur", () => {
  it("place chaque repreneur à l'étape que la base a enregistrée", () => {
    expect(etapeDe(p({}))).toBe(0);
    expect(etapeDe(p({ canal: "a_envoyer" }))).toBe(1);
    expect(etapeDe(p({ statut: "relance" }))).toBe(2);
    expect(etapeDe(p({ statut: "interesse" }))).toBe(3);
    expect(etapeDe(p({ statut: "contacte", accord: { signataire: "a", signe_le: "" } }))).toBe(4);
    expect(etapeDe(p({ rendez_vous: "2026-12-01T10:00" }))).toBe(5);
    expect(etapeDe(p({ offres: [{ id: 1, prix: 1, deposee_le: "" }] }))).toBe(6);
  });
  it("dit en une phrase ce qui compte maintenant", () => {
    expect(phraseEtat(suivi([p({}), p({ siren: "2" })]))).toBe("Shlomo prépare l'approche de vos 2 repreneurs.");
    expect(phraseEtat(suivi([p({ canal: "a_envoyer" })]))).toBe("Un approche est prête. Rien ne part sans relecture.".replace("Un approche", "Une approche"));
    expect(phraseEtat(suivi([p({ statut: "contacte" }), p({ siren: "2", statut: "contacte" })]))).toBe("2 repreneurs contactés. Shlomo attend leurs réponses.");
    expect(phraseEtat(suivi([p({ statut: "interesse" })]))).toBe("Shlomo discute avec un repreneur.");
    expect(phraseEtat(suivi([p({ accord: { signataire: "a", signe_le: "" } })]))).toBe("Un repreneur a signé l'accord de confidentialité. À vous de décider s'il apprend votre nom.");
    expect(phraseEtat(suivi([p({ accord: { signataire: "a", signe_le: "" }, revelation: "autorisee", rendez_vous: "2026-12-01T10:00" })]))).toBe("Shlomo discute avec un repreneur. Vous rencontrez Giraud mardi 1 décembre à 10 h 00.");
    expect(phraseEtat(suivi([p({ offres: [{ id: 1, prix: 1, deposee_le: "" }] })]))).toBe("Une offre attend votre réponse.");
  });
  it("annonce la suite sans promettre de date", () => {
    expect(prochaineEtape(suivi([p({ canal: "a_envoyer" })], { qualite: "a_verifier" }))).toContain("Vérification de votre qualité");
    expect(prochaineEtape(suivi([p({ canal: "a_envoyer" }), p({ siren: "2", canal: "a_envoyer" })]))).toBe("Envoi des 2 messages prêts, après relecture par l'équipe Shlomo.");
    expect(prochaineEtape(suivi([p({ statut: "contacte" })]))).toBe("Relance des repreneurs restés sans réponse.");
    expect(prochaineEtape(suivi([p({ statut: "interesse" })]))).toBe("Fixez votre fourchette de prix : des repreneurs vont la demander.");
  });
});
