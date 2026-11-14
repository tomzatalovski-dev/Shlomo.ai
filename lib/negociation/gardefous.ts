import { trahit } from "../fiche";

/** Ce que le négociateur sait du dossier. Les garde-fous comparent chaque message à ces faits. */
export type Dossier = {
  vendeur: { nom: string; ville: string; site?: string };
  activite: string;
  region: string;
  effectif: string;
  /** Fourchette de prix validée par le vendeur. Sans elle, aucun montant ne peut être annoncé. */
  fourchette: { bas: number; haut: number } | null;
  /** L'accord de confidentialité est-il signé par ce repreneur ? */
  accordSigne: boolean;
  /** Nombre de repreneurs réellement en discussion sur ce dossier, celui-ci compris. */
  repreneursActifs: number;
  /** Nombre d'offres réellement reçues. */
  offresRecues: number;
  /** Date de remise des offres, si le vendeur en a fixé une. */
  echeance: string | null;
};

export type Faute = { regle: "identite" | "prix" | "concurrence" | "echeance" | "civilite" | "promesse" | "longueur"; grave: boolean; detail: string };

/** Montants en euros cités dans un texte : « 600 000 € », « 1,2 M€ », « 450 k€ », « 800000 euros ». */
export function montants(texte: string): number[] {
  const trouves: number[] = [];
  const motif = /(\d{1,3}(?:[   .]\d{3})+|\d+(?:[.,]\d+)?)\s*(millions?|M|k|K)?\s*(?:€|euros?)/g;
  for (const m of texte.matchAll(motif)) {
    const brut = m[1];
    const unite = m[2] ?? "";
    let valeur = /[   .]\d{3}/.test(brut) ? Number(brut.replace(/[   .]/g, "")) : Number(brut.replace(",", "."));
    if (/^m/i.test(unite)) valeur *= 1_000_000;
    else if (/^k/i.test(unite)) valeur *= 1_000;
    if (Number.isFinite(valeur) && valeur > 0) trouves.push(Math.round(valeur));
  }
  return trouves;
}

const AUTRES = /\b(autres?|plusieurs|d'autres)\s+(repreneurs?|acqu[ée]reurs?|candidats?|acheteurs?|soci[ée]t[ée]s int[ée]ress[ée]es)\b|\bvous n'[êe]tes pas (le )?seul\b|\bconcurrence\b/i;
// Seule l'affirmation qu'une offre existe est visée, pas le mot « offre » : « ce qui rendrait votre offre forte » est permis.
const OFFRE = /\b(avons|a|ont|ai)\s+(d[ée]j[àa]\s+)?re[çc]u\s+(une|des|plusieurs|deux|trois|d'autres)\s+offres?\b|\boffres?\s+(d[ée]j[àa]\s+)?(re[çc]ues?|concurrentes?)\b|\boffres?\s+(a|ont)\s+[ée]t[ée]\s+re[çc]ues?\b|\bd'autres offres\b|\boffre\s+(est\s+)?sur la table\b/i;
const LIMITE = /\b(date limite|dernier d[ée]lai|avant le \d|d'ici (lundi|mardi|mercredi|jeudi|vendredi|la fin de (la )?semaine|quelques jours)|remise des offres)\b/i;

/**
 * Vérifie un message du négociateur contre les faits du dossier.
 * Ces règles ne dépendent pas de la bonne volonté de l'IA : un message fautif ne part pas.
 * `messageRepreneur` sert à ne pas compter comme faute un montant que le repreneur a lui-même avancé.
 */
export function verifier(reponse: string, dossier: Dossier, messageRepreneur = ""): Faute[] {
  const fautes: Faute[] = [];

  if (!dossier.accordSigne && trahit(reponse, { nom: dossier.vendeur.nom, ville: dossier.vendeur.ville, site: dossier.vendeur.site, activite: dossier.activite })) {
    fautes.push({ regle: "identite", grave: true, detail: "Le message laisse reconnaître le vendeur avant l'accord de confidentialité." });
  }

  const avances = new Set(montants(messageRepreneur));
  for (const m of montants(reponse)) {
    if (avances.has(m)) continue;
    if (!dossier.fourchette) fautes.push({ regle: "prix", grave: true, detail: `Montant annoncé (${m.toLocaleString("fr-FR")} €) alors qu'aucune fourchette n'est validée.` });
    else if (m !== dossier.fourchette.bas && m !== dossier.fourchette.haut) fautes.push({ regle: "prix", grave: true, detail: `Montant annoncé (${m.toLocaleString("fr-FR")} €) différent des bornes validées par le vendeur.` });
  }

  if (dossier.repreneursActifs < 2 && AUTRES.test(reponse)) fautes.push({ regle: "concurrence", grave: true, detail: "Le message évoque d'autres repreneurs alors que le dossier n'en compte pas." });
  if (dossier.offresRecues === 0 && OFFRE.test(reponse)) fautes.push({ regle: "concurrence", grave: true, detail: "Le message évoque une offre reçue alors que le dossier n'en compte aucune." });
  if (!dossier.echeance && LIMITE.test(reponse)) fautes.push({ regle: "echeance", grave: true, detail: "Le message annonce une échéance qui n'est pas au dossier." });

  if (/\b(Monsieur|Madame)\b/.test(reponse)) fautes.push({ regle: "civilite", grave: false, detail: "Civilité devinée." });
  if (/\b(garanti[es]?|sans (aucun )?risque|affaire en or|occasion unique)\b/i.test(reponse)) fautes.push({ regle: "promesse", grave: false, detail: "Promesse ou formule de vendeur." });
  if (reponse.split(/\s+/).length > 170) fautes.push({ regle: "longueur", grave: false, detail: "Message trop long." });

  return fautes;
}
