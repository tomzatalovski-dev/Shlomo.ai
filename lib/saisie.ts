import type { Saisie } from "./types";

/** Clé de Luhn : vraie pour tout SIREN ou SIRET valide. */
export function luhnValide(chiffres: string): boolean {
  let somme = 0;
  for (let i = 0; i < chiffres.length; i++) {
    let n = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

const DOMAINE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/**
 * Comprend la saisie unique de la page d'accueil :
 * un SIREN (9 chiffres), un SIRET (14), un numéro de TVA français, ou un site.
 */
export function analyserSaisie(brut: string): Saisie {
  const texte = brut.trim();
  if (!texte) return { type: "invalide", raison: "Saisissez votre site ou votre numéro SIREN." };

  const compact = texte.replace(/[\s. -]/g, "").toUpperCase();

  // Numéro de TVA français : FR + 2 caractères + SIREN
  const tva = compact.match(/^FR[0-9A-Z]{2}(\d{9})$/);
  const chiffres = tva ? tva[1] : compact;

  if (/^\d+$/.test(chiffres)) {
    if (chiffres.length !== 9 && chiffres.length !== 14) {
      return { type: "invalide", raison: "Un SIREN compte 9 chiffres, un SIRET 14." };
    }
    const siren = chiffres.slice(0, 9);
    if (!luhnValide(siren)) {
      return { type: "invalide", raison: "Ce numéro SIREN n'est pas valide. Vérifiez les chiffres." };
    }
    return { type: "siren", siren };
  }

  if (/^BE0?\d{9,10}$/.test(compact)) {
    return { type: "invalide", raison: "Shlomo ne couvre pour l'instant que les sociétés françaises." };
  }

  const domaine = texte
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];

  if (DOMAINE.test(domaine)) {
    return { type: "site", domaine, url: `https://${domaine}/` };
  }
  return { type: "invalide", raison: "Je n'ai reconnu ni un site ni un numéro SIREN." };
}
