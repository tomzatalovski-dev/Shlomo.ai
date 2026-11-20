import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Ce que coûte une étape du parcours : nombre d'appels au modèle, jetons lus et écrits, recherches web, durée.
 * Chaque route qui fait travailler l'IA ouvre un relevé ; `lib/ia.ts` y inscrit chaque réponse du modèle.
 * Hors relevé (tests, appels isolés), compter ne fait rien.
 */
export type Releve = { appels: number; entree: number; sortie: number; recherches: number };

const releves = new AsyncLocalStorage<Releve>();

type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number; server_tool_use?: { web_search_requests?: number } };

/**
 * Prix du modèle fin (Claude Sonnet 5.5 : 2 $ et 10 $ par million de jetons) rapporté au modèle courant (Claude Haiku 5.5 : 0,10 $ et 0,50 $).
 * Le relevé compte en « jetons du modèle courant » : un jeton du modèle fin y pèse vingt, pour que le coût affiché reste juste
 * quand les deux modèles travaillent dans la même étape. Une lecture en cache du modèle fin (0,10 $) pèse un.
 */
export const POIDS_FIN = 20;

/** Inscrit une réponse du modèle dans le relevé en cours, s'il y en a un. */
export function compter(usage: Usage | undefined, poids = 1): void {
  const r = releves.getStore();
  if (!r || !usage) return;
  r.appels += 1;
  const cacheLu = usage.cache_read_input_tokens ?? 0;
  const cacheEcrit = usage.cache_creation_input_tokens ?? 0;
  r.entree += Math.round((usage.input_tokens ?? 0) * poids + cacheEcrit * poids * 1.25 + cacheLu * (poids > 1 ? poids * 0.05 : 0.1));
  r.sortie += (usage.output_tokens ?? 0) * poids;
  r.recherches += usage.server_tool_use?.web_search_requests ?? 0;
}

/** Ouvre un relevé pour toute la suite de la requête en cours. À clore avec `clore`. */
export function ouvrir(): Releve & { debut: number } {
  const releve = { appels: 0, entree: 0, sortie: 0, recherches: 0, debut: Date.now() };
  releves.enterWith(releve);
  return releve;
}

export function clore(r: Releve & { debut: number }): Releve & { duree_ms: number } {
  return { appels: r.appels, entree: r.entree, sortie: r.sortie, recherches: r.recherches, duree_ms: Date.now() - r.debut };
}

/** Exécute un travail sous relevé et rend ce qu'il a consommé, avec sa durée. */
export async function relever(travail: () => Promise<void>): Promise<Releve & { duree_ms: number }> {
  const releve: Releve = { appels: 0, entree: 0, sortie: 0, recherches: 0 };
  const debut = Date.now();
  await releves.run(releve, travail);
  return { ...releve, duree_ms: Date.now() - debut };
}

/** Prix publics du modèle courant (Claude Haiku 5.5, requêtes de moins de 100 000 jetons), en dollars. Relevés le 17 novembre 2026 ; Sonnet 5.5 relevé le 20 novembre. */
export const PRIX = { modele: "claude-haiku-5-5", entreeParMillion: 0.1, sortieParMillion: 0.5, parRecherche: 0.01 };

/** Coût en dollars d'un relevé, au prix du modèle par défaut. Null si un autre modèle est configuré : son prix n'est pas connu ici. */
export function cout(r: { entree: number; sortie: number; recherches: number }, modele = process.env.ANTHROPIC_MODEL ?? PRIX.modele): number | null {
  if (modele !== PRIX.modele) return null;
  return (r.entree * PRIX.entreeParMillion + r.sortie * PRIX.sortieParMillion) / 1_000_000 + r.recherches * PRIX.parRecherche;
}
