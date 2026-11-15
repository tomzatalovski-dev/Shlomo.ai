/** Un créneau est une date et une heure locales, telles que le vendeur les a saisies : « 2026-11-24T10:00 ». */
const FORME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function creneauValide(c: unknown): c is string {
  return typeof c === "string" && FORME.test(c) && !Number.isNaN(Date.parse(`${c}:00Z`));
}

/** « mardi 24 novembre à 10 h 00 ». L'heure est celle que le vendeur a écrite : aucun décalage n'est appliqué. */
export function direCreneau(c: string): string {
  if (!creneauValide(c)) return c;
  const d = new Date(`${c}:00Z`);
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return `${jour} à ${c.slice(11, 13)} h ${c.slice(14, 16)}`;
}

export const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
export const poids = (octets: number) => (octets >= 1_000_000 ? `${(octets / 1_000_000).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(octets / 1000))} Ko`);
