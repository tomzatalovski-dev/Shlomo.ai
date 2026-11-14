import { chercherParActivite, compterMetier } from "./registre";
import type { CandidatMasque, Metier, ProfilRepreneur, Repreneur, RepreneurMasque, RepreneurRevele, Societe } from "./types";

/**
 * Recherche sans IA : les sociétés des activités retenues, plus grandes que le vendeur,
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

const LIEU: Record<ProfilRepreneur, string> = { departement: "votre département", region: "votre région", national: "ailleurs en France" };

/** Libellé d'un repreneur : son lien avec le métier du vendeur, puis sa zone. */
export function libelleProfil(profil: ProfilRepreneur, metier?: Metier): string {
  return `${metier?.lien === "voisin" ? "Activité voisine" : "Même activité"}, ${LIEU[profil]}`;
}

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

const pourcent = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/**
 * Note un candidat et écrit ses raisons, à partir des seuls faits du registre.
 * Cinq critères : lien avec le métier, proximité, taille, santé des comptes, ancienneté et implantation.
 */
export function noter(vendeur: Societe, candidat: Societe, profil: ProfilRepreneur, metier?: Metier): Repreneur {
  const voisin = metier?.lien === "voisin";
  let score = (voisin ? 42 : 48) + (profil === "departement" ? 10 : profil === "region" ? 6 : 2);
  const raisons: string[] = [];
  if (voisin) raisons.push(metier?.libelle ? `Activité voisine de la vôtre : ${metier.libelle}` : "Activité voisine de la vôtre");

  const rapport = rapportDeTaille(vendeur, candidat);
  if (rapport !== undefined) {
    const fois = rapport >= 10 ? Math.round(rapport / 5) * 5 : Math.round(rapport);
    raisons.push(fois >= 2 ? `Environ ${fois} fois votre effectif` : "Un peu plus grande que vous");
    // Le bon repreneur est assez grand pour absorber le vendeur, pas au point de ne pas le voir.
    if (rapport >= 3 && rapport <= 10) score += 14;
    else if (rapport >= 2 && rapport < 3) score += 10;
    else if (rapport > 10 && rapport <= 30) score += 9;
    else if (rapport > 30 && rapport <= 100) score += 5;
    else score += 3;
  } else {
    raisons.push("Plus grande que vous");
  }

  const comptes = candidat.finances.filter((f) => f.chiffreAffaires !== undefined || f.resultat !== undefined);
  const dernier = comptes.at(-1);
  if (dernier?.resultat !== undefined) {
    const marge = dernier.chiffreAffaires && dernier.chiffreAffaires > 0 ? dernier.resultat / dernier.chiffreAffaires : undefined;
    if (dernier.resultat <= 0) {
      score -= 8;
      raisons.push(`Résultat négatif publié en ${dernier.annee}`);
    } else if (marge !== undefined) {
      score += marge >= 0.08 ? 12 : marge >= 0.03 ? 9 : 6;
      raisons.push(`Résultat positif en ${dernier.annee}, soit ${pourcent(marge * 100)} % du chiffre d'affaires`);
    } else {
      score += 6;
      raisons.push(`Résultat positif publié en ${dernier.annee}`);
    }
  }

  const caVendeur = vendeur.finances.at(-1)?.chiffreAffaires;
  if (dernier?.chiffreAffaires && caVendeur && dernier.chiffreAffaires >= 3 * caVendeur) {
    score += 6;
    raisons.push("Chiffre d'affaires au moins trois fois supérieur au vôtre");
  }

  const ventes = comptes.filter((f) => f.chiffreAffaires && f.chiffreAffaires > 0);
  if (ventes.length >= 2) {
    const evolution = ventes.at(-1)!.chiffreAffaires! / ventes[0].chiffreAffaires! - 1;
    if (evolution >= 0.1) {
      score += 5;
      raisons.push(`Chiffre d'affaires en hausse de ${Math.round(evolution * 100)} % depuis ${ventes[0].annee}`);
    } else if (evolution <= -0.1) {
      score -= 3;
      raisons.push(`Chiffre d'affaires en baisse de ${Math.round(-evolution * 100)} % depuis ${ventes[0].annee}`);
    }
  }

  if (candidat.etablissements && candidat.etablissements >= 2) {
    score += candidat.etablissements >= 5 ? 5 : 3;
    raisons.push(`${candidat.etablissements} établissements : elle sait gérer plusieurs sites`);
  }

  const age = candidat.anneeCreation ? new Date().getFullYear() - candidat.anneeCreation : 0;
  if (age >= 10) {
    score += Math.min(5, 2 + Math.floor(age / 10));
    raisons.push(age >= 25 ? `Installée depuis ${age} ans` : "Installée depuis plus de dix ans");
  }

  return { societe: candidat, profil, metier, score: Math.max(1, Math.min(score, 97)), raisons };
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

export type Passage = { profil: ProfilRepreneur; libelle: string; metier?: Metier; trouvees: number; echec?: boolean; candidats: CandidatMasque[] };

/** Dit, sans la nommer, ce qu'on a fait d'une société examinée. */
export function examiner(vendeur: Societe, s: Societe, profil: ProfilRepreneur, metier?: Metier): CandidatMasque {
  const fiche = { effectif: s.effectif, anneeCreation: s.anneeCreation };
  if (!s.active) return { ...fiche, retenu: false, motif: "Société cessée" };
  if (s.entrepreneurIndividuel) return { ...fiche, retenu: false, motif: "Entrepreneur individuel, pas une société" };
  if (s.refuseProspection) return { ...fiche, retenu: false, motif: "Elle a demandé à ne pas être sollicitée" };
  const note = noter(vendeur, s, profil, metier);
  return { ...fiche, retenu: true, score: note.score, raison: note.raisons[0], details: note.raisons.slice(1) };
}

/** Classe les candidats de plusieurs passages, sans doublon, du meilleur au moins bon. */
export function classer(vendeur: Societe, lots: { profil: ProfilRepreneur; metier?: Metier; societes: Societe[] }[], maximum = 10): Repreneur[] {
  const vus = new Set<string>();
  const retenus: Repreneur[] = [];
  for (const lot of lots) {
    for (const s of lot.societes) {
      if (vus.has(s.siren) || !retenable(vendeur, s)) continue;
      vus.add(s.siren);
      retenus.push(noter(vendeur, s, lot.profil, lot.metier));
    }
  }
  // À note égale : le plus gros chiffre d'affaires publié, puis le plus grand effectif.
  const ventes = (r: Repreneur) => r.societe.finances.at(-1)?.chiffreAffaires ?? 0;
  const taille = (r: Repreneur) => TRANCHES.indexOf(r.societe.trancheEffectif ?? "NN");
  return retenus.sort((a, b) => b.score - a.score || ventes(b) - ventes(a) || taille(b) - taille(a)).slice(0, maximum);
}

/** Retire tout ce qui permettrait d'identifier le repreneur avant la signature du mandat. */
export function masquer(repreneurs: Repreneur[]): RepreneurMasque[] {
  return repreneurs.map((r, i) => ({
    rang: i + 1,
    profil: libelleProfil(r.profil, r.metier),
    zone: ZONE[r.profil],
    effectif: r.societe.effectif,
    score: r.score,
    raison: r.raisons[0],
    details: r.raisons.slice(1),
  }));
}

/** Liste complète, réservée au vendeur qui a signé le mandat. */
export function reveler(repreneurs: Repreneur[]): RepreneurRevele[] {
  return repreneurs.map((r, i) => ({
    rang: i + 1,
    nom: r.societe.nom,
    siren: r.societe.siren,
    ville: r.societe.ville,
    effectif: r.societe.effectif,
    profil: libelleProfil(r.profil, r.metier),
    score: r.score,
    raisons: r.raisons,
  }));
}

/** Nombre d'appels au registre qu'une recherche s'autorise. */
const APPELS_MAX = 9;

/**
 * Interroge le registre, activité par activité : département, région, puis France pour le métier du vendeur ;
 * région puis France pour les activités voisines. `suivre` reçoit le compte de chaque passage.
 */
export async function trouverRepreneurs(
  vendeur: Societe,
  suivre: (p: Passage) => void = () => {},
  metier: (total: number) => void = () => {},
  metiers: Metier[] = vendeur.codeActivite ? [{ code: vendeur.codeActivite, libelle: "", lien: "meme" }] : [],
): Promise<{ repreneurs: Repreneur[]; examinees: number }> {
  if (metiers.length === 0) return { repreneurs: [], examinees: 0 };

  // Le nombre total de sociétés de ces activités donne l'échelle du tri. S'il manque, la recherche continue.
  try {
    const totaux = await Promise.all(metiers.map((m) => compterMetier(m.code).catch(() => undefined)));
    const total = totaux.reduce<number>((somme, t) => somme + (t ?? 0), 0);
    if (total) metier(total);
  } catch {}
  const dejaVues = new Set<string>([vendeur.siren]);

  const tranches = tranchesAuDessus(vendeur.trancheEffectif);
  const grandes = tranches.filter((t) => TRANCHES.indexOf(t) >= TRANCHES.indexOf("21"));
  const lots: { profil: ProfilRepreneur; metier: Metier; societes: Societe[] }[] = [];
  let examinees = 0;
  let tentes = 0;
  let derniereErreur: unknown;

  const passage = async (m: Metier, profil: ProfilRepreneur, zone: { departement?: string; region?: string }, t: string[]) => {
    if (t.length === 0 || tentes >= APPELS_MAX) return;
    tentes++;
    const libelle = libelleProfil(profil, m);
    try {
      const societes = await chercherParActivite({ codeActivite: m.code, tranches: t, ...zone });
      examinees += societes.length;
      lots.push({ profil, metier: m, societes });
      const candidats: CandidatMasque[] = [];
      for (const s of societes) {
        if (dejaVues.has(s.siren)) continue;
        dejaVues.add(s.siren);
        candidats.push(examiner(vendeur, s, profil, m));
      }
      suivre({ profil, libelle, metier: m, trouvees: societes.length, candidats });
    } catch (e) {
      // Un résultat partiel vaut mieux qu'une erreur : on continue avec les autres passages.
      derniereErreur = e;
      suivre({ profil, libelle, metier: m, trouvees: 0, echec: true, candidats: [] });
    }
  };

  for (const m of metiers) {
    if (m.lien === "meme" && vendeur.departement) await passage(m, "departement", { departement: vendeur.departement }, tranches);
    if (vendeur.region) await passage(m, "region", { region: vendeur.region }, tranches);
    await passage(m, "national", {}, grandes.length ? grandes : tranches);
  }

  if (tentes > 0 && lots.length === 0) throw derniereErreur;

  return { repreneurs: classer(vendeur, lots), examinees };
}
