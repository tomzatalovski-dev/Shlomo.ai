import type { DossierOrchestre, RepreneurOrchestre } from "./base";

/**
 * Le chef d'orchestre : il regarde chaque dossier et dit ce qui doit se passer maintenant.
 * Il ne décide rien d'irréversible : ce qui engage (premier message, réponse à un repreneur, classement sans suite) reste à une personne.
 * Seules les relances peuvent partir seules, et seulement là où l'envoi le permet.
 */
export const JOURS_AVANT_RELANCE = 4;
export const JOURS_AVANT_SECONDE = 6;
export const JOURS_AVANT_CLASSEMENT = 10;

export type Action =
  | "verifier_qualite" | "saisir_adresse" | "premier_message" | "relance_1" | "relance_2" | "classer_sans_suite" | "reponse_a_relire" | "decision_du_cedant";
export type AFaire = { dossier: string; nomDossier: string; essai: boolean; siren?: string; nom?: string; action: Action; depuisJours?: number };

const JOUR = 86_400_000;
const jours = (iso: string | null | undefined, maintenant: Date) => (iso ? Math.floor((maintenant.getTime() - new Date(iso).getTime()) / JOUR) : 0);

function pour(p: RepreneurOrchestre, maintenant: Date): { action: Action; depuisJours?: number } | null {
  if (p.canal === "refus_demarchage" || p.statut === "sans_suite" || p.statut === "conclu") return null;
  if (p.a_relire > 0) return { action: "reponse_a_relire" };
  if (p.accord && !p.revelation) return { action: "decision_du_cedant", depuisJours: jours(p.statut_le, maintenant) };
  const depuis = jours(p.statut_le, maintenant);
  if (p.statut === "identifie" && p.canal === "a_envoyer" && p.pret) return { action: "premier_message" };
  if (p.statut === "contacte" && p.relances === 0 && depuis >= JOURS_AVANT_RELANCE) return { action: "relance_1", depuisJours: depuis };
  if (p.statut === "relance" && p.relances === 1 && depuis >= JOURS_AVANT_SECONDE) return { action: "relance_2", depuisJours: depuis };
  if (p.statut === "relance" && p.relances >= 2 && depuis >= JOURS_AVANT_CLASSEMENT) return { action: "classer_sans_suite", depuisJours: depuis };
  return null;
}

/** Tout ce qui est à faire aujourd'hui, dossier par dossier. Un dossier dont le signataire n'est pas vérifié n'a qu'une chose à faire : le vérifier. */
export function decider(dossiers: DossierOrchestre[], maintenant = new Date()): AFaire[] {
  const liste: AFaire[] = [];
  for (const d of dossiers) {
    const base = { dossier: d.id, nomDossier: d.nom, essai: d.essai };
    if (d.qualite === "refusee") continue;
    if (d.qualite !== "validee") {
      liste.push({ ...base, action: "verifier_qualite", depuisJours: jours(d.signe_le, maintenant) });
      continue;
    }
    for (const p of d.presentations) {
      const a = pour(p, maintenant);
      if (a) liste.push({ ...base, siren: p.siren, nom: p.nom, ...a });
    }
  }
  return liste;
}

export const estRelance = (a: Action) => a === "relance_1" || a === "relance_2";

const DIRE: Record<Action, (x: AFaire) => string> = {
  verifier_qualite: (x) => `Vérifier le signataire du mandat${x.depuisJours ? `, signé il y a ${x.depuisJours} jour${x.depuisJours > 1 ? "s" : ""}` : ""}`,
  saisir_adresse: (x) => `Saisir l'adresse du destinataire chez ${x.nom}`,
  premier_message: (x) => `Relire et envoyer le premier message à ${x.nom}`,
  relance_1: (x) => `Relancer ${x.nom}, sans réponse depuis ${x.depuisJours} jours`,
  relance_2: (x) => `Dernière relance à ${x.nom}, sans réponse depuis ${x.depuisJours} jours`,
  classer_sans_suite: (x) => `Classer ${x.nom} sans suite : deux relances, ${x.depuisJours} jours de silence`,
  reponse_a_relire: (x) => `Relire et envoyer la réponse proposée à ${x.nom}`,
  decision_du_cedant: (x) => `Le cédant doit dire s'il se nomme auprès de ${x.nom}`,
};
export const direAFaire = (x: AFaire) => DIRE[x.action](x);

/** Le courriel du matin à l'équipe : ce qui est parti seul, ce qui attend quelqu'un. Vide s'il n'y a rien à dire. */
export function resumeDuJour(faites: AFaire[], restantes: AFaire[], lienPoste: string): { sujet: string; texte: string } | null {
  if (faites.length === 0 && restantes.length === 0) return null;
  const parDossier = (liste: AFaire[]) => {
    const groupes = new Map<string, AFaire[]>();
    for (const x of liste) groupes.set(x.nomDossier, [...(groupes.get(x.nomDossier) ?? []), x]);
    return [...groupes].map(([nom, l]) => `${nom}${l[0].essai ? " (essai)" : ""}\n${l.map((x) => `  - ${direAFaire(x)}`).join("\n")}`).join("\n\n");
  };
  const texte = [
    restantes.length ? `À faire aujourd'hui (${restantes.length})\n\n${parDossier(restantes)}` : "",
    faites.length ? `Parti seul ce matin (${faites.length})\n\n${parDossier(faites)}` : "",
    `Le poste : ${lienPoste}`,
  ].filter(Boolean).join("\n\n— — —\n\n");
  return { sujet: `Shlomo : ${restantes.length} action${restantes.length > 1 ? "s" : ""} à faire${faites.length ? `, ${faites.length} relance${faites.length > 1 ? "s" : ""} partie${faites.length > 1 ? "s" : ""}` : ""}`, texte };
}
