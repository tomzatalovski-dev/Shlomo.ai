import type { Metadata } from "next";
import { Pied } from "../composants/Pied";

export const metadata: Metadata = { title: "Qui sommes-nous — Shlomo.ai" };

export default function Page() {
  return (
    <div className="page epure">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul contrat-page">
        <main className="resultat">
          <div>
            <h1>Qui sommes-nous.</h1>
            <p className="sous">Shlomo est une intelligence artificielle. Derrière elle, il y a des personnes qui relisent son travail et qui répondent de ce qu'elle fait.</p>
          </div>

          <article className="contrat legal">
            <section>
              <h2>La personne qui en répond</h2>
              <p><b>Tom Zatalovski</b>, CEO.</p>
            </section>
            <section>
              <h2>Ce que fait Shlomo</h2>
              <p>À partir du site ou du numéro SIREN d'une société française, Shlomo rédige sa fiche, cherche les sociétés qui auraient une raison de la racheter, identifie la personne qui décide chez chacune, et prépare l'approche. Le dirigeant garde quatre décisions : signer le mandat, fixer son prix, autoriser qu'on donne son nom, accepter ou refuser une offre.</p>
            </section>
            <section>
              <h2>Ce à quoi nous nous tenons</h2>
              <p>Rien ne part vers un repreneur sans votre accord, et chaque message est relu par une personne avant d'être envoyé.</p>
              <p>Votre nom n'est donné qu'à un repreneur qui a signé un accord de confidentialité, et seulement si vous dites oui.</p>
              <p>Chaque fait affiché renvoie à sa source et a été relu sur la page d'où il vient. Quand une information n'est pas publique, nous l'écrivons plutôt que de l'estimer.</p>
              <p>Vous ne payez rien tant que la vente n'est pas faite.</p>
            </section>
            <section>
              <h2>Où nous en sommes</h2>
              <p>Le service est en phase d'essai. Les mandats et accords signés sur ce site n'ont pas encore de valeur juridique : le mandat définitif est en cours de rédaction avec un avocat.</p>
            </section>
          </article>
          <Pied />
        </main>
      </div>
    </div>
  );
}
