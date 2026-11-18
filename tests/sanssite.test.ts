import { describe, expect, it } from "vitest";
import { argumentsDuRegistre, composerArguments } from "@/lib/arguments";
import { direAdministration, lireAnnonce } from "@/lib/bodacc";
import { annuaire } from "@/lib/enquete";
import { sansAveu } from "@/lib/ia";
import { direVille } from "@/lib/lieu";
import { sansDoublon } from "@/lib/registre";
import type { Societe } from "@/lib/types";

const salmon = { siren: "400149506", nom: "S.G.T.E. SALMON", active: true, anneeCreation: 1995, effectif: "10 à 19 salariés", dirigeants: [], finances: [{ annee: 2025, resultat: 216930 }] } as unknown as Societe;

describe("société sans site", () => {
  it("écrit le nom d'usage et la ville lisiblement", () => {
    expect(sansDoublon("SOCIETE GENERALE DE TRAVAUX ELECTRIQUES SALMON S.G.T.E. SALMON (S.G.T.E. SALMON)")).toBe("S.G.T.E. SALMON");
    expect(sansDoublon("CIRCUS (CIRCUS)")).toBe("CIRCUS");
    expect(sansDoublon("DUPONT ET FILS (DEF)")).toBe("DUPONT ET FILS (DEF)");
    expect(direVille("TOURNES", "08")).toBe("Tournes (Ardennes)");
    expect(direVille("PARIS 8", "75")).toBe("Paris");
    expect(direVille("SAINT-MARTIN-DE-RE", undefined, "17410")).toBe("Saint-Martin-de-Re (Charente-Maritime)");
  });
  it("tire ses arguments du registre d'abord", () => {
    const registre = argumentsDuRegistre(salmon, 2026);
    expect(registre).toEqual(["31 ans d'activité, créée en 1995", "Résultat net de 217 k€ en 2025", "Équipe en place : 10 à 19 salariés"]);
    const montres = composerArguments(registre, ["Activité établie depuis 1995 (date du registre)", "Bornes de recharge et domotique"], false);
    expect(montres).toEqual([...registre, "Bornes de recharge et domotique"]);
    expect(composerArguments(registre, ["A", "B", "C", "D"], true)).toEqual(["A", "B", "C", registre[0]]);
  });
  it("n'avoue pas ce qu'elle ignore", () => {
    expect(sansAveu("Électricien installé à Tournes (Ardennes), selon les annuaires d'artisans. Il réalise installation, rénovation et dépannage électriques. Les sources publiques ne précisent ni son effectif ni ses clients.")).toBe("Électricien installé à Tournes (Ardennes). Il réalise installation, rénovation et dépannage électriques.");
  });
  it("écarte les annuaires d'artisans", () => {
    expect(annuaire("https://www.guide-de-l-habitat.fr/electricien/tournes")).toBe(true);
    expect(annuaire("https://www.touselectriciens.fr/sgte")).toBe(true);
    expect(annuaire("https://www.pappers.fr/entreprise/x")).toBe(true);
    expect(annuaire("https://www.lardennais.fr/id123/article")).toBe(false);
    expect(annuaire("https://www.circus.fr/studio")).toBe(false);
  });
  it("dit ce qu'une annonce change", () => {
    expect(direAdministration("modification du Président Leonard, Guy Noël,  nomination du Président : KMG GESTION & FINANCES")).toBe("Changement de président");
    expect(direAdministration("nomination du Directeur général : Leonard, Kevin")).toBe("Nomination d'un directeur général");
    expect(direAdministration("Directeur général partant : Vautier, Monique")).toBe("Départ d'un directeur général");
    expect(direAdministration("Commissaire aux comptes titulaire partant : GRANT THORNTON ; Commissaire aux comptes suppléant partant : X")).toBe("");
    const a = lireAnnonce({ id: "B201700123", dateparution: "2017-01-05", registre: "400149506", familleavis: "modification", familleavis_lib: "Modifications diverses", modificationsgenerales: JSON.stringify({ descriptif: "modification survenue sur l'administration" }), listepersonnes: JSON.stringify({ personne: { administration: "modification du Président Leonard, Guy,  nomination du Président : KMG" } }) }, "400149506")!;
    expect(a.detail).toBe("Changement de président");
  });
});
