import { motsDuMetier } from "./acheteurs";
import type { Metier } from "./types";

/**
 * Prix de vente réels : le bulletin officiel (BODACC) publie, pour chaque vente de fonds, le prix payé.
 * On en tire une fourchette pour un métier : c'est un repère daté et sourcé, pas une évaluation.
 * Ce sont des ventes de fonds de commerce ; les ventes de parts de société n'y figurent pas.
 */
const BASE = process.env.BODACC_URL ?? "https://bodacc-datadila.opendatasoft.com";
const ANNEES = 3;
const MINIMUM = 5;

export type Comparables = { ventes: number; bas: number; median: number; haut: number; depuis: number; ou: "region" | "france"; mots: string[] };

function objet(v: unknown): Record<string, any> | null {
  if (v && typeof v === "object") return v as Record<string, any>;
  if (typeof v !== "string" || !v.trim().startsWith("{")) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** Le prix d'une vente, s'il s'agit bien d'un achat ordinaire. Écartés : liquidation, location-gérance, apport, donation, partage. */
export function lirePrix(brut: Record<string, unknown>): number | null {
  const etablissement = objet(brut.listeetablissements)?.etablissement;
  const origine = String((Array.isArray(etablissement) ? etablissement[0] : etablissement)?.origineFonds ?? "");
  if (!/acquis par achat/i.test(origine) || /liquidation|redressement|location-g[ée]rance|apport|donation|partage|licitation|adjudication/i.test(origine)) return null;
  const lu = origine.match(/au prix (?:stipul[ée] |global |total )?de ([\d\s.,]+?)\s*(?:euros?|eur\b|€)/i);
  if (!lu) return null;
  const prix = Math.round(Number(lu[1].replace(/\s/g, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "")));
  return Number.isFinite(prix) && prix >= 10_000 && prix <= 50_000_000 ? prix : null;
}

/** Quart bas, milieu et quart haut d'une série de prix. Rien en dessous de cinq ventes : trop peu pour un repère. */
export function fourchetteDe(prix: number[]): { bas: number; median: number; haut: number } | null {
  if (prix.length < MINIMUM) return null;
  const tri = [...prix].sort((a, b) => a - b);
  const a = (q: number) => tri[Math.round((tri.length - 1) * q)];
  return { bas: a(0.25), median: a(0.5), haut: a(0.75) };
}

async function ventes(mots: string[], region: string | undefined, depuis: string): Promise<number[]> {
  const ou = mots.map((m) => `search(listeetablissements,"${m.replace(/"/g, "")}")`).join(" or ");
  const where = `familleavis="vente"${region ? ` and region_code=${Number(region)}` : ""} and dateparution>="${depuis}" and (${ou})`;
  const url = `${BASE}/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?limit=100&order_by=${encodeURIComponent("dateparution desc")}&select=listeetablissements&where=${encodeURIComponent(where)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
  if (!r.ok) return [];
  const lu = (await r.json()) as { results?: Record<string, unknown>[] };
  return (lu.results ?? []).map(lirePrix).filter((p): p is number => p !== null);
}

/** Les ventes du métier, dans la région d'abord, en France sinon. Rend null si le bulletin ne répond pas ou s'il y a trop peu de ventes. */
export async function chercherComparables(metiers: Metier[], region: string | undefined, aujourdhui = new Date()): Promise<Comparables | null> {
  const mots = motsDuMetier(metiers);
  if (mots.length === 0) return null;
  const debut = new Date(aujourdhui);
  debut.setFullYear(debut.getFullYear() - ANNEES);
  const depuis = debut.toISOString().slice(0, 10);
  try {
    for (const ou of ["region", "france"] as const) {
      if (ou === "region" && (!region || !/^\d+$/.test(region))) continue;
      const prix = await ventes(mots, ou === "region" ? region : undefined, depuis);
      const f = fourchetteDe(prix);
      if (f) return { ventes: prix.length, ...f, depuis: debut.getFullYear(), ou, mots };
    }
  } catch {
    // Le bulletin ne répond pas : pas de repère.
  }
  return null;
}

const k = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")} M€` : `${Math.round(n / 1000)} k€`);

/** La phrase montrée à l'écran, avec son périmètre et sa limite. */
export function direComparables(c: Comparables, region?: string): string {
  const lieu = c.ou === "region" && region ? `en ${region}` : "en France";
  return `${c.ventes} ventes de fonds « ${c.mots.join(", ")} » publiées ${lieu} depuis ${c.depuis} : la moitié se sont conclues entre ${k(c.bas)} et ${k(c.haut)}, prix médian ${k(c.median)}. Source : bulletin officiel. Ce sont des ventes de fonds, pas de sociétés entières.`;
}
