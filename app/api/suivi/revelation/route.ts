import { BaseIndisponible, deciderRevelation } from "@/lib/base";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le vendeur autorise ou refuse que son nom soit communiqué à un repreneur qui a signé l'accord. */
export async function POST(requete: Request) {
  if (tropDappels(`revelation:${adresseDe(requete)}`, 20)) return Response.json({ erreur: "Trop de demandes." }, { status: 429 });
  const c = (await requete.json().catch(() => null)) as { jeton?: unknown; siren?: unknown; autorise?: unknown } | null;
  if (typeof c?.autorise !== "boolean") return Response.json({ erreur: "Décision manquante." }, { status: 400 });
  try {
    const fait = await deciderRevelation(String(c?.jeton ?? ""), String(c?.siren ?? ""), c.autorise);
    return Response.json({ fait }, { status: fait ? 200 : 409 });
  } catch (e) {
    return Response.json({ erreur: e instanceof BaseIndisponible ? "Enregistrement impossible pour le moment." : "Imprévu." }, { status: 503 });
  }
}
