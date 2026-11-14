import type { Signal } from "./types";

export type Priorite = "prioritaire" | "normale" | "a_verifier";

/**
 * Rang d'un repreneur d'après ce que la veille a trouvé.
 * Une alerte (société en difficulté, ou elle-même rachetée) l'emporte sur tout : on vérifie avant d'écrire.
 * Un rachat passé, sans alerte, le place en tête : il a déjà montré qu'il achète.
 */
export function prioriteDe(signaux?: Signal[] | null): Priorite {
  if (signaux?.some((s) => s.genre === "alerte")) return "a_verifier";
  if (signaux?.some((s) => s.genre === "rachat")) return "prioritaire";
  return "normale";
}

const ORDRE: Record<Priorite, number> = { prioritaire: 0, normale: 1, a_verifier: 2 };

/** Classe sans rien perdre : les acheteurs actifs d'abord, ceux à vérifier en dernier, le rang d'origine à égalité. */
export function ordonner<T extends { rang: number; signaux?: Signal[] | null }>(lignes: T[]): T[] {
  return [...lignes].sort((a, b) => ORDRE[prioriteDe(a.signaux)] - ORDRE[prioriteDe(b.signaux)] || a.rang - b.rang);
}
