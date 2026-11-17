import { lirePoste } from "@/lib/base";
import { CAS, controlerFiche, controlerRepreneurs } from "@/lib/essais";
import { chercherSociete } from "@/lib/registre";
import { trouverRepreneurs } from "@/lib/repreneurs";
import { avecTaille } from "@/lib/taille";
import { chercherConcurrents } from "@/lib/concurrents";
import { lireSite } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Joue un cas du banc d'essai et rend ses contrôles. Réservé aux fondateurs. Aucune IA n'est appelée. */
export async function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;
  if ((await lirePoste(parametres.get("c") ?? "")) === null) return Response.json({ erreur: "Accès réservé." }, { status: 403 });
  // Diagnostic des concurrents directs d'un vendeur : ce que le web a nommé, ce que le registre en dit. Trois recherches web.
  const diagnostic = parametres.get("concurrents");
  if (diagnostic && /^\d{9}$/.test(diagnostic)) {
    const vendeur = await chercherSociete(diagnostic);
    if (!vendeur) return Response.json({ erreur: "Société inconnue." }, { status: 404 });
    const domaine = parametres.get("site") ?? "";
    const lecture = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domaine) ? await lireSite(domaine).catch(() => null) : null;
    const trouves = await chercherConcurrents(vendeur, lecture ? [lecture.titre, lecture.description, lecture.texte].filter(Boolean).join(" ") : undefined, []);
    return Response.json({ vendeur: `${vendeur.nom} · ${vendeur.effectif}`, metier: trouves?.metier, detail: trouves?.detail ?? null });
  }
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
