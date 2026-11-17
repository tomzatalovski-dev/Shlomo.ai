import { chercherParActivite, chercherSociete, compterMetier } from "./registre";
import { chercherRachats, direRachat, type Rachat } from "./acheteurs";
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

/** Au-delà, des comptes ne disent plus rien de la société d'aujourd'hui : on ne les cite pas et ils ne comptent pas. */
export const COMPTES_RECENTS = 3;

/**
 * Note un candidat et écrit ses raisons, à partir des seuls faits du registre.
 * Cinq critères : lien avec le métier, proximité, taille, santé des comptes, ancienneté et implantation.
 * Les raisons sont rangées de la plus parlante à la moins parlante ; ce qui joue contre lui part dans les réserves, jamais dans les raisons.
 */
export function noter(vendeur: Societe, candidat: Societe, profil: ProfilRepreneur, metier?: Metier, annee = new Date().getFullYear()): Repreneur {
  const voisin = metier?.lien === "voisin";
  let score = (voisin ? 42 : 48) + (profil === "departement" ? 10 : profil === "region" ? 6 : 2);
  const atouts: { texte: string; force: number }[] = [];
  const reserves: string[] = [];
  const dire = (force: number, texte: string) => atouts.push({ texte, force });

  const rapport = rapportDeTaille(vendeur, candidat);
  if (rapport !== undefined) {
    const fois = rapport >= 10 ? Math.round(rapport / 5) * 5 : Math.round(rapport);
    // Le bon repreneur est assez grand pour absorber le vendeur, pas au point de ne pas le voir.
    if (rapport >= 3 && rapport <= 10) score += 14;
    else if (rapport >= 2 && rapport < 3) score += 10;
    else if (rapport > 10 && rapport <= 30) score += 9;
    else if (rapport > 30 && rapport <= 100) score += 5;
    else score += 3;
    dire(rapport >= 2 && rapport <= 10 ? 3 : 2, fois >= 2 ? `Environ ${fois} fois votre taille` : "Un peu plus grande que vous");
  } else {
    dire(1, "Plus grande que vous");
  }

  const comptes = candidat.finances.filter((f) => (f.chiffreAffaires !== undefined || f.resultat !== undefined) && f.annee >= annee - COMPTES_RECENTS);
  const dernier = comptes.at(-1);
  if (dernier?.resultat !== undefined) {
    const marge = dernier.chiffreAffaires && dernier.chiffreAffaires > 0 ? dernier.resultat / dernier.chiffreAffaires : undefined;
    if (dernier.resultat <= 0) {
      score -= 14;
      reserves.push(`Résultat négatif publié en ${dernier.annee}`);
    } else if (marge !== undefined) {
      score += marge >= 0.08 ? 12 : marge >= 0.03 ? 9 : 6;
      dire(marge >= 0.08 ? 5 : 4, `Rentable : ${pourcent(marge * 100)} % de marge nette en ${dernier.annee}`);
    } else {
      score += 6;
      dire(4, `Rentable : résultat positif publié en ${dernier.annee}`);
    }
  }

  const caVendeur = vendeur.finances.at(-1)?.chiffreAffaires;
  if (dernier?.chiffreAffaires && caVendeur && dernier.chiffreAffaires >= 3 * caVendeur) {
    score += 6;
    dire(2, "Chiffre d'affaires au moins trois fois supérieur au vôtre");
  }

  // La croissance se mesure jusqu'à six ans en arrière, à condition que le dernier chiffre soit récent.
  const ventes = candidat.finances.filter((f) => f.chiffreAffaires && f.chiffreAffaires > 0 && f.annee >= annee - 2 * COMPTES_RECENTS);
  if (ventes.length >= 2 && ventes.at(-1)!.annee >= annee - COMPTES_RECENTS) {
    const evolution = ventes.at(-1)!.chiffreAffaires! / ventes[0].chiffreAffaires! - 1;
    if (evolution >= 0.1) {
      score += 5;
      dire(6, `En croissance : chiffre d'affaires en hausse de ${Math.round(evolution * 100)} % depuis ${ventes[0].annee}`);
    } else if (evolution <= -0.1) {
      score -= 5;
      reserves.push(`Chiffre d'affaires en baisse de ${Math.round(-evolution * 100)} % depuis ${ventes[0].annee}`);
    }
  }

  if (candidat.etablissements && candidat.etablissements >= 2) {
    score += candidat.etablissements >= 5 ? 5 : 3;
    dire(candidat.etablissements >= 5 ? 5 : 3, `Déjà ${candidat.etablissements} établissements : elle sait en intégrer un de plus`);
  }

  const age = candidat.anneeCreation ? annee - candidat.anneeCreation : 0;
  if (age >= 10) {
    score += Math.min(5, 2 + Math.floor(age / 10));
    dire(1, age >= 25 ? `Installée depuis ${age} ans` : "Installée depuis plus de dix ans");
  }

  if (voisin && metier?.libelle) dire(0, `Son métier : ${metier.libelle.toLowerCase()}`);

  // Tri stable : à force égale, l'ordre d'écriture est gardé.
  const raisons = atouts.map((a, i) => ({ ...a, i })).sort((x, y) => y.force - x.force || x.i - y.i).map((a) => a.texte);
  return { societe: candidat, profil, metier, score: Math.max(1, Math.min(score, 97)), raisons, reserves };
}

