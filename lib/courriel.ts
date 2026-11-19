import { contactVendeur } from "./base";

/**
 * Envoi de courriels au vendeur, par le service Resend. Sans clé (`RESEND_API_KEY`) ni expéditeur (`COURRIEL_EXPEDITEUR`),
 * rien n'est envoyé et la fonction le dit : le site continue de marcher, le vendeur garde son lien à l'écran.
 * Les messages aux repreneurs passent par `lib/envoi.ts`, qui décide s'ils peuvent partir et vers qui.
 */
export const courrielActif = () => Boolean(process.env.RESEND_API_KEY && process.env.COURRIEL_EXPEDITEUR);

export async function envoyer(a: string, sujet: string, texte: string): Promise<boolean> {
  if (!courrielActif()) return false;
  try {
    const rep = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.COURRIEL_EXPEDITEUR, to: [a], subject: sujet, text: `${texte}\n\nShlomo.ai` }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!rep.ok) console.error("Courriel refusé :", rep.status);
    return rep.ok;
  } catch (e) {
    console.error("Courriel non envoyé :", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Prévient le vendeur d'un acte fait par un repreneur (accord signé, rendez-vous choisi, offre déposée).
 * Le lien entre le repreneur et le vendeur n'est lu qu'avec la clé du serveur. Un échec ne bloque jamais l'acte lui-même.
 */
export async function prevenirVendeur(jetonAccord: string, origine: string, sujet: (repreneur: string) => string, texte: (repreneur: string) => string): Promise<void> {
  if (!courrielActif() || !process.env.CLE_SERVEUR) return;
  try {
    const c = await contactVendeur(process.env.CLE_SERVEUR, jetonAccord);
    if (c?.courriel) await envoyer(c.courriel, sujet(c.repreneur), `${texte(c.repreneur)}\n\nVotre suivi : ${origine}/suivi?d=${c.jeton}`);
  } catch {}
}
