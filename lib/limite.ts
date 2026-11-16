import { createHash } from "node:crypto";
import { sousLePlafond } from "./base";

/**
 * Première barrière : limite par adresse, gardée en mémoire. Elle ne vaut que pour un serveur ;
 * les routes qui coûtent de l'IA passent en plus par `plafondAtteint`, tenu dans la base.
 */
const appels = new Map<string, number[]>();

export function tropDappels(cle: string, maximum = 10, fenetreMs = 60_000): boolean {
  const maintenant = Date.now();
  const recents = (appels.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
  recents.push(maintenant);
  appels.set(cle, recents);
  return recents.length > maximum;
}

export function adresseDe(requete: Request): string {
  return requete.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

/** L'adresse n'est jamais écrite en clair dans la base : seule une empreinte courte sert de clé. */
const empreinte = (adresse: string) => createHash("sha256").update(adresse).digest("hex").slice(0, 16);

/**
 * Plafonds tenus dans la base pour une route qui coûte de l'IA : par visiteur et par heure, puis pour tout le site et par jour.
 * Le plafond du site borne la dépense quoi qu'il arrive, même si un robot change d'adresse à chaque appel.
 */
export async function plafondAtteint(route: string, requete: Request, parHeure: number, parJour: number): Promise<"visiteur" | "site" | false> {
  if (!(await sousLePlafond(`${route}:${empreinte(adresseDe(requete))}`, 3600, parHeure))) return "visiteur";
  if (!(await sousLePlafond(`${route}:site`, 86400, parJour))) return "site";
  return false;
}

export const messagePlafond = (qui: "visiteur" | "site") =>
  qui === "visiteur" ? "Vous avez lancé beaucoup de recherches en peu de temps. Réessayez dans une heure." : "Shlomo est très demandé aujourd'hui. Réessayez demain, ou écrivez-nous.";
