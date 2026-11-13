import type { Societe } from "./types";

/**
 * Source : API Recherche d'entreprises (État français, sans clé, données ouvertes).
 * Toute autre source de registre doit exposer la même fonction `chercherSociete`.
 */
const BASE = process.env.REGISTRE_URL ?? "https://recherche-entreprises.api.gouv.fr";

const EFFECTIFS: Record<string, string> = {
  NN: "Aucun salarié",
  "00": "Aucun salarié",
  "01": "1 à 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

const FORMES: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC",
  "5498": "EURL",
  "5499": "SARL",
  "5599": "SA",
  "5710": "SAS",
  "5720": "SASU",
  "6540": "SCI",
  "9220": "Association",
};

type Brut = Record<string, any>;

/** Transforme la réponse du registre en fiche. N'invente aucune valeur manquante. */
export function mapperSociete(r: Brut): Societe {
  const dirigeants = Array.isArray(r.dirigeants)
    ? r.dirigeants
        .map((d: Brut) => ({
          nom: (d.denomination ?? [d.prenoms, d.nom].filter(Boolean).join(" ")).trim(),
          qualite: d.qualite ?? undefined,
        }))
        .filter((d: { nom: string; qualite?: string }) => d.nom && !/commissaire aux comptes/i.test(d.qualite ?? ""))
    : [];

  const finances =
    r.finances && typeof r.finances === "object"
      ? Object.entries(r.finances as Record<string, Brut>)
          .map(([annee, f]) => ({
            annee: Number(annee),
            chiffreAffaires: typeof f?.ca === "number" ? f.ca : undefined,
            resultat: typeof f?.resultat_net === "number" ? f.resultat_net : undefined,
          }))
          .filter((f) => Number.isFinite(f.annee))
          .sort((a, b) => a.annee - b.annee)
      : [];

  const annee = typeof r.date_creation === "string" ? Number(r.date_creation.slice(0, 4)) : NaN;
  const forme = r.nature_juridique ? String(r.nature_juridique) : undefined;

  return {
    siren: String(r.siren),
    nom: r.nom_complet ?? r.nom_raison_sociale ?? "Société sans nom publié",
    active: r.etat_administratif !== "C",
    formeJuridique: forme ? (FORMES[forme] ?? `Forme juridique ${forme}`) : undefined,
    anneeCreation: Number.isFinite(annee) ? annee : undefined,
    codeActivite: r.activite_principale ?? undefined,
    effectif: r.tranche_effectif_salarie ? EFFECTIFS[String(r.tranche_effectif_salarie)] : undefined,
    anneeEffectif: r.annee_tranche_effectif_salarie ? Number(r.annee_tranche_effectif_salarie) : undefined,
    ville: r.siege?.libelle_commune ?? undefined,
    codePostal: r.siege?.code_postal ?? undefined,
    departement: r.siege?.departement ?? undefined,
    region: r.siege?.region ?? undefined,
    trancheEffectif: r.tranche_effectif_salarie ? String(r.tranche_effectif_salarie) : undefined,
    entrepreneurIndividuel: forme === "1000",
    refuseProspection: r.opposition_diffusion_commerciale === true || r.statut_diffusion === "P",
    dirigeants,
    finances,
    source: "API Recherche d'entreprises (annuaire-entreprises.data.gouv.fr)",
  };
}

export class RegistreIndisponible extends Error {}

/** Appelle le registre, avec trois essais. Renvoie null si la demande est refusée. */
async function appeler(parametres: Record<string, string>): Promise<Brut[] | null> {
  const url = `${BASE}/search?${new URLSearchParams(parametres)}`;
  let derniere: unknown;

  for (let essai = 0; essai < 3; essai++) {
    try {
      const rep = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (rep.status === 429) {
        // Le registre limite le nombre d'appels : on attend ce qu'il demande, cinq secondes au plus.
        const demande = Number(rep.headers.get("retry-after"));
        await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(demande) && demande > 0 ? demande * 1000 : 1500, 5000)));
        throw new Error("Registre : trop d'appels");
      }
      if (rep.status >= 500) throw new Error(`Registre : réponse ${rep.status}`);
      if (!rep.ok) return null;
      const json = (await rep.json()) as { results?: Brut[] };
      return json.results ?? [];
    } catch (e) {
      derniere = e;
      await new Promise((r) => setTimeout(r, 600 * (essai + 1)));
    }
  }
  throw new RegistreIndisponible(String(derniere));
}

/** Cherche une société par SIREN. Renvoie null si le registre ne la connaît pas. */
export async function chercherSociete(siren: string): Promise<Societe | null> {
  const resultats = await appeler({ q: siren, per_page: "1" });
  const trouve = resultats?.find((r) => String(r.siren) === siren);
  return trouve ? mapperSociete(trouve) : null;
}

export type FiltreActivite = {
  codeActivite: string;
  tranches: string[];
  departement?: string;
  region?: string;
};

/** Liste les sociétés actives d'un même code d'activité, dans une zone et des tranches d'effectif données. */
export async function chercherParActivite(filtre: FiltreActivite): Promise<Societe[]> {
  const parametres: Record<string, string> = {
    activite_principale: filtre.codeActivite,
    tranche_effectif_salarie: filtre.tranches.join(","),
    etat_administratif: "A",
    per_page: "25",
  };
  if (filtre.departement) parametres.departement = filtre.departement;
  if (filtre.region) parametres.region = filtre.region;

  const resultats = await appeler(parametres);
  return (resultats ?? []).map(mapperSociete);
}