/** Deux repreneurs ne portent pas le même titre : le suivant met en avant sa raison suivante, s'il en a une autre. */
export function distinguer(repreneurs: Repreneur[]): Repreneur[] {
  const pris = new Set<string>();
  return repreneurs.map((r) => {
    const libre = r.raisons.findIndex((x) => !pris.has(x));
    const raisons = libre > 0 ? [r.raisons[libre], ...r.raisons.filter((_, i) => i !== libre)] : r.raisons;
    if (raisons[0]) pris.add(raisons[0]);
    return { ...r, raisons };
  });
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

export type Passage = { profil: ProfilRepreneur; libelle: string; metier?: Metier; trouvees: number; echec?: boolean; candidats: CandidatMasque[]; rachats?: boolean };

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
/** Une société qui a déjà racheté un fonds du métier a montré qu'elle achète : c'est sa première raison, et elle gagne des points. */
export function avecRachat(r: Repreneur, rachat?: Rachat): Repreneur {
  return rachat ? { ...r, score: Math.min(97, r.score + 12), raisons: [direRachat(rachat), ...r.raisons] } : r;
}

export function classer(vendeur: Societe, lots: { profil: ProfilRepreneur; metier?: Metier; societes: Societe[] }[], maximum = 10, rachats: Map<string, Rachat> = new Map()): Repreneur[] {
  const vus = new Set<string>();
  const retenus: Repreneur[] = [];
  for (const lot of lots) {
    for (const s of lot.societes) {
      if (vus.has(s.siren) || !retenable(vendeur, s)) continue;
      vus.add(s.siren);
      retenus.push(avecRachat(noter(vendeur, s, lot.profil, lot.metier), rachats.get(s.siren)));
    }
  }
  // À note égale : le plus gros chiffre d'affaires publié, puis le plus grand effectif.
  const ventes = (r: Repreneur) => r.societe.finances.at(-1)?.chiffreAffaires ?? 0;
  const taille = (r: Repreneur) => TRANCHES.indexOf(r.societe.trancheEffectif ?? "NN");
  return distinguer(retenus.sort((a, b) => b.score - a.score || ventes(b) - ventes(a) || taille(b) - taille(a)).slice(0, maximum));
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
    reserves: r.reserves,
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
    reserves: r.reserves,
  }));
}

/** Nombre de fiches d'acheteurs, trouvés au bulletin officiel, qu'une recherche s'autorise à lire au registre. */
const ACHETEURS_MAX = 8;

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

  // Ceux qui achètent déjà : rachats de fonds du métier publiés au bulletin officiel, dans la région du vendeur.
  const rachats = await chercherRachats(metiers, vendeur.region);
  if (rachats.size > 0) {
    const inconnus = [...rachats.keys()].filter((s) => !dejaVues.has(s)).slice(0, ACHETEURS_MAX);
    const fiches = (await Promise.all(inconnus.map((s) => chercherSociete(s).catch(() => null)))).filter((s): s is Societe => Boolean(s));
    const assezGrande = (s: Societe) => !vendeur.trancheEffectif || TRANCHES.indexOf(s.trancheEffectif ?? "NN") >= Math.max(TRANCHES.indexOf(vendeur.trancheEffectif), TRANCHES.indexOf("01"));
    const anciennes = fiches.filter((s) => assezGrande(s) && s.anneeCreation !== undefined && new Date().getFullYear() - s.anneeCreation >= 3);
    examinees += fiches.length;
    const proche = (s: Societe): ProfilRepreneur => (vendeur.departement && s.departement === vendeur.departement ? "departement" : "region");
    for (const profil of ["departement", "region"] as const) {
      const societes = anciennes.filter((s) => proche(s) === profil);
      if (societes.length) lots.push({ profil, metier: metiers[0], societes });
    }
    for (const s of fiches) dejaVues.add(s.siren);
    suivre({
      profil: "region",
      libelle: "A déjà racheté un fonds de votre métier",
      metier: metiers[0],
      trouvees: rachats.size,
      rachats: true,
      candidats: fiches.map((s) => (anciennes.includes(s) ? examiner(vendeur, s, proche(s), metiers[0]) : { effectif: s.effectif, anneeCreation: s.anneeCreation, retenu: false, motif: "Trop petite ou trop récente pour vous reprendre" })),
    });
  }

  return { repreneurs: classer(vendeur, lots, 10, rachats), examinees };
}
