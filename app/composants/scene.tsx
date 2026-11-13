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
    const de = depart.current;
    const debut = performance.now();
    let image = 0;
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / duree);
      const v = Math.round(de + (valeur - de) * (1 - Math.pow(1 - p, 3)));
      setAffiche(v);
      if (p < 1) image = requestAnimationFrame(pas);
      else depart.current = valeur;
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [valeur, duree]);

  return <>{format(affiche)}</>;
}

export function Avance({ pct, texte }: { pct: number; texte: string }) {
  return (
    <div className="avance-bloc">
      <div className="avance-ligne">{texte}</div>
      <div className="barre" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
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
