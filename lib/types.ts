/** Ce que l'utilisateur a saisi, une fois compris. */
export type Saisie =
  | { type: "siren"; siren: string }
  | { type: "site"; domaine: string; url: string }
  | { type: "invalide"; raison: string };

/** `societe` vaut vrai quand le dirigeant inscrit au registre est lui-même une société. */
export type Dirigeant = { nom: string; qualite?: string; societe?: boolean };

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
  /** Nombre d'établissements ouverts, quand le registre le donne. */
  etablissements?: number;
  dirigeants: Dirigeant[];
  finances: ExerciceFinancier[];
  source: string;
};

/** Une activité où chercher des repreneurs : celle du vendeur, ou une activité voisine. */
export type Metier = { code: string; libelle: string; lien: "meme" | "voisin" };

/** Une société proposée au vendeur quand le site ne suffit pas à l'identifier avec certitude. */
export type Proposition = { siren: string; nom: string; ville?: string; codePostal?: string };

export type ProfilRepreneur = "departement" | "region" | "national";

/** Repreneur complet, tel que le serveur le connaît. Ne quitte jamais le serveur avant le mandat. */
export type Repreneur = {
  societe: Societe;
  profil: ProfilRepreneur;
  metier?: Metier;
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

/** Ce que le vendeur reçoit une fois le mandat signé. */
export type RepreneurRevele = {
  rang: number;
  nom: string;
  siren: string;
  ville?: string;
  effectif?: string;
  profil: string;
  score: number;
  raisons: string[];
};

/** Une société examinée, telle que l'écran peut la montrer pendant la recherche : jamais de nom. */
export type CandidatMasque = {
  effectif?: string;
  anneeCreation?: number;
  retenu: boolean;
  motif?: string;
  score?: number;
  raison?: string;
  details?: string[];
};

export type EvenementRepreneurs =
  | { type: "journal"; texte: string; etat: "ok" | "alerte" }
  | { type: "encours"; texte: string }
  | { type: "vendeur"; nom: string; siren: string }
  | { type: "metier"; total: number }
  | { type: "metiers"; liste: Metier[] }
  | { type: "passage"; profil: ProfilRepreneur; libelle: string; candidats: CandidatMasque[]; echec?: boolean }
  | { type: "repreneurs"; liste: RepreneurMasque[]; examinees: number }
  | { type: "reveles"; liste: RepreneurRevele[]; examinees: number }
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

export type ResumeIA = {
  description: string;
  pointsForts: string[];
  /** Le métier réel, en quelques mots, tel que le site le montre. */
  metier?: string;
  /** Codes d'activité proposés par l'IA. À vérifier au registre avant tout usage. */
  codes?: Metier[];
};

/** Événements envoyés au navigateur pendant l'analyse. */
export type Evenement =
  | { type: "journal"; texte: string; etat: "ok" | "alerte" }
  | { type: "encours"; texte: string }
  | { type: "societe"; societe: Societe }
  | { type: "site"; domaine: string; titre?: string; description?: string }
  | { type: "resume"; resume: ResumeIA }
  | { type: "besoin_siren"; message: string; propositions?: Proposition[] }
  | { type: "metiers"; libelle?: string; liste: (Metier & { total?: number })[] }
  | { type: "erreur"; message: string }
  | { type: "fin" };

/** Un fait public trouvé sur un repreneur, avec la page où il a été lu. */
export type Signal = { texte: string; source: string };

/** Une ligne du tableau de prospection : un repreneur et l'état de son approche. */
export type LigneAtelier = {
  siren: string;
  nom: string;
  rang: number;
  ville?: string | null;
  effectif?: string | null;
  etat: "a_faire" | "pret" | "refus" | "raye" | "contacte" | "echec";
  decideur?: string | null;
  qualite?: string | null;
  message?: string | null;
  site?: string | null;
  signaux?: Signal[] | null;
};

/** Événements envoyés au navigateur pendant la préparation des approches. */
export type EvenementAtelier =
  | { type: "plan"; societe: string; lignes: LigneAtelier[] }
  | { type: "etape"; agent: number; siren: string; etape: "registre" | "veille" | "redaction" | "enregistrement" }
  | { type: "signaux"; agent: number; siren: string; site?: string; signaux: Signal[] }
  | { type: "decideur"; agent: number; siren: string; nom?: string; qualite?: string }
  | { type: "refus"; agent: number; siren: string }
  | { type: "message"; agent: number; siren: string; texte: string }
  | { type: "pret"; agent: number; siren: string }
  | { type: "echec"; agent: number; siren: string }
  | { type: "erreur"; message: string }
  | { type: "fin" };
