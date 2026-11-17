import type { Signal } from "./types";
/**
 * Mémoire du site : base Supabase, appelée uniquement depuis le serveur.
 * Aucune table n'est lisible directement. Tout passe par trois fonctions de la base,
 * qui exigent le jeton secret du dossier. La clé ci-dessous est la clé publique du projet :
 * elle est faite pour être visible et ne donne accès qu'à ces fonctions.
 */
const URL_BASE = process.env.SUPABASE_URL ?? "https://ceapsneunznyyjplpgib.supabase.co";
const CLE_PUBLIQUE = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_b1biTFFj_MgHYopG9_U3Dw_-5iQnOns";

export class BaseIndisponible extends Error {}

async function appeler<T>(fonction: string, arguments_: Record<string, unknown>, delai = 10_000): Promise<T> {
  let rep: Response;
  try {
    rep = await fetch(`${URL_BASE}/rest/v1/rpc/${fonction}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: CLE_PUBLIQUE },
      body: JSON.stringify(arguments_),
      signal: AbortSignal.timeout(delai),
      cache: "no-store",
    });
  } catch (e) {
    throw new BaseIndisponible(String(e));
  }
  if (!rep.ok) throw new BaseIndisponible(`Base : réponse ${rep.status}`);
  return (await rep.json()) as T;
}

export type StatutPresentation = "identifie" | "contacte" | "relance" | "a_repondu" | "interesse" | "confidentialite_signee" | "rendez_vous" | "offre" | "conclu" | "sans_suite";

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
  signaux?: Signal[] | null;
  revelation?: "autorisee" | "refusee" | null;
  accord?: AccordSigne | null;
  rendez_vous?: string | null;
  offres?: Offre[];
};

/** Offre chiffrée déposée par un repreneur, et la réponse du vendeur. */
export type Offre = { id: number; prix: number; financement?: string | null; calendrier?: string | null; conditions?: string | null; deposee_le: string; reponse?: "acceptee" | "refusee" | "a_ameliorer" | null; reponse_le?: string | null };
export type DocumentDepose = { id: string; nom: string; taille: number; depose_le?: string; consultations?: { nom: string; vu_le: string }[] };

/** Accord de confidentialité signé par un repreneur. */
export type AccordSigne = { signataire: string; qualite?: string | null; signe_le: string };
export type Fourchette = { bas: number; haut: number };

export type Suivi = {
  qualite?: "a_verifier" | "validee" | "refusee";
  courriel?: string | null;
  fourchette?: Fourchette | null;
  creneaux?: string[];
  documents?: DocumentDepose[];
  societe: { siren: string; nom: string };
  jeton_fiche?: string;
  presentation?: string | null;
  fiche?: { ville?: string | null; effectif?: string | null; codeActivite?: string | null; site?: string | null; activite?: string | null; anneeCreation?: number | null } | null;
  mandat: { signataire: string; signe_le: string; autorisation_approche: boolean; version: string; numero?: number; echeance?: string } | null;
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
export async function enregistrerApproche(jeton: string, siren: string, approche: { decideur?: string; qualite?: string; message?: string; refus?: boolean; site?: string; signaux?: Signal[] }): Promise<boolean> {
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
export type FicheAnonyme = { activite?: string | null; region?: string | null; effectif?: string | null; anneeCreation?: number | null; chiffreAffaires?: number | null; resultatPositif?: boolean | null; raison?: string | null; presentation?: string | null };

export async function lireFiche(jeton: string): Promise<FicheAnonyme | null> {
  if (!jetonValide(jeton)) return null;
  return appeler<FicheAnonyme | null>("lire_fiche", { p_jeton: jeton });
}

/** Enregistre la demande d'un repreneur. Ses coordonnées ne sont jamais montrées au vendeur. */
export async function manifesterInteret(jeton: string, demande: { nom: string; societe: string; contact: string }): Promise<boolean> {
  if (!jetonValide(jeton)) return false;
  return appeler<boolean>("manifester_interet", { p_jeton: jeton, p_nom: demande.nom, p_societe: demande.societe, p_contact: demande.contact });
}

export type Etape = "fiche_vue" | "repreneurs_vus" | "mandat_ouvert" | "mandat_signe" | "approches_pretes" | "presentation_ouverte" | "interet";

/** Note qu'une étape du parcours a été atteinte. Ne lève jamais d'erreur : la mesure ne doit rien casser. */
export async function mesurer(etape: Etape, cle: string): Promise<void> {
  try {
    await appeler<boolean>("enregistrer_mesure", { p_etape: etape, p_cle: cle });
  } catch {}
}

/** Nombre de dossiers ayant atteint chaque étape sur la période. Renvoie null si le code de pilotage est faux. */
export async function lireEntonnoir(code: string, jours = 30): Promise<Partial<Record<Etape, number>> | null> {
  if (!jetonValide(code)) return null;
  return appeler<Partial<Record<Etape, number>> | null>("lire_entonnoir", { p_code: code, p_jours: jours });
}

/** Enregistre, une seule fois, la présentation anonyme rédigée par l'IA. */
export async function enregistrerPresentation(jeton: string, texte: string): Promise<boolean> {
  if (!jetonValide(jeton)) return false;
  return appeler<boolean>("enregistrer_presentation", { p_jeton: jeton, p_texte: texte });
}

/** Résultats du banc d'essai du négociateur, tels que la base les résume. */
export type BilanEssais = {
  versions: { version: string; essais: number; graves: number; sans_faute: number; rendez_vous: number; note: number | null; premier: string; dernier: string }[];
  personas: { persona: string; version: string; essais: number; graves: number; rendez_vous: number; note: number | null }[];
  derniers: { id: number; cree_le: string; version: string; persona: string; tours: { de: string; texte: string; situation?: string; repli?: boolean; ecartes?: string[]; fautes?: { detail: string; grave: boolean; arretee?: boolean }[] }[]; fautes: { regle: string; grave: boolean; detail: string; arretee?: boolean }[]; graves: number; rendez_vous: boolean; note: number | null; avis: string | null }[];
};

export async function enregistrerEssai(code: string, e: { version: string; persona: string; tours: unknown[]; fautes: unknown[]; graves: number; rendezVous: boolean; note: number | null; avis: string }): Promise<boolean> {
  if (!jetonValide(code)) return false;
  return appeler<boolean>("enregistrer_essai", { p_code: code, p_version: e.version, p_persona: e.persona, p_tours: e.tours, p_fautes: e.fautes, p_graves: e.graves, p_rdv: e.rendezVous, p_note: e.note, p_avis: e.avis });
}

export async function lireEssais(code: string): Promise<BilanEssais | null> {
  if (!jetonValide(code)) return null;
  return appeler<BilanEssais | null>("lire_essais", { p_code: code });
}

/** Un message d'une conversation réelle avec un repreneur. « propose » : rédigé par le négociateur, pas encore envoyé. */
export type Echange = { id: number; de: "repreneur" | "shlomo"; texte: string; etat: "recu" | "propose" | "envoye" | "ecarte"; situation?: string | null; lecture?: string | null; version?: string | null; fautes?: { detail: string; grave: boolean; arretee?: boolean }[]; repli?: boolean; cree_le: string };

export type LignePoste = { id: string; essai: boolean; qualite?: "a_verifier" | "validee" | "refusee"; nom: string; siren: string; signataire: string; signe_le: string; repreneurs: number; prets: number; contactes: number; reponses: number; interesses: number; demandes: number; a_envoyer: number; activite: string };

export type RepreneurPoste = { siren: string; nom: string; rang: number; ville?: string | null; effectif?: string | null; score?: number | null; statut: StatutPresentation; statut_le?: string | null; exclu: boolean; canal?: "a_envoyer" | "refus_demarchage" | null; decideur?: string | null; qualite?: string | null; message?: string | null; site?: string | null; signaux?: Signal[] | null; jeton_accord: string; revelation?: "autorisee" | "refusee" | null; accord?: AccordSigne | null; rendez_vous?: string | null; offres?: Offre[]; echanges: Echange[] };

export type DossierPoste = {
  id: string;
  nom: string;
  siren: string;
  jeton: string;
  jeton_fiche: string;
  fourchette?: Fourchette | null;
  qualite?: "a_verifier" | "validee" | "refusee";
  courriel?: string | null;
  signataire?: string | null;
  creneaux?: string[];
  documents?: number;
  fiche: { ville?: string | null; effectif?: string | null; site?: string | null; activite?: string | null; region?: string | null } | null;
  presentations: RepreneurPoste[];
  interets: { id: number; nom: string; societe?: string | null; contact: string; cree_le: string; siren?: string | null }[];
};

const SIREN = /^\d{9}$/;

/** Dossiers dont le mandat autorise l'approche, pour le poste de négociation. Null si le code est faux. */
export async function lirePoste(code: string): Promise<LignePoste[] | null> {
  if (!jetonValide(code)) return null;
  return appeler<LignePoste[] | null>("lire_poste", { p_code: code });
}

export async function lirePosteDossier(code: string, dossier: string): Promise<DossierPoste | null> {
  if (!jetonValide(code) || !jetonValide(dossier)) return null;
  return appeler<DossierPoste | null>("lire_poste_dossier", { p_code: code, p_dossier: dossier });
}

/** Fait avancer un repreneur d'une étape. La base écrit la ligne correspondante dans le suivi du vendeur. */
export async function changerStatut(code: string, dossier: string, siren: string, statut: StatutPresentation): Promise<boolean> {
  if (!jetonValide(code) || !jetonValide(dossier) || !SIREN.test(siren)) return false;
  return appeler<boolean>("changer_statut", { p_code: code, p_dossier: dossier, p_siren: siren, p_statut: statut });
}

export async function recevoirReponse(code: string, dossier: string, siren: string, texte: string): Promise<number | null> {
  if (!jetonValide(code) || !jetonValide(dossier) || !SIREN.test(siren)) return null;
  return appeler<number | null>("recevoir_reponse", { p_code: code, p_dossier: dossier, p_siren: siren, p_texte: texte });
}

export async function proposerReponse(code: string, dossier: string, siren: string, r: { texte: string; situation: string; lecture: string; version: string; fautes: unknown[]; repli: boolean }): Promise<number | null> {
  if (!jetonValide(code) || !jetonValide(dossier) || !SIREN.test(siren)) return null;
  return appeler<number | null>("proposer_reponse", { p_code: code, p_dossier: dossier, p_siren: siren, p_texte: r.texte, p_situation: r.situation, p_lecture: r.lecture, p_version: r.version, p_fautes: r.fautes, p_repli: r.repli });
}

/** Marque une réponse proposée comme envoyée (avec le texte réellement parti) ou comme écartée. */
export async function traiterEchange(code: string, echange: number, etat: "envoye" | "ecarte", texte?: string): Promise<boolean> {
  if (!jetonValide(code) || !Number.isInteger(echange)) return false;
  return appeler<boolean>("traiter_echange", { p_code: code, p_echange: echange, p_etat: etat, p_texte: texte ?? null });
}

export async function rattacherInteret(code: string, dossier: string, interet: number, siren: string): Promise<boolean> {
  if (!jetonValide(code) || !jetonValide(dossier) || !Number.isInteger(interet) || !SIREN.test(siren)) return false;
  return appeler<boolean>("rattacher_interet", { p_code: code, p_dossier: dossier, p_interet: interet, p_siren: siren });
}

/** Le vendeur confirme lui-même la fourchette de prix. Sans elle, le négociateur n'annonce aucun montant. */
export async function validerFourchette(jeton: string, bas: number, haut: number): Promise<boolean> {
  if (!jetonValide(jeton) || !Number.isInteger(bas) || !Number.isInteger(haut)) return false;
  return appeler<boolean>("valider_fourchette", { p_jeton: jeton, p_bas: bas, p_haut: haut });
}

/** Ce que voit un repreneur sur la page de l'accord. `cedant` n'est rempli qu'après signature et feu vert du vendeur. */
export type PageAccord = {
  repreneur: string;
  decideur?: string | null;
  cession: { activite?: string | null; region?: string | null; effectif?: string | null };
  accord: AccordSigne | null;
  revelation?: "autorisee" | "refusee" | null;
  cedant: { nom: string; siren: string; ville?: string | null; site?: string | null } | null;
  /** Ce que le repreneur autorisé peut consulter et faire : documents, prix annoncé, créneaux encore libres, ses offres. */
  dossier: { fourchette?: Fourchette | null; documents: DocumentDepose[]; creneaux: string[]; rendez_vous?: string | null; offres: Offre[] } | null;
};

export async function lireAccord(jeton: string): Promise<PageAccord | null> {
  if (!jetonValide(jeton)) return null;
  return appeler<PageAccord | null>("lire_accord", { p_jeton: jeton });
}

export async function signerAccord(jeton: string, signataire: string, qualite: string): Promise<boolean> {
  if (!jetonValide(jeton)) return false;
  return appeler<boolean>("signer_accord", { p_jeton: jeton, p_signataire: signataire, p_qualite: qualite });
}

/** Le vendeur autorise ou refuse que son nom soit communiqué à un repreneur qui a signé l'accord. */
export async function deciderRevelation(jeton: string, siren: string, autorise: boolean): Promise<boolean> {
  if (!jetonValide(jeton) || !SIREN.test(siren)) return false;
  return appeler<boolean>("decider_revelation", { p_jeton: jeton, p_siren: siren, p_autorise: autorise });
}

const UUID = jetonValide;
export type Fichier = { nom: string; type?: string | null; contenu: string };

/** Le vendeur dépose un document (contenu en base64). Renvoie son identifiant, ou null s'il est refusé (trop lourd, trop nombreux). */
export async function deposerDocument(jeton: string, nom: string, type: string, contenu: string): Promise<string | null> {
  if (!UUID(jeton)) return null;
  return appeler<string | null>("deposer_document", { p_jeton: jeton, p_nom: nom, p_type: type, p_contenu: contenu }, 30_000);
}
export async function supprimerDocument(jeton: string, id: string): Promise<boolean> {
  if (!UUID(jeton) || !UUID(id)) return false;
  return appeler<boolean>("supprimer_document", { p_jeton: jeton, p_id: id });
}
export async function lireDocumentVendeur(jeton: string, id: string): Promise<Fichier | null> {
  if (!UUID(jeton) || !UUID(id)) return null;
  return appeler<Fichier | null>("lire_document_vendeur", { p_jeton: jeton, p_id: id });
}
/** La base ne rend le document que si ce repreneur a signé l'accord et reçu le feu vert ; elle note la consultation. */
export async function lireDocumentRepreneur(jetonAccord: string, id: string): Promise<Fichier | null> {
  if (!UUID(jetonAccord) || !UUID(id)) return null;
  return appeler<Fichier | null>("lire_document_repreneur", { p_jeton_accord: jetonAccord, p_id: id });
}
export async function fixerCreneaux(jeton: string, creneaux: string[]): Promise<boolean> {
  if (!UUID(jeton)) return false;
  return appeler<boolean>("fixer_creneaux", { p_jeton: jeton, p_creneaux: creneaux });
}
export async function choisirCreneau(jetonAccord: string, creneau: string): Promise<boolean> {
  if (!UUID(jetonAccord)) return false;
  return appeler<boolean>("choisir_creneau", { p_jeton_accord: jetonAccord, p_creneau: creneau });
}
export async function deposerOffre(jetonAccord: string, o: { prix: number; financement: string; calendrier: string; conditions: string }): Promise<boolean> {
  if (!UUID(jetonAccord) || !Number.isInteger(o.prix)) return false;
  return appeler<boolean>("deposer_offre", { p_jeton_accord: jetonAccord, p_prix: o.prix, p_financement: o.financement, p_calendrier: o.calendrier, p_conditions: o.conditions });
}
export async function repondreOffre(jeton: string, offre: number, reponse: "acceptee" | "refusee" | "a_ameliorer"): Promise<boolean> {
  if (!UUID(jeton) || !Number.isInteger(offre)) return false;
  return appeler<boolean>("repondre_offre", { p_jeton: jeton, p_offre: offre, p_reponse: reponse });
}

/**
 * Compte un appel dans la base et dit s'il reste sous le plafond. Partagé entre tous les serveurs, contrairement à la limite en mémoire.
 * Si la base ne répond pas, on laisse passer : la limite en mémoire reste en place, et on ne ferme pas le site pour un compteur.
 */
export async function sousLePlafond(cle: string, secondes: number, maximum: number): Promise<boolean> {
  try {
    return await appeler<boolean>("compter_appel", { p_cle: cle.slice(0, 120), p_secondes: secondes, p_max: maximum }, 4_000);
  } catch {
    return true;
  }
}

export type Acte = { id: number; acteur: "vendeur" | "repreneur"; acte: string; detail: Record<string, unknown>; cree_le: string; repreneur?: string | null };

/** Journal des actes d'un dossier, écrit par la base elle-même. Null si le code est faux. */
export async function lireActes(code: string, dossier: string): Promise<Acte[] | null> {
  if (!jetonValide(code) || !jetonValide(dossier)) return null;
  return appeler<Acte[] | null>("lire_actes", { p_code: code, p_dossier: dossier });
}

export async function marquerEssai(code: string, dossier: string, essai: boolean): Promise<boolean> {
  if (!jetonValide(code) || !jetonValide(dossier)) return false;
  return appeler<boolean>("marquer_essai", { p_code: code, p_dossier: dossier, p_essai: essai });
}

/** Inscrit une société sur la liste d'opposition (ou l'en retire) : plus aucun message ne lui est préparé, sur aucun dossier. */
export async function opposer(code: string, siren: string, oppose: boolean): Promise<boolean> {
  if (!jetonValide(code) || !SIREN.test(siren)) return false;
  return appeler<boolean>("opposer", { p_code: code, p_siren: siren, p_oppose: oppose });
}

/** Efface les coordonnées et messages des repreneurs restés sans suite au-delà du délai réglé. Renvoie le nombre de lignes nettoyées. */
export async function purgerContacts(code: string): Promise<number | null> {
  if (!jetonValide(code)) return null;
  return appeler<number | null>("purger_contacts", { p_code: code });
}

/** Le vendeur donne son adresse : elle sert à lui renvoyer son lien et à le prévenir à chaque étape. */
export async function fixerCourriel(jeton: string, courriel: string): Promise<boolean> {
  if (!jetonValide(jeton)) return false;
  return appeler<boolean>("fixer_courriel", { p_jeton: jeton, p_courriel: courriel });
}

/** Lecture réservée au serveur : qui prévenir quand un repreneur agit. */
export async function contactVendeur(cle: string, jetonAccord: string): Promise<{ courriel: string; jeton: string; nom: string; repreneur: string } | null> {
  if (!jetonValide(jetonAccord)) return null;
  return appeler("contact_vendeur", { p_cle: cle, p_jeton_accord: jetonAccord });
}

/** Ce qu'une étape a consommé d'IA. Ne lève jamais d'erreur ; sans clé de serveur, rien n'est noté. */
export async function noterConsommation(etape: "fiche" | "repreneurs" | "atelier", cle: string, r: { appels: number; entree: number; sortie: number; recherches: number; duree_ms: number }): Promise<void> {
  const serveur = process.env.CLE_SERVEUR;
  if (!serveur || r.appels === 0) return;
  try {
    await appeler<boolean>("enregistrer_consommation", { p_cle_serveur: serveur, p_etape: etape, p_cle: cle, p_appels: r.appels, p_entree: r.entree, p_sortie: r.sortie, p_recherches: r.recherches, p_duree_ms: r.duree_ms });
  } catch {}
}

export type Consommation = { passages: number; appels: number; entree: number; sortie: number; recherches: number; duree_s: number; duree_max_s: number };

/** Moyennes par étape sur la période. Null si le code de pilotage est faux. */
export async function lireConsommations(code: string, jours = 30): Promise<Record<string, Consommation> | null> {
  if (!jetonValide(code)) return null;
  return appeler<Record<string, Consommation> | null>("lire_consommations", { p_code: code, p_jours: jours });
}

/** Concurrents directs trouvés pour un vendeur : gardés trente jours, pour que la liste signée soit celle qu'il a vue. */
export async function garderConcurrents(vendeur: string, liste: { siren: string; source: string }[]): Promise<void> {
  const serveur = process.env.CLE_SERVEUR;
  if (!serveur || liste.length === 0) return;
  try {
    await appeler<number>("garder_concurrents", { p_cle_serveur: serveur, p_vendeur: vendeur, p_liste: liste });
  } catch {}
}

export async function lireConcurrents(vendeur: string): Promise<{ siren: string; source: string }[]> {
  const serveur = process.env.CLE_SERVEUR;
  if (!serveur) return [];
  try {
    return (await appeler<{ siren: string; source: string }[] | null>("lire_concurrents", { p_cle_serveur: serveur, p_vendeur: vendeur })) ?? [];
  } catch {
    return [];
  }
}

/** Dit si la clé posée sur le serveur est bien celle de la base, sans jamais la rendre. */
export async function cleServeurValide(cle: string): Promise<boolean> {
  return (await appeler<boolean | null>("cle_serveur_valide", { p_cle: cle })) === true;
}

/** Lecture réservée au serveur : les dossiers rattachés à une adresse, pour renvoyer un lien perdu. */
export async function liensParCourriel(cle: string, courriel: string): Promise<{ nom: string; jeton: string }[] | null> {
  return appeler("liens_par_courriel", { p_cle: cle, p_courriel: courriel });
}

export async function garderProspect(siren: string, courriel: string): Promise<boolean> {
  if (!SIREN.test(siren)) return false;
  return appeler<boolean>("garder_prospect", { p_siren: siren, p_courriel: courriel });
}

export async function lireProspects(code: string): Promise<{ siren: string; courriel: string; cree_le: string; signe: boolean }[] | null> {
  if (!jetonValide(code)) return null;
  return appeler("lire_prospects", { p_code: code });
}

/** Un fondateur valide (ou refuse) la qualité du signataire. Sans validation, la base refuse de noter un envoi. */
export async function validerQualite(code: string, dossier: string, etat: "a_verifier" | "validee" | "refusee"): Promise<boolean> {
  if (!jetonValide(code) || !jetonValide(dossier)) return false;
  return appeler<boolean>("valider_qualite", { p_code: code, p_dossier: dossier, p_etat: etat });
}
