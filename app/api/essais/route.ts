import { lirePoste } from "@/lib/base";
import { CAS, controlerFiche, controlerRepreneurs } from "@/lib/essais";
import { chercherSociete } from "@/lib/registre";
import { trouverRepreneurs } from "@/lib/repreneurs";
import { avecTaille } from "@/lib/taille";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Joue un cas du banc d'essai et rend ses contrôles. Réservé aux fondateurs. Aucune IA n'est appelée. */
export async function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;
  if ((await lirePoste(parametres.get("c") ?? "")) === null) return Response.json({ erreur: "Accès réservé." }, { status: 403 });
  const i = Number(parametres.get("i"));
  const cas = CAS[i];
  if (!Number.isInteger(i) || !cas) return Response.json({ cas: CAS.length });

  const debut = Date.now();
  try {
    const fiche = await chercherSociete(cas.siren);
    const controles = controlerFiche(cas, fiche);
    let classes: number | undefined;
    if (fiche && cas.attendu === "cessible" && fiche.active && !fiche.horsParcours) {
      const vendeur = avecTaille(fiche, cas.taille);
      const { repreneurs } = await trouverRepreneurs(vendeur, () => {}, () => {});
      classes = repreneurs.length;
      controles.push(...controlerRepreneurs(cas, vendeur, repreneurs));
    }
    return Response.json({ quoi: cas.quoi, siren: cas.siren, nom: fiche?.entrepreneurIndividuel ? undefined : fiche?.nom, classes, controles, reussi: controles.every((c) => c.ok), duree_s: Number(((Date.now() - debut) / 1000).toFixed(1)) });
  } catch (e) {
    return Response.json({ quoi: cas.quoi, siren: cas.siren, controles: [{ nom: "Le cas s'est exécuté jusqu'au bout", ok: false, detail: e instanceof Error ? e.message.slice(0, 160) : "erreur" }], reussi: false, duree_s: Number(((Date.now() - debut) / 1000).toFixed(1)) });
  }
}
