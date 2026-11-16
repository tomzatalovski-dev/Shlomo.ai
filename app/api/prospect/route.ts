import { garderProspect } from "@/lib/base";
import { COURRIEL } from "@/lib/qualite";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un dirigeant laisse son adresse avant le mandat, pour retrouver son dossier plus tard. */
export async function POST(requete: Request) {
  if (tropDappels(`prospect:${adresseDe(requete)}`, 5)) return Response.json({ erreur: "Trop de demandes." }, { status: 429 });
  const c = (await requete.json().catch(() => null)) as { siren?: unknown; courriel?: unknown } | null;
  const courriel = typeof c?.courriel === "string" ? c.courriel.trim().toLowerCase() : "";
  if (!COURRIEL.test(courriel)) return Response.json({ erreur: "Adresse invalide." }, { status: 400 });
  const fait = await garderProspect(String(c?.siren ?? ""), courriel).catch(() => false);
  return Response.json({ fait }, { status: fait ? 200 : 409 });
}
