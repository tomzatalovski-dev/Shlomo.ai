import { BaseIndisponible, jetonValide, signerAccord } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refus = (message: string, statut = 400) => Response.json({ erreur: message }, { status: statut });

/** Un repreneur signe l'accord de confidentialité. Le nom du cédant ne lui est pas donné ici : il faut encore le feu vert du cédant. */
export async function POST(requete: Request) {
  if (tropDappels(`accord:${adresseDe(requete)}`, 5)) return refus("Trop de demandes en peu de temps.", 429);
  const c = (await requete.json().catch(() => null)) as { jeton?: unknown; signataire?: unknown; qualite?: unknown; accepte?: unknown } | null;
  const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const jeton = texte(c?.jeton, 40);
  const signataire = texte(c?.signataire, 120);
  if (!jetonValide(jeton) || signataire.length < 3 || c?.accepte !== true) return refus("Indiquez votre nom et acceptez l'accord.");
  try {
    return (await signerAccord(jeton, signataire, texte(c?.qualite, 120))) ? Response.json({ signe: true }) : refus("Cet accord est déjà signé ou n'est plus disponible.", 409);
  } catch (e) {
    return refus("L'enregistrement a échoué. Réessayez dans un instant.", e instanceof BaseIndisponible ? 503 : 500);
  }
}
