import { interrogerRegistre, mapperSociete, SOCIETES_ACHETEUSES } from "./registre";
import type { Societe } from "./types";

/**
 * Les vendeurs probables : des sociétés dont le dirigeant approche de l'âge où l'on transmet.
 * Tout vient du registre public (âge des dirigeants, ancienneté, forme). C'est un indice, pas une intention :
 * la liste sert aux fondateurs à choisir qui approcher, jamais à écrire « vous allez vendre ».
 * Les sociétés qui ont demandé à ne pas être démarchées n'y figurent pas.
 */

export const AGE_DE_TRANSMISSION = 60;

export type Dirigeant = { nom: string; qualite: string; naissance: number };

export type VendeurProbable = {
  societe: Societe;
  /** Les personnes qui dirigent réellement (gérant, président, directeur général), de la plus âgée à la plus jeune. */
  dirigeants: Dirigeant[];
  /** « forte » : tous les dirigeants ont atteint l'âge de transmission, aucune relève visible. « moyenne » : un dirigeant plus jeune est déjà en place. */
  priorite: "forte" | "moyenne";
  /** Les faits qui fondent la priorité, en clair. */
  indices: string[];
  /** Une société préside ou gère : la décision de vendre se prend peut-être ailleurs. */
  tenueParUneSociete: boolean;
};

const DIRIGE = /g[ée]rant|pr[ée]sident|directeur g[ée]n[ée]ral/i;
const NE_DIRIGE_PAS = /commissaire|suppl[ée]ant|administrateur|conseil de surveillance|liquidateur/i;

/** Lit, dans une fiche brute du registre, qui dirige et depuis quel âge. Null si la société ne correspond pas. */
export function lireVendeurProbable(brut: Record<string, unknown>, annee = new Date().getFullYear()): VendeurProbable | null {
  const societe = mapperSociete(brut as Parameters<typeof mapperSociete>[0]);
  if (!societe.active || societe.horsParcours || societe.refuseProspection) return null;
  const liste = Array.isArray(brut.dirigeants) ? (brut.dirigeants as Record<string, unknown>[]) : [];
  const qui = (d: Record<string, unknown>) => String(d.qualite ?? "");
  const dirigeants: Dirigeant[] = [];
  let tenueParUneSociete = false;
  for (const d of liste) {
    if (!DIRIGE.test(qui(d)) || NE_DIRIGE_PAS.test(qui(d))) continue;
    if (d.type_dirigeant !== "personne physique") {
      tenueParUneSociete = true;
      continue;
    }
    const naissance = Number(String(d.annee_de_naissance ?? d.date_de_naissance ?? "").slice(0, 4));
    if (!naissance || naissance < 1900 || naissance > annee - 18) continue;
    const nom = [d.prenoms, d.nom].filter((x) => typeof x === "string" && x).join(" ").replace(/\s+/g, " ").trim();
    if (!dirigeants.some((x) => x.nom === nom && x.naissance === naissance)) dirigeants.push({ nom: nom || "Dirigeant", qualite: qui(d), naissance });
  }
  dirigeants.sort((a, b) => a.naissance - b.naissance);
  const aine = dirigeants[0];
  if (!aine || annee - aine.naissance < AGE_DE_TRANSMISSION) return null;

  const releve = dirigeants.some((d) => annee - d.naissance < AGE_DE_TRANSMISSION);
  const indices = [`Dirigeant de ${annee - aine.naissance} ans environ`];
  indices.push(releve ? "Un dirigeant plus jeune est déjà en place" : dirigeants.length > 1 ? "Tous les dirigeants ont plus de 60 ans" : "Seul dirigeant, pas de relève visible au registre");
  if (societe.anneeCreation && annee - societe.anneeCreation >= 15) indices.push(`Société créée il y a ${annee - societe.anneeCreation} ans`);
  if (tenueParUneSociete) indices.push("Présidée ou gérée par une société : la décision se prend peut-être ailleurs");
  return { societe, dirigeants, priorite: releve || tenueParUneSociete ? "moyenne" : "forte", indices, tenueParUneSociete };
}

/** Du plus probable au moins probable : priorité forte d'abord, puis le dirigeant le plus âgé. */
export function ordonnerVendeurs(liste: VendeurProbable[]): VendeurProbable[] {
  return [...liste].sort((a, b) => (a.priorite === b.priorite ? a.dirigeants[0].naissance - b.dirigeants[0].naissance : a.priorite === "forte" ? -1 : 1));
}

export type FiltreVendeurs = { codeActivite: string; region: string; tranches: string[] };

/** Sociétés d'un métier et d'une région dont un dirigeant a atteint l'âge de transmission. Cinquante fiches lues au plus. */
export async function chercherVendeursProbables(filtre: FiltreVendeurs, annee = new Date().getFullYear()): Promise<{ vendeurs: VendeurProbable[]; lues: number; total: number }> {
  const { resultats, total } = await interrogerRegistre(
    {
      activite_principale: filtre.codeActivite,
      region: filtre.region,
      tranche_effectif_salarie: filtre.tranches.join(","),
      etat_administratif: "A",
      nature_juridique: SOCIETES_ACHETEUSES,
      type_personne: "dirigeant",
      date_naissance_personne_max: `${annee - AGE_DE_TRANSMISSION}-12-31`,
      per_page: "25",
    },
    2,
  );
  const vendeurs = resultats.map((r) => lireVendeurProbable(r, annee)).filter((v): v is VendeurProbable => v !== null);
  return { vendeurs: ordonnerVendeurs(vendeurs), lues: resultats.length, total };
}
