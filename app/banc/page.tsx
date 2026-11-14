import type { Metadata } from "next";
import { lireEssais } from "@/lib/base";
import { PERSONAS } from "@/lib/negociation/banc";
import { PRINCIPES, SITUATIONS, VERSION } from "@/lib/negociation/manuel";
import Lancer from "./Lancer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Banc d'essai du négociateur — Shlomo.ai", robots: { index: false, follow: false }, referrer: "no-referrer" };

const nomDe = (id: string) => PERSONAS.find((p) => p.id === id)?.nom ?? id;
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Tableau de bord du négociateur : ce que le manuel donne, version après version. Réservé aux fondateurs. */
export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const code = (await searchParams).c ?? "";
  const bilan = await lireEssais(code).catch(() => null);

  if (!bilan) {
    return (
      <div className="page">
        <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
        <div className="corps seul"><main className="resultat"><h1>Accès refusé.</h1><p className="sous">Cette page demande le code de pilotage.</p></main></div>
      </div>
    );
  }

  const courante = bilan.versions.find((v) => v.version === VERSION);

  return (
    <div className="page">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul banc">
        <main className="resultat">
          <div>
            <h1>Le négociateur à l'épreuve.</h1>
            <p className="sous">Douze repreneurs simulés cherchent à lui faire commettre une faute. Chaque échange est gardé et daté, pour comparer les versions du manuel dans le temps. Ce sont des essais : aucun vrai repreneur n'est contacté.</p>
          </div>

          <div className="entonnoir">
            <div className="chiffre"><span>Manuel</span><b>v{VERSION}</b></div>
            <div className="chiffre"><span>Conversations jouées</span><b>{courante?.essais ?? 0}</b></div>
            <div className="chiffre"><span>Sans faute grave tentée</span><b>{courante ? `${Math.round((courante.sans_faute / courante.essais) * 100)} %` : "—"}</b></div>
            <div className="chiffre"><span>Rendez-vous obtenus</span><b>{courante ? `${Math.round((courante.rendez_vous / courante.essais) * 100)} %` : "—"}</b></div>
            <div className="chiffre cle"><span>Note de l'arbitre</span><b>{courante?.note != null ? `${courante.note} / 10` : "—"}</b></div>
          </div>

          <Lancer code={code} personas={PERSONAS.map(({ id, nom }) => ({ id, nom }))} />

          {bilan.personas.length > 0 && (
            <div className="carte tableau-carte">
              <table className="tableau">
                <thead><tr><th>Repreneur simulé (manuel v{bilan.personas[0].version})</th><th>Essais</th><th>Fautes graves tentées</th><th>Rendez-vous</th><th>Note</th></tr></thead>
                <tbody>
                  {bilan.personas.map((p) => (
                    <tr key={p.persona}>
                      <td><b>{nomDe(p.persona)}</b></td>
                      <td>{p.essais}</td>
                      <td style={p.graves > 0 ? { color: "#b4690e", fontWeight: 600 } : undefined}>{p.graves}</td>
                      <td>{p.rendez_vous}</td>
                      <td>{p.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bilan.versions.length > 1 && (
            <div className="carte tableau-carte">
              <table className="tableau">
                <thead><tr><th>Version du manuel</th><th>Période</th><th>Essais</th><th>Sans faute grave</th><th>Rendez-vous</th><th>Note</th></tr></thead>
                <tbody>
                  {bilan.versions.map((v) => (
                    <tr key={v.version}>
                      <td><b>v{v.version}</b></td>
                      <td>{jour(v.premier)} – {jour(v.dernier)}</td>
                      <td>{v.essais}</td>
                      <td>{Math.round((v.sans_faute / v.essais) * 100)} %</td>
                      <td>{Math.round((v.rendez_vous / v.essais) * 100)} %</td>
                      <td>{v.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bilan.derniers.length > 0 && (
            <div className="carte">
              <p className="source">Derniers échanges joués</p>
              {bilan.derniers.map((e) => (
                <details key={e.id} className="pli echange">
                  <summary>
                    <b>{nomDe(e.persona)}</b> · {jour(e.cree_le)} · v{e.version} · {e.graves > 0 ? `${e.graves} faute${e.graves > 1 ? "s" : ""} grave${e.graves > 1 ? "s" : ""} tentée${e.graves > 1 ? "s" : ""}` : "sans faute grave"} · {e.rendez_vous ? "rendez-vous obtenu" : "pas de rendez-vous"}{e.note != null ? ` · ${e.note}/10` : ""}
                  </summary>
                  {e.tours.map((t, i) => (
                    <div key={i} className={t.de === "shlomo" ? "bulle nous" : "bulle lui"}>
                      <small>{t.de === "shlomo" ? `Shlomo${t.situation ? ` · ${t.situation}` : ""}${t.repli ? " · réponse d'attente" : ""}` : nomDe(e.persona)}</small>
                      <p>{t.texte}</p>
                      {t.fautes?.map((f, j) => <small key={j} className="faute">{f.grave ? (f.arretee ? "Arrêté par le garde-fou : " : "Faute grave envoyée : ") : "À soigner : "}{f.detail}</small>)}
                    </div>
                  ))}
                  {e.avis && <p className="source">Arbitre : {e.avis}</p>}
                </details>
              ))}
            </div>
          )}

          <div className="carte">
            <p className="source">Le manuel, version {VERSION}</p>
            <ul className="faits">{PRINCIPES.map((p) => <li key={p}>{p}</li>)}</ul>
            {SITUATIONS.map((s) => (
              <details key={s.nom} className="pli">
                <summary><b>{s.nom}</b> · {s.objectif}</summary>
                <p className="message" style={{ fontSize: 14 }}>Quand : {s.quand}</p>
                <p className="message" style={{ fontSize: 14 }}>À faire : {s.faire.join(" ")}</p>
                <p className="message" style={{ fontSize: 14 }}>Jamais : {s.jamais.join(" ")}</p>
              </details>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
