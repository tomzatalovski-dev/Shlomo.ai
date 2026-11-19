import type { Metadata } from "next";
import { Pied } from "../composants/Pied";

export const metadata: Metadata = { title: "Pour l'expert-comptable d'un cédant — Shlomo.ai" };

/** Ce que l'expert-comptable d'un cédant doit savoir : ce que fait Shlomo, ce qui reste de son ressort, ce que son client paie. */
export default function Page() {
  return (
    <div className="page epure">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul contrat-page">
        <main className="resultat">
          <div>
            <h1>Votre client cherche un repreneur avec Shlomo.</h1>
            <p className="sous">Cette page est écrite pour vous, son expert-comptable. Elle dit ce que nous faisons, ce que nous ne faisons pas, et ce qui reste de votre ressort.</p>
          </div>

          <article className="contrat legal">
            <section>
              <h2>Ce que fait Shlomo</h2>
              <p>À partir du numéro SIREN, Shlomo rédige la fiche de la société avec les données du registre et des comptes publiés, puis cherche les sociétés qui auraient une raison de la racheter : même métier, région, taille, résultats, rachats déjà publiés au bulletin officiel.</p>
              <p>Pour chaque repreneur retenu, Shlomo identifie l'interlocuteur, prépare un premier message qui ne cite ni le nom ni la ville de votre client, puis suit les réponses jusqu'à la rencontre.</p>
            </section>
            <section>
              <h2>Comment la confidentialité est tenue</h2>
              <p>Votre client voit la liste des repreneurs et retire qui il veut avant tout envoi.</p>
              <p>Un repreneur n'apprend le nom de la société qu'après avoir signé un accord de confidentialité, et seulement si votre client donne son feu vert, repreneur par repreneur.</p>
              <p>Chaque message est relu par une personne avant de partir. Les sociétés qui ont demandé au registre à ne pas être démarchées ne sont pas contactées.</p>
            </section>
            <section>
              <h2>Ce qui reste de votre ressort</h2>
              <p>L'évaluation. Shlomo donne un ordre de grandeur tiré des comptes publiés et les prix de ventes de fonds comparables publiés au bulletin officiel. Ce n'est pas une évaluation : les retraitements, la trésorerie, les dettes et la rémunération du dirigeant sont les vôtres.</p>
              <p>La fiscalité de la cession, la préparation des comptes et des pièces demandées par le repreneur, et la relecture des actes avec l'avocat ou le notaire de votre client.</p>
              <p>Shlomo ne décide jamais d'un prix : votre client seul accepte ou refuse une offre.</p>
            </section>
            <section>
              <h2>Ce que paie votre client</h2>
              <p>Rien avant la vente. Si la vente se fait avec un repreneur présenté par Shlomo, la commission est de 5 % du prix, avec un minimum de 5 000 €.</p>
            </section>
            <section>
              <h2>Où nous en sommes</h2>
              <p>Le service est en phase d'essai. Les mandats et accords signés sur ce site n'ont pas encore de valeur juridique : le mandat définitif est en cours de rédaction avec un avocat. Aucun repreneur n'est contacté au nom de votre client tant que ce cadre n'est pas en place.</p>
            </section>
            <section>
              <h2>La personne qui en répond</h2>
              <p><b>Tom Zatalovski</b>, CEO. <a href="/a-propos">Qui sommes-nous</a></p>
            </section>
          </article>
          <Pied />
        </main>
      </div>
    </div>
  );
}
