import { chercherParActivite } from "./registre";
import type { ProfilRepreneur, Repreneur, RepreneurMasque, Societe } from "./types";

/**
 * Premier passage, sans IA : les sociétés du même métier, plus grandes que le vendeur,
 * d'abord dans son département, puis dans sa région, puis en France.
 * Tout ce qui est affiché vient du registre. Rien n'est supposé.
 */

/** Tranches d'effectif de l'INSEE, de la plus petite à la plus grande. */
export const TRANCHES = ["NN", "00", "01", "02", "03", "11", "12", "21", "22", "31", "32", "41", "42", "51", "52", "53"];

/** Effectif médian approximatif de chaque tranche, pour comparer deux sociétés. */
const MEDIANE: Record<string, number> = {
  NN: 0, "00": 0, "01": 1.5, "02": 4, "03": 7.5, "11": 15, "12": 35, "21": 75, "22": 150,
  "31": 225, "32": 375, "41": 750, "42": 1500, "51": 3500, "52": 7500, "53": 15000,
};

const LIBELLE_PROFIL: Record<ProfilRepreneur, string> = {
  departement: "Même code d'activité, votre département",
  region: "Même code d'activité, votre région",
  national: "Même code d'activité, ailleurs en France",
};

const ZONE: Record<ProfilRepreneur, string> = {
  departement: "Dans votre département",
  region: "Dans votre région",
  national: "Ailleurs en France",
};

/** Tranches strictement au-dessus de celle du vendeur. Sans tranche connue : à partir de 10 salariés. */
export function tranchesAuDessus(tranche?: string): string[] {
  const i = tranche ? TRANCHES.indexOf(tranche) : -1;
  const depart = i >= 0 ? i + 1 : TRANCHES.indexOf("11");
  return TRANCHES.slice(Math.max(depart, TRANCHES.indexOf("01")));
}

function rapportDeTaille(vendeur: Societe, candidat: Societe): number | undefined {
  const v = vendeur.trancheEffectif ? MEDIANE[vendeur.trancheEffectif] : undefined;
  const c = candidat.trancheEffectif ? MEDIANE[candidat.trancheEffectif] : undefined;
  if (!v || !c) return undefined;
  return c / v;
}

/** Note un candidat et écrit ses raisons, à partir des seuls faits du registre. */
export function noter(vendeur: Societe, candidat: Societe, profil: ProfilRepreneur): Repreneur {
  let score = profil === "departement" ? 62 : profil === "region" ? 56 : 50;
  const raisons: string[] = [];

  const rapport = rapportDeTaille(vendeur, candidat);
  if (rapport !== undefined) {
    const fois = rapport >= 10 ? Math.round(rapport / 5) * 5 : Math.round(rapport);
    raisons.push(fois >= 2 ? `Environ ${fois} fois votre effectif` : "Un peu plus grande que vous");
    if (rapport >= 2 && rapport <= 12) score += 14;
    else if (rapport > 12 && rapport <= 60) score += 8;
    else score += 3;
  } else {
    raisons.push("Plus grande que vous");
  }

  const dernier = candidat.finances.at(-1);
  if (dernier?.resultat !== undefined) {
    if (dernier.resultat > 0) {
      score += 10;
      raisons.push(`Résultat positif publié en ${dernier.annee}`);
    } else {
      score -= 8;
      raisons.push(`Résultat négatif publié en ${dernier.annee}`);
    }
  }

  const caVendeur = vendeur.finances.at(-1)?.chiffreAffaires;
  if (dernier?.chiffreAffaires && caVendeur && dernier.chiffreAffaires >= 3 * caVendeur) {
    score += 6;
    raisons.push("Chiffre d'affaires au moins trois fois supérieur au vôtre");
  }

  if (candidat.anneeCreation && new Date().getFullYear() - candidat.anneeCreation >= 10) {
    score += 3;
    raisons.push("Installée depuis plus de dix ans");
  }

  return { societe: candidat, profil, score: Math.max(1, Math.min(score, 97)), raisons };
}

/** Écarte ce qui ne peut pas être un repreneur, ou qu'on n'a pas le droit de solliciter. */
export function retenable(vendeur: Societe, candidat: Societe): boolean {
  return (
    candidat.siren !== vendeur.siren &&
    candidat.active &&
    !candidat.entrepreneurIndividuel &&
    !candidat.refuseProspection
  );
}

export type Passage = { profil: ProfilRepreneur; trouvees: number };

/** Classe les candidats de plusieurs passages, sans doublon, du meilleur au moins bon. */
export function classer(vendeur: Societe, lots: { profil: ProfilRepreneur; societes: Societe[] }[], maximum = 10): Repreneur[] {
  const vus = new Set<string>();
  const retenus: Repreneur[] = [];
  for (const lot of lots) {
    for (const s of lot.societes) {
      if (vus.has(s.siren) || !retenable(vendeur, s)) continue;
      vus.add(s.siren);
      retenus.push(noter(vendeur, s, lot.profil));
    }
  }
  return retenus.sort((a, b) => b.score - a.score).slice(0, maximum);
}

/** Retire tout ce qui permettrait d'identifier le repreneur avant la signature du mandat. */
export function masquer(repreneurs: Repreneur[]): RepreneurMasque[] {
  return repreneurs.map((r, i) => ({
    rang: i + 1,
    profil: LIBELLE_PROFIL[r.profil],
    zone: ZONE[r.profil],
    effectif: r.societe.effectif,
    score: r.score,
    raison: r.raisons[0],
    details: r.raisons.slice(1),
  }));
}

/** Interroge le registre en trois passages. `suivre` reçoit le compte de chaque passage. */
export async function trouverRepreneurs(
  vendeur: Societe,
  suivre: (p: Passage) => void = () => {},
): Promise<{ repreneurs: Repreneur[]; examinees: number }> {
  if (!vendeur.codeActivite) return { repreneurs: [], examinees: 0 };

  const tranches = tranchesAuDessus(vendeur.trancheEffectif);
  const grandes = tranches.filter((t) => TRANCHES.indexOf(t) >= TRANCHES.indexOf("21"));
  const lots: { profil: ProfilRepreneur; societes: Societe[] }[] = [];
  let examinees = 0;

  const passage = async (profil: ProfilRepreneur, zone: { departement?: string; region?: string }, t: string[]) => {
    if (t.length === 0) return;
    const societes = await chercherParActivite({ codeActivite: vendeur.codeActivite!, tranches: t, ...zone });
    examinees += societes.length;
    lots.push({ profil, societes });
    suivre({ profil, trouvees: societes.length });
  };

  if (vendeur.departement) await passage("departement", { departement: vendeur.departement }, tranches);
  if (vendeur.region) await passage("region", { region: vendeur.region }, tranches);
  await passage("national", {}, grandes.length ? grandes : tranches);

  return { repreneurs: classer(vendeur, lots), examinees };
}
