/**
 * Limite simple par adresse, gardée en mémoire.
 * Suffit pour un seul serveur ; à remplacer par un stockage partagé en production.
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
