import { trouverAccord } from "@/lib/base";
import { codeDe } from "@/lib/envoi";
import { adresseDe, tropDappels } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le lien court imprimé sur une lettre ou collé dans un message : il mène à la page écrite pour ce repreneur. */
export async function GET(requete: Request, { params }: { params: Promise<{ code: string }> }) {
  const origine = new URL(requete.url).origin;
  if (tropDappels(`court:${adresseDe(requete)}`, 12)) return new Response("Trop d'essais. Réessayez dans une minute.", { status: 429 });
  const jeton = await trouverAccord(codeDe((await params).code)).catch(() => null);
  return Response.redirect(jeton ? `${origine}/accord?a=${jeton}` : `${origine}/`, 302);
}
