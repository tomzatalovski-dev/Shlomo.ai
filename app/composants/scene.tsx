"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * File d'attente d'événements : le serveur répond en moins d'une seconde,
 * l'écran les joue un par un pour que chaque résultat soit lisible.
 * Rien n'est inventé : on ne ralentit que l'affichage de résultats réels.
 */
export function useFile<E>(traiter: (e: E) => Promise<void> | void) {
  const file = useRef<E[]>([]);
  const actif = useRef(false);
  const vivant = useRef(true);
  const dernier = useRef(traiter);
  dernier.current = traiter;

  useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
      file.current = [];
    };
  }, []);

  return useCallback((e: E) => {
    file.current.push(e);
    if (actif.current) return;
    actif.current = true;
    (async () => {
      while (file.current.length && vivant.current) await dernier.current(file.current.shift() as E);
      actif.current = false;
    })();
  }, []);
}

/** Nombre qui se compte jusqu'à sa valeur. */
export function Compteur({ valeur, duree = 900, format = String }: { valeur: number; duree?: number; format?: (n: number) => string }) {
  const [affiche, setAffiche] = useState(0);
  const depart = useRef(0);

  useEffect(() => {
    // Onglet en arrière-plan : le navigateur suspend les animations, on affiche la valeur sans attendre.
    if (typeof document !== "undefined" && document.hidden) {
      depart.current = valeur;
      setAffiche(valeur);
      return;
    }
    const de = depart.current;
    const debut = performance.now();
    let image = 0;
    const pas = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - debut) / duree));
      const v = Math.round(de + (valeur - de) * (1 - Math.pow(1 - p, 3)));
      depart.current = v;
      setAffiche(v);
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    // Filet : si l'animation n'a pas pu se jouer, la valeur exacte s'affiche quand même.
    const filet = setTimeout(() => {
      depart.current = valeur;
      setAffiche(valeur);
    }, duree + 400);
    return () => {
      cancelAnimationFrame(image);
      clearTimeout(filet);
    };
  }, [valeur, duree]);

  return <>{format(affiche)}</>;
}

/**
 * La ligne d'avancement, la même sur toutes les pages où Shlomo travaille.
 * Le pourcentage est celui du travail réellement fait ; le reflet qui passe sur le texte dit seulement « en cours », il s'arrête à la fin.
 */
const SEGMENTS = 24;

export function Avance({ pct, texte, trace }: { pct: number; texte: string; trace?: string }) {
  const fini = pct >= 100;
  const borne = Math.max(0, Math.min(100, Math.round(pct)));
  const pleins = Math.round((borne / 100) * SEGMENTS);
  const [survol, setSurvol] = useState<number | null>(null);
  // Le travail fini, la barre a dit ce qu'elle avait à dire : elle se retire.
  const [partie, setPartie] = useState(false);
  useEffect(() => {
    if (!fini) return setPartie(false);
    const t = setTimeout(() => setPartie(true), 2200);
    return () => clearTimeout(t);
  }, [fini]);
  if (partie) return null;
  return (
    <div className={fini ? "avance fini" : "avance"}>
      <div className="avance-tete">
        <span key={texte} className="avance-texte">{texte}</span>
        <span className="avance-pct">{fini ? "Terminé" : `${borne} %`}</span>
      </div>
      <div className="segments" role="progressbar" aria-valuenow={borne} aria-valuemin={0} aria-valuemax={100} aria-label={texte} onMouseLeave={() => setSurvol(null)}>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const ecart = survol === null ? 9 : Math.abs(survol - i);
          const vague = ecart === 0 ? 1 : ecart <= 3 ? 0.65 * Math.cos((ecart / 3) * (Math.PI / 2)) : 0;
          const classe = i < pleins ? (i === pleins - 1 && !fini ? "segment plein tete" : "segment plein") : "segment";
          return (
            <span
              key={i}
              className={classe}
              onMouseEnter={() => setSurvol(i)}
              style={{ transform: `scaleY(${1 + 0.45 * vague}) translateY(${-1 * vague}px)`, transitionDelay: survol === null ? `${i * 18}ms` : "0ms" }}
            />
          );
        })}
      </div>
      {!fini && (
        <p className="avance-trace" aria-hidden="true">
          {trace && <span key={trace}>{trace}</span>}
        </p>
      )}
    </div>
  );
}

export function euros(n?: number): string {
  if (n === undefined) return "Non publié";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (a >= 1_000) return `${Math.round(n / 1_000).toLocaleString("fr-FR")} k€`;
  return `${n.toLocaleString("fr-FR")} €`;
}
