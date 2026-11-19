import { describe, expect, it } from "vitest";
import { codeDe, composerPremier, composerRelance, destination, habillerEssai, lienCourt } from "@/lib/envoi";
import { decider, direAFaire, resumeDuJour } from "@/lib/orchestre";
import type { DossierOrchestre, RepreneurOrchestre } from "@/lib/base";

const maintenant = new Date("2026-11-20T08:00:00Z");
const ilYA = (j: number) => new Date(maintenant.getTime() - j * 86_400_000).toISOString();
const r = (plus: Partial<RepreneurOrchestre>): RepreneurOrchestre => ({ siren: "111111111", nom: "GIRAUD", statut: "identifie", canal: "a_envoyer", relances: 0, a_courriel: false, code_court: "3f9a1c0b77de", pret: true, accord: false, a_relire: 0, ...plus });
const d = (liste: RepreneurOrchestre[], plus: Partial<DossierOrchestre> = {}): DossierOrchestre => ({ id: "d1", nom: "ZM", essai: false, qualite: "validee", signe_le: ilYA(2), presentations: liste, ...plus });

describe("chef d'orchestre", () => {
  it("ne demande que la vérification tant que le signataire n'est pas vérifié", () => {
    expect(decider([d([r({})], { qualite: "a_verifier" })], maintenant).map((x) => x.action)).toEqual(["verifier_qualite"]);
    expect(decider([d([r({})], { qualite: "refusee" })], maintenant)).toEqual([]);
  });
  it("enchaîne premier message, deux relances, puis classement", () => {
    const action = (p: Partial<RepreneurOrchestre>) => decider([d([r(p)])], maintenant)[0]?.action;
    expect(action({})).toBe("premier_message");
    expect(action({ statut: "contacte", statut_le: ilYA(3) })).toBeUndefined();
    expect(action({ statut: "contacte", statut_le: ilYA(4) })).toBe("relance_1");
    expect(action({ statut: "relance", relances: 1, statut_le: ilYA(5) })).toBeUndefined();
    expect(action({ statut: "relance", relances: 1, statut_le: ilYA(6) })).toBe("relance_2");
    expect(action({ statut: "relance", relances: 2, statut_le: ilYA(10) })).toBe("classer_sans_suite");
  });
  it("s'arrête dès qu'il répond, refuse ou signe", () => {
    const action = (p: Partial<RepreneurOrchestre>) => decider([d([r(p)])], maintenant)[0]?.action;
    expect(action({ statut: "a_repondu", statut_le: ilYA(30) })).toBeUndefined();
    expect(action({ statut: "sans_suite", statut_le: ilYA(30) })).toBeUndefined();
    expect(action({ canal: "refus_demarchage" })).toBeUndefined();
    expect(action({ statut: "a_repondu", a_relire: 1 })).toBe("reponse_a_relire");
    expect(action({ statut: "confidentialite_signee", accord: true })).toBe("decision_du_cedant");
  });
  it("écrit le courriel du matin, ou rien s'il n'y a rien", () => {
    expect(resumeDuJour([], [], "x")).toBeNull();
    const restantes = decider([d([r({}), r({ siren: "2", nom: "BLANC", statut: "contacte", statut_le: ilYA(5) })])], maintenant);
    const m = resumeDuJour([], restantes, "https://x/poste")!;
    expect(m.sujet).toBe("Shlomo : 2 actions à faire");
    expect(m.texte).toContain("Relire et envoyer le premier message à GIRAUD");
    expect(direAFaire(restantes[1])).toBe("Relancer BLANC, sans réponse depuis 5 jours");
  });
});

describe("envoi", () => {
  it("n'envoie jamais un essai au repreneur, ni un vrai message tant que l'envoi réel est fermé", () => {
    delete process.env.ENVOI_REEL;
    process.env.COURRIEL_EQUIPE = "Equipe@Exemple.fr";
    expect(destination(true, "patron@giraud.fr")).toEqual({ a: "equipe@exemple.fr", essai: true });
    expect(destination(false, "patron@giraud.fr")).toHaveProperty("refus");
    process.env.ENVOI_REEL = "oui";
    expect(destination(false, "patron@giraud.fr")).toEqual({ a: "patron@giraud.fr", essai: false });
    expect(destination(false, null)).toHaveProperty("refus");
    expect(destination(true, "patron@giraud.fr")).toEqual({ a: "equipe@exemple.fr", essai: true });
    delete process.env.ENVOI_REEL;
    delete process.env.COURRIEL_EQUIPE;
    expect(destination(true, null)).toHaveProperty("refus");
  });
  it("remplace le lien commun par la page du repreneur", () => {
    const lien = lienCourt("https://shlomo.ai", "3f9a1c0b77de");
    expect(lien).toBe("https://shlomo.ai/r/3f9a-1c0b-77de");
    expect(codeDe("3F9A-1c0b 77de")).toBe("3f9a1c0b77de");
    const m = composerPremier("Bonjour Jean Martin,\n\nUne menuiserie est à céder.\n\nPrésentation anonyme : https://shlomo-ai.vercel.app/fiche?f=abc\n\nL'équipe Shlomo\n\n\nVos coordonnées proviennent du registre public. Pour ne plus être contacté, répondez STOP.", lien);
    expect(m.texte).toBe("Bonjour Jean Martin,\n\nUne menuiserie est à céder.\n\nLa page écrite pour vous, sans engagement : https://shlomo.ai/r/3f9a-1c0b-77de\n\nL'équipe Shlomo\n\nVos coordonnées proviennent du registre public. Pour ne plus être contacté, répondez STOP.\n\nMessage préparé par une intelligence artificielle et relu par l'équipe Shlomo.");
    const nu = composerPremier("Bonjour,\n\nUne société est à céder.", lien).texte;
    expect(nu).toContain("L'équipe Shlomo");
    expect(nu).toContain("répondez simplement « stop »");
  });
  it("écrit deux relances distinctes et marque l'essai", () => {
    const un = composerRelance(1, { decideur: "Jean Martin", premierLe: "2026-11-16T09:00:00Z", lien: "L" });
    const deux = composerRelance(2, { lien: "L" });
    expect(un.texte).toContain("Bonjour Jean Martin,");
    expect(un.texte).toContain("le 16 novembre");
    expect(deux.texte).toContain("je ne vous écrirai plus");
    expect(habillerEssai(un, "GIRAUD", null).sujet).toBe("[Essai] Suite à mon message : une société à reprendre");
    expect(habillerEssai(un, "GIRAUD", "a@b.fr").texte).toContain("vers GIRAUD (a@b.fr)");
  });
});
