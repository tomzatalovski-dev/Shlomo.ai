import { BaseIndisponible, fixerCreneaux } from "@/lib/base";
import { creneauValide } from "@/lib/creneaux";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le vendeur indique quand il peut rencontrer un repreneur. Ces créneaux ne sont montrés qu'aux repreneurs autorisés. */
export async function POST(requete: Request) {
  if (tropDappels(`creneaux:${adresseDe(requete)}`, 20)) return Response.json({ erreur: "Trop de demandes." }, { status: 429 });
  const c = (await requete.json().catch(() => null)) as { jeton?: unknown; creneaux?: unknown } | null;
  const liste = Array.isArray(c?.creneaux) ? [...new Set(c.creneaux.filter(creneauValide))] : null;
  if (!liste || liste.length > 5 || liste.length !== (c!.creneaux as unknown[]).length) return Response.json({ erreur: "Indiquez jusqu'à cinq dates, toutes différentes." }, { status: 400 });
  try {
    const fait = await fixerCreneaux(String(c?.jeton ?? ""), liste);
    return Response.json({ fait }, { status: fait ? 200 : 409 });
  } catch (e) {
    return Response.json({ erreur: "Enregistrement impossible pour le moment." }, { status: e instanceof BaseIndisponible ? 503 : 500 });
  }
}
