/**
 * Lecture du dernier bilan publié d'un repreneur, au Registre national des entreprises (INPI).
 * Les montants sont ceux que l'INPI a saisis à partir des comptes déposés : rien n'est lu par une IA, rien n'est estimé.
 * Sans identifiants INPI sur le serveur, ou si les comptes sont confidentiels, la lecture rend simplement `null`.
 *
 * Documentation : « Accéder aux comptes annuels », INPI, version 4 (mai 2024).
 */

const BASE = "https://registre-national-entreprises.inpi.fr/api";

/** Au-delà, un bilan ne dit plus rien de la société d'aujourd'hui. */
const ANNEES_UTILES = 3;

export type Liasse = { code: string; m1?: unknown; m2?: unknown; m3?: unknown; m4?: unknown };
export type PageBilan = { numero?: unknown; liasses?: Liasse[] };

export type Bilan = {
  annee: number;
  /** Disponibilités et valeurs mobilières de placement. */
  tresorerie?: number;
  capitauxPropres?: number;
  /** Emprunts bancaires et dettes financières diverses. */
  dettesFinancieres?: number;
  totalBilan?: number;
};

export type LectureBilan = { annee: number; titre?: string; lignes: string[]; reserves: string[] };

export const bilanActif = () => Boolean(process.env.INPI_IDENTIFIANT && process.env.INPI_MOT_DE_PASSE);

