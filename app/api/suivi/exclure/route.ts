import { BaseIndisponible, exclureRepreneur } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le vendeur raye ou rétablit un repreneur, tant qu'il n'a pas été contacté. */
export async function POST(requete: Request) {
  if (tropDappels(`exclure:${adresseDe(requete)}`, 30)) return Response.json({ erreur: "Trop de demandes." }, { status: 429 });
  const corps = (await requete.json().catch(() => null)) as { jeton?: unknown; siren?: unknown; exclu?: unknown } | null;
  try {
    const fait = await exclureRepreneur(String(corps?.jeton ?? ""), String(corps?.siren ?? ""), corps?.exclu === true);
    return Response.json({ fait }, { status: fait ? 200 : 409 });
  } catch (e) {
    return Response.json({ erreur: e instanceof BaseIndisponible ? "Enregistrement impossible pour le moment." : "Imprévu." }, { status: 503 });
  }
}
