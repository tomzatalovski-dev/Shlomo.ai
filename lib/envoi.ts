/**
 * Envoi des messages aux repreneurs.
 * Deux régimes, et rien entre les deux :
 *  - dossier d'essai : le message part vers l'adresse de l'équipe (`COURRIEL_EQUIPE`), jamais vers le repreneur ;
 *  - dossier réel : le message ne part vers le repreneur que si l'envoi réel est ouvert (`ENVOI_REEL=oui`), ce qui attend la validation de l'avocat.
 * Un dossier réel n'avance donc jamais sur un message que le repreneur n'a pas reçu.
 */
export const equipe = () => (process.env.COURRIEL_EQUIPE ?? "").trim().toLowerCase();
export const envoiReel = () => process.env.ENVOI_REEL === "oui";
export const relancesAuto = () => process.env.RELANCES_AUTO === "oui";

export type Destination = { a: string; essai: boolean } | { refus: string };

export function destination(dossierEssai: boolean, courrielRepreneur?: string | null): Destination {
  if (dossierEssai) return equipe() ? { a: equipe(), essai: true } : { refus: "Aucune adresse d'équipe n'est réglée (COURRIEL_EQUIPE) : l'essai n'a nulle part où arriver." };
  if (!envoiReel()) return { refus: "L'envoi réel n'est pas ouvert. Envoyez ce message vous-même, puis notez-le « contacté » ; ou passez le dossier en essai pour tester." };
  if (!courrielRepreneur) return { refus: "Saisissez d'abord l'adresse du destinataire." };
  return { a: courrielRepreneur, essai: false };
}

/** « 3f9a1c0b77de » s'écrit « 3f9a-1c0b-77de » sur le papier. */
export const lienCourt = (origine: string, code: string) => `${origine}/r/${code.replace(/(.{4})(?=.)/g, "$1-")}`;
export const codeDe = (saisi: string) => saisi.toLowerCase().replace(/[^0-9a-f]/g, "");

const SIGNATURE = "L'assistant de Shlomo\nMessage rédigé par un assistant d'intelligence artificielle, pour l'équipe Shlomo.";
const STOP = "Pour ne plus recevoir de message de notre part, répondez simplement « stop ».";

/**
 * Le premier message tel qu'il part : celui que les agents ont préparé et relu, avec le lien vers la page écrite pour ce repreneur
 * à la place du lien vers la présentation commune.
 */
export function composerPremier(message: string, lien: string): { sujet: string; texte: string } {
  const sansAncien = message.replace(/\n?[^\n]*https?:\/\/\S+\/fiche\?f=\S+[^\n]*/g, "").trim();
  const [corps, ...signature] = sansAncien.split(/\n(?=L'assistant de Shlomo)/);
  const texte = `${corps.trim()}\n\nLa page écrite pour vous, sans engagement : ${lien}\n\n${signature.length ? signature.join("\n").trim() : SIGNATURE}\n\n${STOP}`;
  return { sujet: "Une société à reprendre dans votre métier", texte };
}

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** Les deux relances. Écrites ici, sans IA : elles ne disent rien de plus que le premier message. */
export function composerRelance(numero: 1 | 2, r: { decideur?: string | null; premierLe?: string | null; lien: string }): { sujet: string; texte: string } {
  const bonjour = r.decideur ? `Bonjour ${r.decideur},` : "Bonjour,";
  const quand = r.premierLe ? ` le ${jour(r.premierLe)}` : "";
  const corps = numero === 1
    ? `Je reviens vers vous au sujet de la société à reprendre dont je vous ai parlé${quand}. La page écrite pour vous explique pourquoi nous avons pensé à votre société : ${r.lien}\n\nUn mot de votre part suffit, y compris pour me dire que le sujet ne vous concerne pas.`
    : `C'est mon dernier message au sujet de la société à reprendre dont je vous ai parlé${quand}. Si le sujet vous intéresse un jour, la page reste ouverte : ${r.lien}\n\nSans réponse de votre part, je ne vous écrirai plus.`;
  return { sujet: numero === 1 ? "Suite à mon message : une société à reprendre" : "Dernier message : une société à reprendre", texte: `${bonjour}\n\n${corps}\n\n${SIGNATURE}\n\n${STOP}` };
}

/** En essai, le message dit en tête à qui il serait parti. */
export function habillerEssai(m: { sujet: string; texte: string }, repreneur: string, destinataireReel?: string | null): { sujet: string; texte: string } {
  return { sujet: `[Essai] ${m.sujet}`, texte: `Message d'essai. En réel, il partirait vers ${repreneur}${destinataireReel ? ` (${destinataireReel})` : ", dont l'adresse n'est pas encore saisie"}.\n— — —\n\n${m.texte}` };
}
