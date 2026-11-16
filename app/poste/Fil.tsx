"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RepreneurPoste, StatutPresentation } from "@/lib/base";
import { direCreneau, euros } from "@/lib/creneaux";

type Faute = { detail: string; grave: boolean; arretee?: boolean };

const heure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** La conversation avec un repreneur : ce qui est parti, ce qui est revenu, et la réponse que le négociateur propose. */
export default function Fil({ code, dossier, repreneur, etapes, ouvert }: { code: string; dossier: string; repreneur: RepreneurPoste; etapes: [StatutPresentation, string][]; ouvert: boolean }) {
  const routeur = useRouter();
  const proposition = repreneur.echanges.find((e) => e.etat === "propose");
  const [recu, setRecu] = useState("");
  const [brouillon, setBrouillon] = useState(proposition?.texte ?? "");
  const [vu, setVu] = useState(proposition?.id);
  const [occupe, setOccupe] = useState("");
  const [erreur, setErreur] = useState<{ message: string; fautes?: Faute[] } | null>(null);
  const [copie, setCopie] = useState("");

  // Une nouvelle proposition arrive après le rechargement : le brouillon la reprend.
  if (proposition?.id !== vu) {
    setVu(proposition?.id);
    setBrouillon(proposition?.texte ?? "");
  }

  async function agir(action: string, plus: Record<string, unknown> = {}) {
    setOccupe(action);
    setErreur(null);
    try {
      const rep = await fetch("/api/poste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, dossier, siren: repreneur.siren, action, ...plus }) });
      const corps = (await rep.json().catch(() => ({}))) as { erreur?: string; fautes?: Faute[] };
      if (!rep.ok) setErreur({ message: corps.erreur ?? "L'opération a échoué.", fautes: corps.fautes });
      else {
        if (action === "reponse") setRecu("");
        routeur.refresh();
      }
    } catch {
      setErreur({ message: "Connexion interrompue." });
    } finally {
      setOccupe("");
    }
  }

  async function copier(cle: string, texte: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(cle);
      setTimeout(() => setCopie(""), 1800);
    } catch {}
  }

  const fil = repreneur.echanges.filter((e) => e.etat === "recu" || e.etat === "envoye");
  const refuse = repreneur.canal === "refus_demarchage";

  return (
    <details className="pli poste-fil" open={ouvert}>
      <summary>
        <b>{repreneur.rang}. {repreneur.nom}</b>
        {repreneur.decideur ? ` · ${repreneur.decideur}` : ""}
        {proposition ? " · réponse prête à envoyer" : fil.length ? ` · ${fil.length} message${fil.length > 1 ? "s" : ""}` : ""}
      </summary>

      <div className="poste-outils">
        <label>
          Étape
          <select value={repreneur.statut} disabled={occupe !== ""} onChange={(e) => agir("statut", { statut: e.target.value })}>
            {etapes.map(([s, libelle]) => <option key={s} value={s}>{libelle}</option>)}
          </select>
        </label>
        <a className="lien" href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${repreneur.siren}`} target="_blank" rel="noreferrer">Fiche publique</a>
        {!refuse && <button type="button" className="lien discret" disabled={occupe !== ""} onClick={() => { if (window.confirm(`Ne plus jamais contacter ${repreneur.nom}, sur aucun dossier ?`)) agir("opposition", { oppose: true }); }}>Elle a répondu STOP</button>}
        {repreneur.site && <a className="lien" href={repreneur.site.startsWith("http") ? repreneur.site : `https://${repreneur.site}`} target="_blank" rel="noreferrer nofollow">Site</a>}
      </div>

      {!refuse && (
        <p className="source">
          {repreneur.accord
            ? `Accord de confidentialité signé par ${repreneur.accord.signataire}${repreneur.accord.qualite ? `, ${repreneur.accord.qualite}` : ""}, le ${heure(repreneur.accord.signe_le)}. ${repreneur.revelation === "autorisee" ? "Le vendeur a donné son feu vert : le nom s'affiche sur la page de l'accord." : repreneur.revelation === "refusee" ? "Le vendeur a refusé que son nom soit communiqué." : "Le vendeur doit encore donner son feu vert dans son suivi."} `
            : "Accord de confidentialité non signé. "}
          <button type="button" className="lien" onClick={() => copier("accord", `${window.location.origin}/accord?a=${repreneur.jeton_accord}`)}>{copie === "accord" ? "Lien copié" : "Copier le lien de l'accord"}</button>
        </p>
      )}

      {(repreneur.rendez_vous || (repreneur.offres?.length ?? 0) > 0) && (
        <p className="source">
          {repreneur.rendez_vous ? `Rendez-vous avec le cédant : ${direCreneau(repreneur.rendez_vous)}. ` : ""}
          {repreneur.offres?.map((o) => `Offre de ${euros(o.prix)} (${o.reponse === "acceptee" ? "acceptée" : o.reponse === "refusee" ? "refusée" : o.reponse === "a_ameliorer" ? "le vendeur attend mieux" : "en attente du vendeur"})`).join(" · ")}
        </p>
      )}

      {refuse && (
        <p className="source">
          Cette société ne doit recevoir aucun message : elle s'y est opposée, auprès du registre ou auprès de nous.{" "}
          <button type="button" className="lien discret" disabled={occupe !== ""} onClick={() => agir("opposition", { oppose: false })}>Lever notre opposition</button>
        </p>
      )}

      {!refuse && repreneur.message && (
        <div className="bulle nous">
          <small>Premier message{repreneur.statut === "identifie" ? " · pas encore envoyé" : ""}</small>
          <p>{repreneur.message}</p>
          <div className="actions">
            <button type="button" className="lien" onClick={() => copier("premier", repreneur.message!)}>{copie === "premier" ? "Copié" : "Copier"}</button>
            {repreneur.statut === "identifie" && <button type="button" className="lien" disabled={occupe !== ""} onClick={() => agir("statut", { statut: "contacte" })}>Je l'ai envoyé</button>}
          </div>
        </div>
      )}
      {!refuse && !repreneur.message && <p className="source">Le premier message n'est pas encore préparé : lancez l'atelier depuis le suivi du dossier.</p>}

      {fil.map((e) => (
        <div key={e.id} className={e.de === "shlomo" ? "bulle nous" : "bulle lui"}>
          <small>{e.de === "shlomo" ? `Shlomo${e.situation ? ` · ${e.situation}` : ""}` : repreneur.nom} · {heure(e.cree_le)}</small>
          <p>{e.texte}</p>
        </div>
      ))}

      {proposition && (
        <div className="bulle nous proposition">
          <small>Réponse proposée par le négociateur · manuel v{proposition.version}{proposition.repli ? " · réponse d'attente : reprenez la main" : ""}</small>
          {proposition.situation && <p className="lecture"><b>{proposition.situation}.</b> {proposition.lecture}</p>}
          <textarea value={brouillon} onChange={(e) => setBrouillon(e.target.value)} rows={Math.min(16, Math.max(6, brouillon.split("\n").length + 2))} aria-label="Réponse proposée" />
          {proposition.fautes?.map((f, i) => <small key={i} className="faute">{f.arretee ? "Première version arrêtée par le garde-fou : " : "À soigner : "}{f.detail}</small>)}
          <div className="actions">
            <button type="button" className="lien" onClick={() => copier("reponse", brouillon)}>{copie === "reponse" ? "Copié" : "Copier"}</button>
            <button type="button" className="lien" disabled={occupe !== ""} onClick={() => agir("envoye", { echange: proposition.id, texte: brouillon })}>{occupe === "envoye" ? "Vérification…" : "Je l'ai envoyée"}</button>
            <button type="button" className="lien discret" disabled={occupe !== ""} onClick={() => agir("ecarter", { echange: proposition.id })}>Écarter</button>
          </div>
        </div>
      )}

      {!refuse && (
        <div className="champ poste-saisie">
          <label htmlFor={`recu-${repreneur.siren}`}>Réponse reçue de {repreneur.nom}</label>
          <textarea id={`recu-${repreneur.siren}`} value={recu} onChange={(e) => setRecu(e.target.value)} rows={3} placeholder="Collez ici son message, tel qu'il l'a écrit." />
          <div className="actions">
            <button type="button" className="bouton petit" disabled={occupe !== "" || recu.trim().length < 2} onClick={() => agir("reponse", { texte: recu })}>{occupe === "reponse" ? "Le négociateur rédige…" : "Préparer la réponse"}</button>
          </div>
        </div>
      )}

      {erreur && (
        <p className="faute-poste">
          {erreur.message}
          {erreur.fautes?.map((f, i) => <span key={i}> {f.detail}</span>)}
        </p>
      )}
    </details>
  );
}
