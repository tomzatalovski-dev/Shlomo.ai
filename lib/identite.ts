import type { Societe } from "./types";

/** Ramène un nom à ses lettres et chiffres, sans accent ni forme juridique : « La Fourche SAS » devient « lafourche ». */
export function normaliser(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(sas|sasu|sarl|eurl|sa|snc|sci|societe|groupe|holding)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/** Noms sous lesquels chercher la société : celui lu par l'IA, les morceaux du titre, le nom de domaine. */
export function nomsCandidats(domaine: string, titre?: string, nomLu?: string): string[] {
  const noms: string[] = [];
  if (nomLu) noms.push(nomLu);
  for (const morceau of (titre ?? "").split(/[|·•:–—]| - /)) {
    const m = morceau.trim();
    if (m && m.split(/\s+/).length <= 4) noms.push(m);
  }
  const racine = domaine.replace(/^www\./, "").split(".")[0];
  if (racine) noms.push(racine.replace(/-/g, " "));
  const vus = new Set<string>();
  return noms.filter((n) => {
    const cle = normaliser(n);
    if (cle.length < 3 || vus.has(cle)) return false;
    vus.add(cle);
    return true;
  }).slice(0, 3);
}

/** Noms portés par une fiche du registre : « ALAN (ALAN SA) » donne « alan » et « alan ». */
function nomsDe(s: Societe): string[] {
  const dedans = [...s.nom.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  return [s.nom.replace(/\([^)]*\)/g, " "), ...dedans].map(normaliser).filter(Boolean);
}

/** Dit à quel point une fiche du registre correspond au site : nom, puis adresse retrouvée dans le texte du site. */
export function correspondance(s: Societe, candidat: string, texteSite: string): number {
  const c = normaliser(candidat);
  if (!c) return 0;
  let note = 0;
  for (const n of nomsDe(s)) {
    if (n === c) note = Math.max(note, 3);
    else if (c.length >= 4 && (n.startsWith(c) || c.startsWith(n)) && n.length >= 4) note = Math.max(note, 2);
    else if (c.length >= 5 && n.includes(c)) note = Math.max(note, 1);
  }
  if (note === 0) return 0;
  if (s.codePostal && texteSite.includes(s.codePostal)) note += 2;
  else if (s.ville && s.ville.length >= 4 && normaliser(texteSite).includes(normaliser(s.ville))) note += 1;
  return note;
}

/**
 * Choisit la société du site parmi les fiches du registre.
 * `sure` n'est donné que si une seule fiche porte ce nom exact et que son adresse figure sur le site.
 * Sinon, les meilleures fiches sont proposées au vendeur, qui choisit.
 */
export function choisirSociete(fiches: { candidat: string; societes: Societe[] }[], texteSite: string): { sure?: Societe; propositions: Societe[] } {
  const notes = new Map<string, { societe: Societe; note: number }>();
  for (const f of fiches) {
    for (const s of f.societes) {
      if (s.entrepreneurIndividuel) continue;
      const note = correspondance(s, f.candidat, texteSite);
      if (note > (notes.get(s.siren)?.note ?? 0)) notes.set(s.siren, { societe: s, note });
    }
  }
  // À note égale, la plus grande d'abord : une société qui a un site est rarement la plus petite de ses homonymes.
  const taille = (s: Societe) => Number(s.trancheEffectif) || 0;
  const classees = [...notes.values()].sort((a, b) => b.note - a.note || taille(b.societe) - taille(a.societe));
  const [premiere, seconde] = classees;
  const sure = premiere && premiere.note >= 4 && (!seconde || seconde.note < premiere.note) ? premiere.societe : undefined;
  return { sure, propositions: classees.filter((c) => c.note >= 2).slice(0, 3).map((c) => c.societe) };
}
