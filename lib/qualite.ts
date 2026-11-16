import type { Dirigeant } from "./types";

const mots = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((m) => m.length >= 2);

/**
 * Le nom du signataire correspond-il à un dirigeant inscrit au registre ?
 * Tous les mots du nom le plus court doivent se retrouver dans l'autre, et il en faut au moins deux (un prénom seul ne suffit pas).
 * Ce n'est qu'un indice : le nom d'un dirigeant est public, n'importe qui peut le taper.
 */
export function dirigeantCorrespondant(signataire: string, dirigeants: Dirigeant[]): Dirigeant | null {
  const s = new Set(mots(signataire));
  if (s.size < 2) return null;
  for (const d of dirigeants) {
    if (d.societe) continue;
    const n = new Set(mots(d.nom));
    if (n.size < 2) continue;
    const [petit, grand] = s.size <= n.size ? [s, n] : [n, s];
    if ([...petit].every((m) => grand.has(m))) return d;
  }
  return null;
}

/** L'adresse du signataire est-elle au nom de domaine du site de la société ? Une adresse Gmail ou Orange ne dit rien. */
export function adresseDeLaSociete(courriel: string | null | undefined, site: string | null | undefined): boolean {
  const domaine = courriel?.split("@")[1]?.toLowerCase().trim();
  const hote = site?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
  if (!domaine || !hote || !hote.includes(".")) return false;
  return domaine === hote || domaine.endsWith(`.${hote}`);
}

export type Indices = { nom: boolean; dirigeant?: string; fonction?: string; adresse: boolean };

/** Ce qui aide un fondateur à décider. Recalculé à chaque affichage à partir du registre : rien n'est cru sur parole. */
export function indicesDeQualite(signataire: string, courriel: string | null | undefined, site: string | null | undefined, dirigeants: Dirigeant[]): Indices {
  const d = dirigeantCorrespondant(signataire, dirigeants);
  return { nom: Boolean(d), dirigeant: d?.nom, fonction: d?.qualite, adresse: adresseDeLaSociete(courriel, site) };
}

export const COURRIEL = /^[^@\s]{1,64}@[^@\s]{1,180}\.[a-zA-Z]{2,24}$/;
