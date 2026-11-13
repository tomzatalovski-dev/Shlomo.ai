/** Ce que l'utilisateur a saisi, une fois compris. */
export type Saisie =
  | { type: "siren"; siren: string }
  | { type: "site"; domaine: string; url: string }
  | { type: "invalide"; raison: string };

export type Dirigeant = { nom: string; qualite?: string };

export type ExerciceFinancier = { annee: number; chiffreAffaires?: number; resultat?: number };

/** Fiche d'une société telle que lue au registre. Tout champ absent du registre reste absent. */
export type Societe = {
  siren: string;
  nom: string;
  active: boolean;
  formeJuridique?: string;
  anneeCreation?: number;
  codeActivite?: string;
  effectif?: string;
  anneeEffectif?: number;
  ville?: string;
  codePostal?: string;
  departement?: string;
  region?: string;
  /** Code de tranche d'effectif de l'INSEE, par exemple "11" pour 10 à 19 salariés. */
  trancheEffectif?: string;
  entrepreneurIndividuel?: boolean;
  /** La société a demandé que ses données ne servent pas à la prospection : on ne la propose jamais. */
  refuseProspection?: boolean;
  dirigeants: Dirigeant[];
  finances: ExerciceFinancier[];
  source: string;
};

export type ProfilRepreneur = "departement" | "region" | "national";

/** Repreneur complet, tel que le serveur le connaît. Ne quitte jamais le serveur avant le mandat. */
export type Repreneur = {
  societe: Societe;
  profil: ProfilRepreneur;
  score: number;
  raisons: string[];
};

/** Ce que le navigateur reçoit avant la signature du mandat : ni nom, ni SIREN, ni ville. */
export type RepreneurMasque = {
  rang: number;
  profil: string;
  zone: string;
  effectif?: string;
  score: number;
  raison: string;
  details: string[];
};

export type EvenementRepreneurs =
  | { type: "journal"; texte: string; etat: "ok" | "alerte" }
  | { type: "encours"; texte: string }
  | { type: "vendeur"; nom: string; siren: string }
  | { type: "repreneurs"; liste: RepreneurMasque[]; examinees: number }
  | { type: "erreur"; message: string }
  | { type: "fin" };

export type LectureSite = {
  domaine: string;
  titre?: string;
  description?: string;
  pagesLues: string[];
  sirenTrouve?: string;
  /** Texte brut du site, tronqué. Reste côté serveur. */
  texte: string;
};

export type ResumeIA = { description: string; pointsForts: string[] };

/** Événements envoyés au navigateur pendant l'analyse. */
export type Evenement =
  | { type: "journal"; texte: string; etat: "ok" | "alerte" }
  | { type: "encours"; texte: string }
  | { type: "societe"; societe: Societe }
  | { type: "site"; domaine: string; titre?: string; description?: string }
  | { type: "resume"; resume: ResumeIA }
  | { type: "besoin_siren"; message: string }
  | { type: "erreur"; message: string }
  | { type: "fin" };
