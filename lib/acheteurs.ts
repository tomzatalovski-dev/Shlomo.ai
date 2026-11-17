import type { Metier } from "./types";

/**
 * Les sociétés qui achètent déjà : le bulletin officiel (BODACC) publie chaque rachat de fonds de commerce,
 * avec l'acheteur, l'activité du fonds et la date. C'est une publication légale, gratuite, sans clé.
 * Une société qui a racheté un fonds de votre métier près de chez vous a montré qu'elle achète : elle passe devant.
 */
const BASE = process.env.BODACC_URL ?? "https://bodacc-datadila.opendatasoft.com";

/** Un rachat de plus de trois ans ne dit plus grand-chose de l'appétit d'aujourd'hui. */
const ANNEES = 3;

export type Rachat = { siren: string; date: string; activite?: string; url: string };

type Brut = Record<string, unknown>;

function objet(v: unknown): Record<string, any> | null {
  if (v && typeof v === "object") return v as Record<string, any>;
  if (typeof v !== "string" || !v.trim().startsWith("{")) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

const propre = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Lit une annonce de vente et rend l'acheteur, s'il s'agit bien d'une société qui s'agrandit.
 * Écartés : l'acheteur personne physique, la société créée pour l'occasion (« lors de l'immatriculation »),
 * et le locataire-gérant qui rachète le fonds qu'il exploitait déjà.
 */
export function lireRachat(r: Brut): Rachat | null {
  const id = propre(r.id, 40);
  const date = propre(r.dateparution, 10);
  if (!/^[A-Z]?\d{6,}$/i.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const personne = objet(r.listepersonnes)?.personne;
  if (!personne || Array.isArray(personne) || personne.typePersonne !== "pm") return null;
  const siren = String(personne.numeroImmatriculation?.numeroIdentification ?? "").replace(/\s/g, "");
  if (!/^\d{9}$/.test(siren)) return null;
  const categorie = propre(objet(r.acte)?.vente?.categorieVente, 200).toLowerCase();
  // Seuls comptent les achats faits par une société qui existait déjà. Sont écartés : la société créée pour l'occasion
  // (« lors de l'immatriculation », « mise en activité suite à achat », apport) et le locataire-gérant.
  if (!/^achat d'un (fonds|établissement)/.test(categorie) || /immatriculation|locataire/.test(categorie)) return null;
  const etablissement = objet(r.listeetablissements)?.etablissement;
  const activite = propre((Array.isArray(etablissement) ? etablissement[0] : etablissement)?.activite, 140);
  return { siren, date, ...(activite ? { activite } : {}), url: `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:${id}` };
}

/** Mots trop généraux pour reconnaître un métier dans le texte d'une annonce. */
const VAGUES = new Set(["travaux", "activites", "autres", "autre", "commerce", "detail", "services", "service", "fabrication", "production", "entreprises", "specialise", "specialises", "magasin", "magasins", "generale", "general", "divers", "diverses", "installation", "location", "conseil", "gestion", "soutien", "vente", "ventes", "produits", "articles", "materiel", "equipements", "exclusion", "compris", "nature", "traditionnelle", "rapide"]);

/** Les deux mots les plus parlants des libellés de métier : « Travaux de menuiserie bois et PVC » donne « menuiserie ». */
export function motsDuMetier(metiers: Metier[]): string[] {
  const mots: string[] = [];
  // Le métier du vendeur d'abord : les mots d'un métier voisin ramènent des ventes sans rapport.
  const propres = metiers.filter((m) => m.lien === "meme");
  for (const m of propres.length ? propres : metiers) {
    for (const brut of (m.libelle ?? "").toLowerCase().split(/[^a-zà-ÿ]+/)) {
      const sans = brut.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (brut.length >= 6 && !VAGUES.has(sans) && !mots.includes(brut)) mots.push(brut);
    }
  }
  return mots.slice(0, 2);
}

/**
 * Rachats de fonds publiés depuis trois ans dans la région du vendeur, pour son métier. Le plus récent par acheteur,
 * et le nombre total de ventes publiées : il dit si le métier se vend dans la région. Rend une table vide si le bulletin ne répond pas ou si le métier n'a pas de mot reconnaissable : la recherche continue sans.
 */
export type Rachats = { parAcheteur: Map<string, Rachat>; ventes: number };

export async function chercherRachats(metiers: Metier[], region: string | undefined, aujourdhui = new Date()): Promise<Rachats> {
  const parAcheteur = new Map<string, Rachat>();
  const trouves = { parAcheteur, ventes: 0 };
  const mots = motsDuMetier(metiers);
  if (mots.length === 0 || !region || !/^\d+$/.test(region)) return trouves;
  const depuis = new Date(aujourdhui);
  depuis.setFullYear(depuis.getFullYear() - ANNEES);
  const ou = mots.map((m) => `search(listeetablissements,"${m.replace(/"/g, "")}")`).join(" or ");
  const where = `familleavis="vente" and region_code=${Number(region)} and dateparution>="${depuis.toISOString().slice(0, 10)}" and (${ou})`;
  const url = `${BASE}/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?limit=100&order_by=${encodeURIComponent("dateparution desc")}&select=${encodeURIComponent("id,dateparution,listepersonnes,listeetablissements,acte")}&where=${encodeURIComponent(where)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return trouves;
    const lu = (await r.json()) as { total_count?: number; results?: Brut[] };
    trouves.ventes = typeof lu.total_count === "number" ? lu.total_count : (lu.results?.length ?? 0);
    for (const brut of lu.results ?? []) {
      const rachat = lireRachat(brut);
      if (rachat && !parAcheteur.has(rachat.siren)) parAcheteur.set(rachat.siren, rachat);
    }
  } catch {
    // Le bulletin ne répond pas : on continue sans les rachats.
  }
  return trouves;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** La raison écrite sur la carte : un fait daté, avec sa source. */
export function direRachat(r: Rachat): string {
  const [annee, mois] = r.date.split("-").map(Number);
  return `A racheté un fonds de votre métier dans votre région en ${MOIS[mois - 1]} ${annee}, selon le bulletin officiel`;
}
