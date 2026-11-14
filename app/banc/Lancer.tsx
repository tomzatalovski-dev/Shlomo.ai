"use client";

import { useRef, useState } from "react";

type Tour = { de: "shlomo" | "repreneur"; texte: string; situation?: string; repli?: boolean; ecartes?: string[]; fautes?: { detail: string; grave: boolean; arretee?: boolean }[] };
type Partie = { id: string; nom: string; tours: Tour[]; etat: "attente" | "encours" | "fini" | "erreur"; graves?: number; rendezVous?: boolean; note?: number | null; message?: string };

/** Lance les douze conversations, trois à la fois, et les montre pendant qu'elles se jouent. */
export default function Lancer({ code, personas }: { code: string; personas: { id: string; nom: string }[] }) {
  const [parties, setParties] = useState<Partie[]>([]);
  const [marche, setMarche] = useState(false);
  const file = useRef<string[]>([]);

  const maj = (id: string, avec: (p: Partie) => Partie) => setParties((tous) => tous.map((p) => (p.id === id ? avec(p) : p)));

  const jouerUne = (id: string) =>
    new Promise<void>((fini) => {
      maj(id, (p) => ({ ...p, etat: "encours" }));
      const flux = new EventSource(`/api/banc?c=${encodeURIComponent(code)}&p=${encodeURIComponent(id)}`);
      let clos = false;
      const terminer = (avec: (p: Partie) => Partie) => {
        if (clos) return;
        clos = true;
        flux.close();
        maj(id, avec);
        fini();
      };
      flux.onmessage = (m) => {
        const e = JSON.parse(m.data);
        if (e.type === "tour") maj(id, (p) => ({ ...p, tours: [...p.tours, e.tour as Tour] }));
        else if (e.type === "fin") terminer((p) => ({ ...p, etat: "fini", graves: e.essai.graves, rendezVous: e.essai.rendezVous, note: e.essai.note }));
        else if (e.type === "erreur") terminer((p) => ({ ...p, etat: "erreur", message: e.message }));
      };
      flux.onerror = () => terminer((p) => ({ ...p, etat: "erreur", message: "Connexion interrompue." }));
    });

  async function lancer() {
    setMarche(true);
    setParties(personas.map((p) => ({ ...p, tours: [], etat: "attente" })));
    file.current = personas.map((p) => p.id);
    const ouvrier = async () => {
      for (let id = file.current.shift(); id; id = file.current.shift()) await jouerUne(id);
    };
    await Promise.all([ouvrier(), ouvrier(), ouvrier()]);
    setMarche(false);
    // Les résultats sont enregistrés : on recharge pour les voir dans les tableaux.
    setTimeout(() => window.location.reload(), 2500);
  }

  const finies = parties.filter((p) => p.etat === "fini" || p.etat === "erreur").length;

  return (
    <div className="carte">
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <p className="message"><b>Lancer une série.</b> Douze conversations, environ cinq minutes, quelques dizaines de centimes d'IA.</p>
        <button className="bouton" type="button" onClick={lancer} disabled={marche}>{marche ? `${finies} sur ${parties.length} jouées…` : "Lancer les douze essais"}</button>
      </div>
      {parties.length > 0 && (
        <div className="parties-banc">
          {parties.map((p) => (
            <details key={p.id} className="pli echange" open={p.etat === "encours"}>
              <summary>
                <b>{p.nom}</b> · {p.etat === "attente" ? "en attente" : p.etat === "encours" ? "en cours…" : p.etat === "erreur" ? p.message : `${p.graves ? `${p.graves} faute${p.graves > 1 ? "s" : ""} grave${p.graves > 1 ? "s" : ""} tentée${p.graves > 1 ? "s" : ""}` : "sans faute grave"} · ${p.rendezVous ? "rendez-vous obtenu" : "pas de rendez-vous"}${p.note != null ? ` · ${p.note}/10` : ""}`}
              </summary>
              {p.tours.map((t, i) => (
                <div key={i} className={t.de === "shlomo" ? "bulle nous apparait" : "bulle lui apparait"}>
                  <small>{t.de === "shlomo" ? `Shlomo${t.situation ? ` · ${t.situation}` : ""}${t.repli ? " · réponse d'attente" : ""}` : p.nom}</small>
                  <p>{t.texte}</p>
                  {t.fautes?.map((f, j) => <small key={j} className="faute">{f.grave ? (f.arretee ? "Arrêté par le garde-fou : " : "Faute grave envoyée : ") : "À soigner : "}{f.detail}</small>)}
                  {t.ecartes?.map((x, j) => <small key={`e${j}`} className="faute">Texte arrêté : « {x} »</small>)}
                </div>
              ))}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
