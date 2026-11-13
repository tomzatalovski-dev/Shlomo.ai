import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { luhnValide } from "./saisie";
import type { LectureSite } from "./types";

const AGENT = "ShlomoBot/0.1 (lecture ponctuelle a la demande du dirigeant)";
const TAILLE_MAX = 600_000;
const PAGES_LEGALES = ["mentions-legales", "mentions-legales/", "mentions", "legal", "cgv"];

/** Vrai pour une adresse privée, locale ou réservée : on ne s'y connecte jamais. */
export function adressePrivee(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function hotePublic(hote: string): Promise<boolean> {
  if (isIP(hote) || !hote.includes(".")) return false;
  try {
    const adresses = await lookup(hote, { all: true });
    return adresses.length > 0 && adresses.every((a) => !adressePrivee(a.address));
  } catch {
    return false;
  }
}

/**
 * Lit une page publique. L'adresse vient d'un inconnu : on refuse tout ce qui
 * n'est pas http(s) vers un hôte public, et on revérifie à chaque redirection.
 */
async function lirePage(adresse: string): Promise<string | null> {
  let url = new URL(adresse);
  for (let saut = 0; saut < 4; saut++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!(await hotePublic(url.hostname))) return null;

    const rep = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": AGENT, accept: "text/html,text/plain" },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (rep.status >= 300 && rep.status < 400) {
      const suite = rep.headers.get("location");
      if (!suite) return null;
      url = new URL(suite, url);
      continue;
    }
    if (!rep.ok) return null;
    const type = rep.headers.get("content-type") ?? "";
    if (!type.includes("text/")) return null;
    return (await rep.text()).slice(0, TAILLE_MAX);
  }
  return null;
}

/** Vrai si le robots.txt du site interdit toute lecture à tous les robots. */
export function lectureInterdite(robots: string): boolean {
  let pourTous = false;
  for (const ligne of robots.split(/\r?\n/)) {
    const l = ligne.split("#")[0].trim().toLowerCase();
    if (l.startsWith("user-agent:")) pourTous = l.slice(11).trim() === "*";
    else if (pourTous && l.startsWith("disallow:") && l.slice(9).trim() === "/") return true;
  }
  return false;
}

export function texteBrut(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cherche un SIREN ou SIRET annoncé comme tel dans un texte (mentions légales). */
export function extraireSiren(texte: string): string | undefined {
  const motif = /(?:siren|siret|rcs|r\.c\.s\.?)[^0-9]{0,60}((?:\d[\s. ]?){9,14})/gi;
  for (const m of texte.matchAll(motif)) {
    const chiffres = m[1].replace(/\D/g, "");
    const siren = chiffres.slice(0, 9);
    if (siren.length === 9 && luhnValide(siren)) return siren;
  }
  return undefined;
}

function balise(html: string, motif: RegExp): string | undefined {
  const m = html.match(motif);
  const v = m?.[1]?.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, 300) : undefined;
}

/** Lit la page d'accueil et les mentions légales d'un site. Renvoie null si rien n'est lisible. */
export async function lireSite(domaine: string): Promise<LectureSite | null> {
  const racine = `https://${domaine}/`;

  const robots = await lirePage(`${racine}robots.txt`).catch(() => null);
  if (robots && lectureInterdite(robots)) return null;

  const accueil = await lirePage(racine).catch(() => null);
  if (!accueil) return null;

  const pagesLues = ["/"];
  let texte = texteBrut(accueil);
  let sirenTrouve = extraireSiren(texte);

  for (const chemin of PAGES_LEGALES) {
    if (sirenTrouve) break;
    const page = await lirePage(racine + chemin).catch(() => null);
    if (!page) continue;
    pagesLues.push(`/${chemin}`);
    const t = texteBrut(page);
    sirenTrouve = extraireSiren(t);
    texte += " " + t;
  }

  return {
    domaine,
    titre: balise(accueil, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: balise(accueil, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    pagesLues,
    sirenTrouve,
    texte: texte.slice(0, 8000),
  };
}
