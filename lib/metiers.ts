import type { Metier } from "./types";

/** Forme d'un code d'activité français : « 43.32A ». */
export const CODE = /^\d{2}\.\d{2}[A-Z]$/;

const MAXIMUM = 4;

function libellePropre(texte: unknown): string {
  return typeof texte === "string" ? texte.replace(/[^\p{L}\p{N} ,'’()\-]/gu, "").trim().slice(0, 70) : "";
}

/** Nettoie une liste d'activités venue de l'IA ou du navigateur : codes bien formés, sans doublon, quatre au plus. */
export function nettoyerMetiers(brut: unknown): Metier[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const propres: Metier[] = [];
  for (const m of brut) {
    const code = typeof m?.code === "string" ? m.code.trim().toUpperCase() : "";
    if (!CODE.test(code) || vus.has(code)) continue;
    vus.add(code);
    propres.push({ code, libelle: libellePropre(m?.libelle), lien: m?.lien === "meme" ? "meme" : "voisin" });
    if (propres.length === MAXIMUM) break;
  }
  return propres;
}

/**
 * Activités où chercher : celles transmises par la page, sinon le seul code du registre.
 * Les activités « même métier » passent avant les voisines.
 */
export function lireMetiers(parametre: string | null | undefined, codeRegistre?: string): Metier[] {
  let liste: Metier[] = [];
  if (parametre) {
    try {
      liste = nettoyerMetiers(JSON.parse(parametre));
    } catch {}
  }
  if (liste.length === 0 && codeRegistre && CODE.test(codeRegistre)) liste = [{ code: codeRegistre, libelle: "", lien: "meme" }];
  return [...liste.filter((m) => m.lien === "meme"), ...liste.filter((m) => m.lien === "voisin")];
}

/**
 * Réunit le code du registre et les codes proposés par l'IA.
 * Si l'IA décrit le métier par d'autres codes que celui du registre, on la suit : le code du registre est parfois administratif.
 */
export function composerMetiers(codeRegistre: string | undefined, proposes: Metier[]): Metier[] {
  const propres = nettoyerMetiers(proposes);
  const memes = propres.filter((m) => m.lien === "meme");
  const liste = [...memes, ...propres.filter((m) => m.lien === "voisin")];
  if (codeRegistre && CODE.test(codeRegistre) && memes.length === 0 && !liste.some((m) => m.code === codeRegistre)) {
    liste.unshift({ code: codeRegistre, libelle: "", lien: "meme" });
  }
  return liste.slice(0, MAXIMUM);
}
