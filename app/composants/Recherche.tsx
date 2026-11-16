"use client";

import { useEffect, useState } from "react";
import { analyserSaisie } from "@/lib/saisie";

const EXEMPLES = ["votresociete.fr", "812 781 797", "www.atelier-martin.fr"];

/** Ce que Shlomo comprend de la saisie, dit au fur et à mesure : rien n'est deviné, c'est la même lecture que celle du serveur. */
function lecture(valeur: string): { etat: "attente" | "compris" | "doute"; texte: string } {
  const v = valeur.trim();
  if (!v) return { etat: "attente", texte: "Un site ou un numéro SIREN suffit. Rien d'autre à remplir." };
  const s = analyserSaisie(v);
  if (s.type === "siren") return { etat: "compris", texte: `Numéro SIREN reconnu : ${s.siren.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}` };
  if (s.type === "site") return { etat: "compris", texte: `Site reconnu : ${s.domaine}` };
  const chiffres = v.replace(/[\s.-]/g, "");
  // On ne corrige pas quelqu'un qui est encore en train de taper.
  if (/^\d{9,}$/.test(chiffres) || (v.includes(".") && v.length > 6 && !/^\d/.test(v))) return { etat: "doute", texte: s.raison };
  return { etat: "attente", texte: /^\d+$/.test(chiffres) ? `Un SIREN compte 9 chiffres : encore ${Math.max(0, 9 - chiffres.length)}.` : "Continuez : l'adresse de votre site, ou votre numéro SIREN." };
}

/** Le champ unique de l'accueil. Sans JavaScript, c'est un formulaire ordinaire qui mène à la fiche. */
export function Recherche() {
  const [valeur, setValeur] = useState("");
  const [exemple, setExemple] = useState(EXEMPLES[0]);
  const [envoi, setEnvoi] = useState(false);
  const lu = lecture(valeur);

  // L'exemple s'écrit lettre à lettre tant que le champ est vide. Sans animation si la personne les a désactivées.
  useEffect(() => {
    if (valeur || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let mot = 0;
    let lettres = EXEMPLES[0].length;
    let sens: 1 | -1 = -1;
    let pause = 14;
    const horloge = setInterval(() => {
      if (pause > 0) return void pause--;
      lettres += sens;
      if (lettres <= 0) {
        mot = (mot + 1) % EXEMPLES.length;
        sens = 1;
      } else if (lettres >= EXEMPLES[mot].length) {
        sens = -1;
        pause = 22;
      }
      setExemple(EXEMPLES[mot].slice(0, Math.max(0, lettres)));
    }, 85);
    return () => clearInterval(horloge);
  }, [valeur]);

  return (
    <>
      <form className={envoi ? "invite envoi" : "invite"} action="/dossier" method="get" onSubmit={() => setEnvoi(true)}>
        <div className="invite-corps">
          <label className="cache" htmlFor="q">Site internet ou numéro SIREN</label>
          <input id="q" name="q" type="text" inputMode="url" enterKeyHint="go" placeholder={exemple || " "} autoComplete="off" autoCapitalize="none" spellCheck={false} required value={valeur} onChange={(e) => setValeur(e.target.value)} />
          <button type="submit" aria-label="Trouver mes repreneurs" disabled={envoi}>
            <span>Trouver mes repreneurs</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </button>
        </div>
      </form>
      <p className={`invite-lecture ${lu.etat}`} aria-live="polite">{envoi ? "Shlomo ouvre votre dossier…" : lu.texte}</p>
    </>
  );
}
