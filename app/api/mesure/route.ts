import { mesurer } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seule étape que le navigateur signale lui-même : l'ouverture de la page du mandat. Les autres sont notées par le serveur. */
export async function POST(requete: Request) {
  if (tropDappels(`mesure:${adresseDe(requete)}`, 10)) return new Response(null, { status: 429 });
  const corps = (await requete.json().catch(() => null)) as { siren?: unknown } | null;
  const siren = typeof corps?.siren === "string" && /^\d{9}$/.test(corps.siren) ? corps.siren : null;
  if (siren) await mesurer("mandat_ouvert", siren);
  return new Response(null, { status: 204 });
}
