"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DocumentDepose } from "@/lib/base";
import { poids } from "@/lib/creneaux";

const LIMITE = 3_000_000;
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

function enBase64(fichier: File): Promise<string> {
  return new Promise((ok, non) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result).split(",")[1] ?? "");
    lecteur.onerror = () => non(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

/** Le dossier du vendeur : il dépose ses pièces une fois, seuls les repreneurs qu'il a autorisés les consultent. */
export function Documents({ jeton, documents }: { jeton: string; documents: DocumentDepose[] }) {
  const routeur = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState("");
  const [erreur, setErreur] = useState("");

  async function deposer(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    setErreur("");
    for (const f of Array.from(fichiers)) {
      if (f.size > LIMITE) {
        setErreur(`« ${f.name} » dépasse 3 Mo. Réduisez-le ou scindez-le.`);
        continue;
      }
      setEtat(`Dépôt de ${f.name}…`);
      const rep = await fetch("/api/suivi/document", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, nom: f.name, type: f.type, contenu: await enBase64(f).catch(() => "") }) }).catch(() => null);
      if (!rep?.ok) setErreur(((await rep?.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? `« ${f.name} » n'a pas pu être déposé.`);
    }
    setEtat("");
    if (champ.current) champ.current.value = "";
    routeur.refresh();
  }

  async function retirer(id: string) {
    setEtat("Retrait…");
    await fetch("/api/suivi/document", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, retirer: id }) }).catch(() => null);
    setEtat("");
    routeur.refresh();
  }

  return (
    <div className="carte">
      <p className="message"><b>Votre dossier.</b> Déposez une fois vos trois derniers bilans, votre bail et vos principaux contrats. Seuls les repreneurs à qui vous avez communiqué votre nom peuvent les télécharger, et vous voyez qui les a ouverts.</p>
      {documents.length > 0 && (
        <div>
          {documents.map((d) => (
            <div key={d.id} className="ligne">
              <span className="quoi">
                <b><a href={`/api/document?d=${jeton}&id=${d.id}`}>{d.nom}</a></b>
                <small>{poids(d.taille)}{d.depose_le ? `, déposé le ${jour(d.depose_le)}` : ""}</small>
                <small>{d.consultations?.length ? `Ouvert par ${d.consultations.map((c) => `${c.nom} le ${jour(c.vu_le)}`).join(", ")}` : "Pas encore consulté"}</small>
              </span>
              <span className="ou"><button type="button" className="lien discret" disabled={etat !== ""} onClick={() => retirer(d.id)}>Retirer</button></span>
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <label className="bouton petit depot">
          {etat || "Déposer des documents"}
          <input ref={champ} className="cache" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.doc,.docx,.csv,.txt" disabled={etat !== ""} onChange={(e) => deposer(e.target.files)} />
        </label>
        <span className="source">PDF, image, Excel ou Word. 3 Mo par fichier, vingt fichiers au plus.</span>
      </div>
      {erreur && <p className="message alerte" role="alert">{erreur}</p>}
    </div>
  );
}
