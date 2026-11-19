"use client";

export default function Imprimer() {
  return <button className="bouton petit sans-impression" type="button" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button>;
}
