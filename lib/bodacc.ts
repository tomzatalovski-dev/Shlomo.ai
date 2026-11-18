/**
 * Annonces légales d'une société au BODACC (bulletin officiel), par l'API ouverte de la DILA. Aucune clé.
 * Ce sont des publications officielles : ventes de fonds, procédures collectives, dépôts de comptes, modifications.
 */
const BASE = process.env.BODACC_URL ?? "https://bodacc-datadila.opendatasoft.com";

export type Annonce = {
  date: string;
  /** Famille telle que le bulletin la nomme : « Dépôts des comptes », « Procédures collectives », « Ventes et cessions »… */
  famille: string;
  genre: "comptes" | "procedure" | "vente" | "modification" | "creation" | "radiation" | "autre";
  detail?: string;
  /** Vrai pour un dépôt de comptes accompagné d'une déclaration de confidentialité. */
  confidentiel?: boolean;
  url: string;
};

type Brut = Record<string, unknown>;

const texte = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Certains champs arrivent en JSON dans une chaîne. Renvoie un objet, ou rien. */
function objet(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v !== "string" || !v.trim().startsWith("{")) return null;
  try {
    const lu = JSON.parse(v);
    return lu && typeof lu === "object" ? (lu as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function genreDe(famille: string): Annonce["genre"] {
  const f = famille.toLowerCase();
  if (f.includes("dépôt") || f.includes("depot")) return "comptes";
  if (f.includes("collective") || f.includes("conciliation") || f.includes("tablissement prof")) return "procedure";
  if (f.includes("vente")) return "vente";
  if (f.includes("modification")) return "modification";
  if (f.includes("creation") || f.includes("création") || f.includes("immatriculation")) return "creation";
  if (f.includes("radiation")) return "radiation";
  return "autre";
}

const ROLES: [RegExp, string, string][] = [
  [/pr[ée]sident/i, "président", "du"],
  [/directeur g[ée]n[ée]ral/i, "directeur général", "d'un"],
  [/g[ée]rant/i, "gérant", "de"],
  [/administrateur/i, "administrateur", "d'un"],
];

/**
 * Dit en clair ce qu'une annonce « modification survenue sur l'administration » change : qui arrive, qui part, à quel poste.
 * Aucun nom de personne. Renvoie une chaîne vide quand seuls des commissaires aux comptes sont concernés.
 */
export function direAdministration(brut: string): string {
  const lignes: string[] = [];
  for (const morceau of brut.split(/;/)) {
    if (/commissaire/i.test(morceau)) continue;
    for (const [motif, role, article] of ROLES) {
      if (!motif.test(morceau)) continue;
      if (/directeur g[ée]n[ée]ral/i.test(morceau) && role === "président") continue;
      const arrive = /nomination/i.test(morceau);
      const part = /partant|d[ée]mission|r[ée]vocation|fin de mandat/i.test(morceau) || /modification d[ue]/i.test(morceau);
      lignes.push(arrive && part ? `Changement de ${role}` : arrive ? `Nomination ${article} ${role}` : part ? `Départ ${article} ${role}` : `Changement de ${role}`);
      break;
    }
  }
  return [...new Set(lignes)].slice(0, 2).join(", ").replace(/, (\w)/, (_, l: string) => `, ${l.toLowerCase()}`);
}

/** Transforme un enregistrement de l'API en annonce affichable. Renvoie null s'il ne concerne pas ce SIREN ou s'il est mal formé. */
export function lireAnnonce(r: Brut, siren: string): Annonce | null {
  // Le champ « registre » liste les numéros de la société, avec ou sans espaces : on vérifie que c'est bien elle.
  if (!JSON.stringify(r.registre ?? "").replace(/\s/g, "").includes(siren)) return null;
  const id = texte(r.id, 40);
  const date = texte(r.dateparution, 10);
  if (!/^[A-Z]?\d{6,}$/i.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const famille = texte(r.familleavis_lib, 60) || texte(r.familleavis, 60);
  const genre = texte(r.familleavis, 60).toLowerCase() === "dpc" ? "comptes" : genreDe(`${texte(r.familleavis, 60)} ${famille}`);

  let detail = "";
  let confidentiel = false;
  const depot = objet(r.depot);
  const jugement = objet(r.jugement);
  const acte = objet(r.acte);
  const modifications = objet(r.modificationsgenerales);
  if (genre === "comptes" && depot) {
    const cloture = texte(depot.dateCloture, 10);
    confidentiel = /confidentialit/i.test(`${texte(depot.descriptif, 400)} ${texte(depot.typeDepot, 120)}`);
    detail = [cloture ? `Exercice clos le ${cloture.split("-").reverse().join("/")}` : "", confidentiel ? "avec déclaration de confidentialité" : ""].filter(Boolean).join(", ");
  } else if (jugement) {
    detail = texte(jugement.nature, 160);
  } else if (modifications) {
    detail = texte(modifications.descriptif, 160);
    // « modification survenue sur l'administration » ne dit rien : le détail est dans la fiche de la personne.
    if (/administration/i.test(detail)) {
      const personne = objet(objet(r.listepersonnes)?.personne);
      const clair = direAdministration(texte(personne?.administration, 600));
      detail = clair || (personne?.administration ? "Changement de commissaire aux comptes" : detail);
    }
  } else if (acte) {
    detail = texte(acte.descriptif, 160) || texte(acte.categorieVente, 160);
  }
  return { date, famille: famille || "Annonce", genre, ...(detail ? { detail } : {}), ...(confidentiel ? { confidentiel } : {}), url: `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:${id}` };
}

/** Ce que les annonces disent des comptes : déposés sous confidentialité, déposés, ou jamais vus au bulletin. */
export function etatDesComptes(annonces: Annonce[]): "confidentiels" | "deposes" | "aucun_depot" {
  const depots = annonces.filter((a) => a.genre === "comptes");
  if (depots.length === 0) return "aucun_depot";
  return depots[0].confidentiel ? "confidentiels" : "deposes";
}

/**
 * Les annonces de la société, de la plus récente à la plus ancienne. Renvoie null si le bulletin ne répond pas :
 * la fiche le dit alors, plutôt que de laisser croire qu'il n'y a rien.
 */
export async function lireAnnonces(siren: string): Promise<Annonce[] | null> {
  if (!/^\d{9}$/.test(siren)) return null;
  // Deux écritures de la même question : la première selon la syntaxe courante de l'API, la seconde en recherche plein texte.
  for (const where of [`registre like "${siren}"`, `search(registre, "${siren}")`]) {
    try {
      const url = `${BASE}/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?${new URLSearchParams({ where, order_by: "dateparution desc", limit: "40" })}`;
      const rep = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000), cache: "no-store" });
      if (!rep.ok) continue;
      const json = (await rep.json()) as { results?: Brut[] };
      if (!Array.isArray(json.results)) continue;
      return json.results.map((r) => lireAnnonce(r, siren)).filter((a): a is Annonce => a !== null);
    } catch {}
  }
  return null;
}
