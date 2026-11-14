/**
 * Mémoire du site : base Supabase, appelée uniquement depuis le serveur.
 * Aucune table n'est lisible directement. Tout passe par trois fonctions de la base,
 * qui exigent le jeton secret du dossier. La clé ci-dessous est la clé publique du projet :
 * elle est faite pour être visible et ne donne accès qu'à ces fonctions.
 */
const URL_BASE = process.env.SUPABASE_URL ?? "https://ceapsneunznyyjplpgib.supabase.co";
const CLE_PUBLIQUE = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_b1biTFFj_MgHYopG9_U3Dw_-5iQnOns";

export class BaseIndisponible extends Error {}

async function appeler<T>(fonction: string, arguments_: Record<string, unknown>): Promise<T> {
  let rep: Response;
  try {
    rep = await fetch(`${URL_BASE}/rest/v1/rpc/${fonction}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: CLE_PUBLIQUE },
      body: JSON.stringify(arguments_),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new BaseIndisponible(String(e));
  }
  if (!rep.ok) throw new BaseIndisponible(`Base : réponse ${rep.status}`);
  return (await rep.json()) as T;
}

export type StatutPresentation = "identifie" | "contacte" | "relance" | "a_repondu" | "interesse" | "confidentialite_signee" | "rendez_vous" | "sans_suite";

export type Presentation = {
  siren: string;
  nom: string;
  rang: number;
  ville?: string | null;
  effectif?: string | null;
  profil?: string | null;
  score?: number | null;
  raisons: string[];
  statut: StatutPresentation;
  exclu: boolean;
  presente_le: string;
  decideur?: string | null;
  qualite?: string | null;
  message?: string | null;
  canal?: "a_envoyer" | "refus_demarchage" | null;
  site?: string | null;
  signaux?: { texte: string; source: string }[] | null;
};

export type Suivi = {
  societe: { siren: string; nom: string };
  jeton_fiche?: string;
  fiche?: { ville?: string | null; effectif?: string | null; codeActivite?: string | null } | null;
  mandat: { signataire: string; signe_le: string; autorisation_approche: boolean; version: string } | null;
  presentations: Presentation[];
  evenements: { texte: string; cree_le: string }[];
};

const JETON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const jetonValide = (j: string) => JETON.test(j);

/** Enregistre le mandat et le journal des présentations. Rend le jeton secret du dossier. */
export function signerMandat(donnees: {
  siren: string;
  nom: string;
  fiche: unknown;
  signataire: string;
  autorisation: boolean;
  repreneurs: unknown[];
}): Promise<string> {
  return appeler<string>("signer_mandat", {
    p_siren: donnees.siren,
    p_nom: donnees.nom,
    p_fiche: donnees.fiche,
    p_signataire: donnees.signataire,
    p_autorisation: donnees.autorisation,
    p_repreneurs: donnees.repreneurs,
  });
}

export async function lireSuivi(jeton: string): Promise<Suivi | null> {
  if (!jetonValide(jeton)) return null;
  return appeler<Suivi | null>("lire_suivi", { p_jeton: jeton });
}

export async function exclureRepreneur(jeton: string, siren: string, exclu: boolean): Promise<boolean> {
  if (!jetonValide(jeton) || !/^\d{9}$/.test(siren)) return false;
  return appeler<boolean>("exclure_repreneur", { p_jeton: jeton, p_siren: siren, p_exclu: exclu });
}

/** Enregistre l'approche préparée pour un repreneur (une seule fois). Avec refus, note qu'il ne veut pas être démarché. */
export async function enregistrerApproche(jeton: string, siren: string, approche: { decideur?: string; qualite?: string; message?: string; refus?: boolean; site?: string; signaux?: { texte: string; source: string }[] }): Promise<boolean> {
  if (!jetonValide(jeton) || !/^\d{9}$/.test(siren)) return false;
  return appeler<boolean>("enregistrer_approche", {
    p_jeton: jeton,
    p_siren: siren,
    p_decideur: approche.decideur ?? null,
    p_qualite: approche.qualite ?? null,
    p_message: approche.message ?? null,
    p_refus: approche.refus === true,
    p_site: approche.site ?? null,
    p_signaux: approche.signaux ?? [],
  });
}

/** Ce que la présentation anonyme montre à un repreneur : jamais de nom, de SIREN ni de ville. */
export type FicheAnonyme = { activite?: string | null; region?: string | null; effectif?: string | null; anneeCreation?: number | null; chiffreAffaires?: number | null; resultatPositif?: boolean | null };

export async function lireFiche(jeton: string): Promise<FicheAnonyme | null> {
  if (!jetonValide(jeton)) return null;
  return appeler<FicheAnonyme | null>("lire_fiche", { p_jeton: jeton });
}

/** Enregistre la demande d'un repreneur. Ses coordonnées ne sont jamais montrées au vendeur. */
export async function manifesterInteret(jeton: string, demande: { nom: string; societe: string; contact: string }): Promise<boolean> {
  if (!jetonValide(jeton)) return false;
  return appeler<boolean>("manifester_interet", { p_jeton: jeton, p_nom: demande.nom, p_societe: demande.societe, p_contact: demande.contact });
}
