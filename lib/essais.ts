import { TRANCHES } from "./repreneurs";
import type { Repreneur, Societe } from "./types";

/**
 * Banc d'essai de la fiche et de la recherche de repreneurs : de vraies sociétés, et ce que Shlomo doit en faire.
 * Chaque cas raté trouvé sur le site devient une ligne ici ; on relance toute la liste après chaque modification.
 * Le banc ne dépense pas d'IA : il vérifie les règles (ce qui se vend, qui est retenu, comment c'est classé et dit).
 */
export type Cas = {
  siren: string;
  /** Ce qu'on teste, en clair. Jamais le nom d'une personne. */
  quoi: string;
  attendu: "hors_parcours" | "cessee" | "cessible";
  /** Taille déclarée sur le site, quand elle remplace celle du registre. */
  taille?: number;
  /** Nombre minimal de repreneurs classés. */
  minimum?: number;
};

export const CAS: Cas[] = [
  { siren: "779982453", quoi: "Association (club de football)", attendu: "hors_parcours" },
  { siren: "775688799", quoi: "Fondation", attendu: "hors_parcours" },
  { siren: "398293399", quoi: "Entrepreneur en nom propre", attendu: "hors_parcours" },
  { siren: "729900118", quoi: "Groupement d'intérêt économique", attendu: "hors_parcours" },
  { siren: "893289835", quoi: "Société cessée", attendu: "cessee" },
  { siren: "812781797", quoi: "Menuiserie, 10 à 19 salariés, Rhône", attendu: "cessible", minimum: 5 },
  { siren: "793842634", quoi: "Studio d'effets visuels, 70 personnes d'après son site", attendu: "cessible", taille: 70, minimum: 5 },
  { siren: "443855085", quoi: "Boulangerie, 10 à 19 salariés, Lyon", attendu: "cessible", minimum: 5 },
  { siren: "794791319", quoi: "Plomberie, 6 à 9 salariés, Gironde", attendu: "cessible", minimum: 5 },
  // Presque tous les cabinets ont demandé au registre à ne pas être démarchés : on les respecte, la liste est donc courte.
  { siren: "383485356", quoi: "Cabinet d'expertise comptable (métier où presque tous refusent le démarchage)", attendu: "cessible", minimum: 1 },
  { siren: "878358886", quoi: "Restauration rapide, 100 à 199 salariés", attendu: "cessible", minimum: 3 },
  { siren: "399228055", quoi: "Société civile immobilière", attendu: "cessible" },
];

export type Controle = { nom: string; ok: boolean; detail?: string };

/** Contrôles sur la fiche : ce qui se vend, ce qui ne se vend pas, et une forme juridique lisible. */
export function controlerFiche(cas: Cas, societe: Societe | null): Controle[] {
  if (!societe) return [{ nom: "Société trouvée au registre", ok: false }];
  const controles: Controle[] = [{ nom: "Société trouvée au registre", ok: true }];
  controles.push({ nom: "Forme juridique écrite en clair", ok: Boolean(societe.formeJuridique) && !/\d/.test(societe.formeJuridique ?? ""), detail: societe.formeJuridique ?? "absente" });
  if (cas.attendu === "hors_parcours") controles.push({ nom: "Annoncée comme ne se vendant pas", ok: Boolean(societe.horsParcours), detail: societe.horsParcours });
  else controles.push({ nom: "Pas écartée à tort", ok: !societe.horsParcours, detail: societe.horsParcours });
  if (cas.attendu === "cessee") controles.push({ nom: "Reconnue comme cessée", ok: !societe.active });
  if (cas.attendu === "cessible") controles.push({ nom: "En activité", ok: societe.active });
  return controles;
}

/** Contrôles sur la liste des repreneurs : qui est retenu, dans quel ordre, et ce qui est écrit sur les cartes. */
export function controlerRepreneurs(cas: Cas, vendeur: Societe, repreneurs: Repreneur[], annee = new Date().getFullYear()): Controle[] {
  const controles: Controle[] = [];
  const minimum = cas.minimum ?? 0;
  controles.push({ nom: `Au moins ${minimum} repreneur${minimum > 1 ? "s" : ""}`, ok: repreneurs.length >= minimum, detail: `${repreneurs.length} classés` });

  const fautifs = (test: (r: Repreneur) => boolean) => repreneurs.filter(test).length;
  const nombre = (n: number) => (n === 0 ? undefined : `${n} en défaut`);

  const ordre = repreneurs.every((r, i) => i === 0 || repreneurs[i - 1].score >= r.score);
  controles.push({ nom: "Classés de la meilleure note à la moins bonne", ok: ordre });

  const exclus = fautifs((r) => r.societe.siren === vendeur.siren || !r.societe.active || Boolean(r.societe.entrepreneurIndividuel) || Boolean(r.societe.horsParcours) || Boolean(r.societe.refuseProspection));
  controles.push({ nom: "Aucun repreneur qui ne peut pas l'être (cessé, nom propre, association, opposé à la prospection)", ok: exclus === 0, detail: nombre(exclus) });

  const seuil = TRANCHES.indexOf(vendeur.trancheEffectif ?? "NN");
  const petits = seuil > 1 ? fautifs((r) => TRANCHES.indexOf(r.societe.trancheEffectif ?? "NN") < seuil) : 0;
  controles.push({ nom: "Aucun repreneur plus petit que le vendeur", ok: petits === 0, detail: nombre(petits) });

  const titres = repreneurs.map((r) => r.raisons[0]);
  controles.push({ nom: "Pas deux fois le même titre", ok: new Set(titres).size === titres.length, detail: new Set(titres).size === titres.length ? undefined : `${titres.length - new Set(titres).size} doublon(s)` });

  const defauts = fautifs((r) => r.raisons.some((x) => /négatif|en baisse|difficult/i.test(x)));
  controles.push({ nom: "Aucun défaut présenté comme un argument", ok: defauts === 0, detail: nombre(defauts) });

  const anciens = fautifs((r) => r.raisons.some((x) => [...x.matchAll(/\ben (\d{4})\b/g)].some((m) => Number(m[1]) < annee - 3)));
  controles.push({ nom: "Aucun chiffre de plus de trois ans", ok: anciens === 0, detail: nombre(anciens) });

  const sansCriteres = fautifs((r) => r.criteres.length < 5);
  controles.push({ nom: "Chaque note est expliquée par ses critères", ok: sansCriteres === 0, detail: nombre(sansCriteres) });
  return controles;
}
