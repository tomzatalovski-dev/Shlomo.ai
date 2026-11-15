import { BaseIndisponible, validerFourchette } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le vendeur confirme la fourchette de prix que Shlomo pourra annoncer aux repreneurs. */
export async function POST(requete: Request) {
  if (tropDappels(`prix:${adresseDe(requete)}`, 10)) return Response.json({ erreur: "Trop de demandes." }, { status: 429 });
  const c = (await requete.json().catch(() => null)) as { jeton?: unknown; bas?: unknown; haut?: unknown } | null;
  const bas = Math.round(Number(c?.bas));
  const haut = Math.round(Number(c?.haut));
  if (!Number.isFinite(bas) || !Number.isFinite(haut) || bas < 1000 || haut < bas) return Response.json({ erreur: "Indiquez deux montants, le second au moins égal au premier." }, { status: 400 });
  try {
    const fait = await validerFourchette(String(c?.jeton ?? ""), bas, haut);
    return Response.json(fait ? { fait } : { erreur: "Ces montants n'ont pas pu être enregistrés." }, { status: fait ? 200 : 409 });
  } catch (e) {
    return Response.json({ erreur: e instanceof BaseIndisponible ? "Enregistrement impossible pour le moment." : "Imprévu." }, { status: 503 });
  }
}