/** Un montant de liasse arrive en texte, parfois complété de zéros ou signé. */
export function montant(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Tire les quelques lignes utiles d'une liasse.
 * Comptes complets (C) : actif net en m3, passif de l'exercice en m1.
 * Comptes simplifiés (S) : actif net en m3, passif de l'exercice en m3.
 * Tout autre format (consolidé, banque, assurance) n'est pas lu.
 */
export function extraire(typeBilan: string | undefined, dateCloture: string | undefined, pages: PageBilan[] | undefined): Bilan | null {
  const annee = Number(String(dateCloture ?? "").slice(0, 4));
  if (!annee || !pages?.length) return null;
  const lignes = new Map<string, Liasse>();
  for (const p of pages) for (const l of p.liasses ?? []) if (l?.code && !lignes.has(String(l.code))) lignes.set(String(l.code), l);
  const lire = (code: string, colonne: "m1" | "m3") => montant(lignes.get(code)?.[colonne]);
  const somme = (...v: (number | undefined)[]) => (v.every((x) => x === undefined) ? undefined : v.reduce<number>((s, x) => s + (x ?? 0), 0));

  const type = (typeBilan ?? "").toUpperCase();
  let bilan: Bilan;
  if (type === "C") {
    bilan = { annee, tresorerie: somme(lire("CF", "m3"), lire("CD", "m3")), capitauxPropres: lire("DL", "m1"), dettesFinancieres: somme(lire("DU", "m1"), lire("DV", "m1")), totalBilan: lire("EE", "m1") };
  } else if (type === "S") {
    bilan = { annee, tresorerie: somme(lire("084", "m3"), lire("080", "m3")), capitauxPropres: lire("142", "m3"), dettesFinancieres: lire("156", "m3"), totalBilan: lire("180", "m3") };
  } else return null;
  return bilan.tresorerie === undefined && bilan.capitauxPropres === undefined ? null : bilan;
}

/** Montant arrondi à deux chiffres significatifs : assez pour juger, pas assez pour retrouver la société avant le mandat. */
export function environ(n: number): string {
  const a = Math.abs(n);
  const signe = n < 0 ? "-" : "";
  const dire = (x: number, unite: string) => `${signe}${String(Number(x.toPrecision(2))).replace(".", ",")} ${unite}`;
  if (a >= 1_000_000) return dire(a / 1_000_000, "M€");
  if (a >= 1_000) return dire(a / 1_000, "k€");
  return `${signe}${Math.round(a)} €`;
}

/**
 * Dit en clair ce que le bilan apprend au vendeur : le repreneur a-t-il de quoi payer ?
 * Des faits chiffrés et datés, pas un jugement : le titre n'apparaît que si les chiffres le portent sans ambiguïté.
 */
export function direBilan(b: Bilan): LectureBilan {
  const lignes: string[] = [];
  const reserves: string[] = [];
  let titre: string | undefined;
  const fin = `fin ${b.annee}`;
  const { tresorerie: t, dettesFinancieres: d, capitauxPropres: c, totalBilan: total } = b;

  if (t !== undefined && t > 0) lignes.push(`Trésorerie : environ ${environ(t)} ${fin}`);
  if (d !== undefined) lignes.push(d > 0 ? `Dettes financières : environ ${environ(d)}` : "Aucune dette financière au bilan");
  if (c !== undefined && c > 0) lignes.push(`Capitaux propres : environ ${environ(c)}${total && total > 0 ? `, soit ${Math.round((c / total) * 100)} % du bilan` : ""}`);

  if (c !== undefined && c <= 0) reserves.push(`Capitaux propres négatifs ${fin}`);
  else if (c !== undefined && d !== undefined && d > 3 * c) reserves.push(`Dettes financières supérieures à trois fois ses capitaux propres ${fin}`);

  if (reserves.length === 0 && t !== undefined && t > 0 && d !== undefined) {
    if (d <= 0) titre = `Environ ${environ(t)} de trésorerie ${fin}, sans dette financière`;
    else if (t >= d) titre = `Environ ${environ(t)} de trésorerie ${fin}, plus que ses dettes financières`;
  }
  return { annee: b.annee, titre, lignes, reserves };
}

let jeton: { valeur: string; expire: number } | null = null;

async function seConnecter(): Promise<string | null> {
  if (jeton && jeton.expire > Date.now()) return jeton.valeur;
  const r = await fetch(`${BASE}/sso/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: process.env.INPI_IDENTIFIANT, password: process.env.INPI_MOT_DE_PASSE }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) return null;
  const valeur = ((await r.json()) as { token?: string }).token;
  if (!valeur) return null;
  jeton = { valeur, expire: Date.now() + 30 * 60_000 };
  return valeur;
}

type Depot = { id?: string; deleted?: boolean; dateCloture?: string; typeBilan?: string; bilanSaisi?: { bilan?: { identite?: { dateClotureExercice?: string; codeTypeBilan?: string }; detail?: { pages?: PageBilan[] } } } };

const clotureDe = (d: Depot) => d.dateCloture ?? d.bilanSaisi?.bilan?.identite?.dateClotureExercice ?? "";

/**
 * Dernier bilan saisi et récent d'une société. `null` si la lecture n'est pas branchée, si les comptes sont
 * confidentiels ou trop anciens, ou si l'INPI ne répond pas : la recherche continue sans.
 */
export async function lireBilan(siren: string, annee = new Date().getFullYear()): Promise<Bilan | null> {
  if (!bilanActif()) return null;
  try {
    const t = await seConnecter();
    if (!t) return null;
    const entetes = { authorization: `Bearer ${t}` };
    const r = await fetch(`${BASE}/companies/${siren}/attachments`, { headers: entetes, signal: AbortSignal.timeout(10_000) });
    if (r.status === 401) jeton = null;
    if (!r.ok) return null;
    const depots = (((await r.json()) as { bilansSaisis?: Depot[] }).bilansSaisis ?? []).filter((d) => !d.deleted && clotureDe(d));
    const dernier = depots.sort((a, b) => clotureDe(b).localeCompare(clotureDe(a)))[0];
    if (!dernier || Number(clotureDe(dernier).slice(0, 4)) < annee - ANNEES_UTILES) return null;

    let depot = dernier;
    if (!depot.bilanSaisi?.bilan?.detail?.pages?.length && depot.id) {
      const un = await fetch(`${BASE}/bilans-saisis/${depot.id}`, { headers: entetes, signal: AbortSignal.timeout(10_000) });
      if (!un.ok) return null;
      depot = (await un.json()) as Depot;
    }
    const b = depot.bilanSaisi?.bilan;
    return extraire(depot.typeBilan ?? b?.identite?.codeTypeBilan, clotureDe(depot) || clotureDe(dernier), b?.detail?.pages);
  } catch {
    return null;
  }
}
