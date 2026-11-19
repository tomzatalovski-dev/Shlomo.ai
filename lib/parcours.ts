import type { Presentation, Suivi } from "./base";
import { direCreneau } from "./creneaux";
import { nomLisible } from "./lieu";

/** Les six étapes d'un repreneur, telles que le cédant les voit avancer. Chacune correspond à un fait enregistré en base. */
export const PISTE = ["Approche prête", "Contacté", "A répondu", "Accord signé", "Rendez-vous", "Offre"] as const;

const REPONDU = ["a_repondu", "interesse", "confidentialite_signee", "rendez_vous", "offre", "conclu"];

/** Où en est ce repreneur : 0 (rien encore) à 6 (offre remise). Jamais plus loin que ce que la base a enregistré. */
export function etapeDe(p: Presentation): number {
  if ((p.offres?.length ?? 0) > 0 || p.statut === "offre" || p.statut === "conclu") return 6;
  if (p.rendez_vous || p.statut === "rendez_vous") return 5;
  if (p.accord || p.statut === "confidentialite_signee") return 4;
  if (REPONDU.includes(p.statut)) return 3;
  if (p.statut === "contacte" || p.statut === "relance") return 2;
  if (p.canal === "a_envoyer") return 1;
  return 0;
}

export const horsCourse = (p: Presentation) => p.exclu || p.canal === "refus_demarchage" || p.statut === "sans_suite";

const n = (k: number, un: string, plusieurs: string) => (k > 1 ? `${k} ${plusieurs}` : `Un ${un}`);

/** La phrase en haut de la page : ce qui compte maintenant, en une ligne. */
export function phraseEtat(suivi: Suivi): string {
  const actifs = suivi.presentations.filter((p) => !horsCourse(p));
  const enAttente = actifs.flatMap((p) => p.offres ?? []).filter((o) => !o.reponse).length;
  if (enAttente) return enAttente > 1 ? `${enAttente} offres attendent votre réponse.` : "Une offre attend votre réponse.";
  const aNommer = actifs.filter((p) => p.accord && !p.revelation).length;
  if (aNommer) return `${n(aNommer, "repreneur a signé", "repreneurs ont signé")} l'accord de confidentialité. À vous de décider s'il${aNommer > 1 ? "s apprennent" : " apprend"} votre nom.`;
  const rendezVous = actifs.filter((p) => p.rendez_vous).sort((a, b) => a.rendez_vous!.localeCompare(b.rendez_vous!))[0];
  const discussions = actifs.filter((p) => etapeDe(p) >= 3).length;
  if (rendezVous) return `Shlomo discute avec ${discussions > 1 ? `${discussions} repreneurs` : "un repreneur"}. Vous rencontrez ${nomLisible(rendezVous.nom)} ${direCreneau(rendezVous.rendez_vous!)}.`;
  if (discussions) return `Shlomo discute avec ${discussions > 1 ? `${discussions} repreneurs` : "un repreneur"}.`;
  const contactes = actifs.filter((p) => etapeDe(p) === 2).length;
  if (contactes) return `${n(contactes, "repreneur contacté", "repreneurs contactés")}. Shlomo attend ${contactes > 1 ? "leurs réponses" : "sa réponse"}.`;
  const prets = actifs.filter((p) => etapeDe(p) === 1).length;
  if (prets) return `${prets > 1 ? `${prets} approches sont prêtes` : "Une approche est prête"}. Rien ne part sans relecture.`;
  return actifs.length ? `Shlomo prépare l'approche de vos ${actifs.length} repreneurs.` : "Aucun repreneur n'est en course pour l'instant.";
}

/** Ce qui va se passer ensuite, dit sans promesse de date que rien ne garantit. */
export function prochaineEtape(suivi: Suivi): string {
  const actifs = suivi.presentations.filter((p) => !horsCourse(p));
  if (!suivi.mandat?.autorisation_approche) return "Aucune approche n'est autorisée par votre mandat.";
  if (suivi.qualite === "refusee") return "Votre qualité de dirigeant n'a pas pu être confirmée : écrivez-nous.";
  if (suivi.qualite !== "validee") return "Vérification de votre qualité de dirigeant, sous 24 heures. Aucun message ne part avant.";
  if (!suivi.fourchette && actifs.some((p) => etapeDe(p) >= 3)) return "Fixez votre fourchette de prix : des repreneurs vont la demander.";
  if (actifs.some((p) => etapeDe(p) === 0)) return "Préparation des approches restantes : décideur, veille, message.";
  const prets = actifs.filter((p) => etapeDe(p) === 1).length;
  if (prets) return `Envoi ${prets > 1 ? `des ${prets} messages prêts` : "du message prêt"}, après relecture par l'équipe Shlomo.`;
  if (actifs.some((p) => etapeDe(p) === 2)) return "Relance des repreneurs restés sans réponse.";
  if (actifs.some((p) => etapeDe(p) === 3)) return "Réponse aux questions des repreneurs, puis accord de confidentialité.";
  if (actifs.some((p) => etapeDe(p) === 4 && p.revelation === "autorisee" && !p.rendez_vous)) return (suivi.creneaux?.length ?? 0) ? "Choix d'un rendez-vous par le repreneur qui connaît votre nom." : "Indiquez vos disponibilités : un repreneur peut vous rencontrer.";
  if (actifs.some((p) => etapeDe(p) === 5)) return "Rencontre, puis offre du repreneur.";
  return "Shlomo suit chaque repreneur et vous prévient à chaque étape.";
}
