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
  dirigeants: Dirigeant[];
  finances: ExerciceFinancier[];
  source: string;
};

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
