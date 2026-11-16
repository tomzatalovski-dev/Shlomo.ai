import type { Metadata } from "next";
import { PageLegale } from "../composants/Pied";

export const metadata: Metadata = { title: "Mentions légales — Shlomo.ai" };

export default function Page() {
  return (
    <PageLegale titre="Mentions légales." chapeau="Qui édite ce site, qui l'héberge, et comment nous joindre.">
      <section>
        <h2>Éditeur</h2>
        <p>Le site shlomo-ai.vercel.app est édité par [dénomination sociale], [forme juridique] au capital de [montant] euros, dont le siège est situé [adresse du siège].</p>
        <p>Immatriculation : [numéro d'immatriculation et registre]. Numéro de TVA : [numéro].</p>
        <p>Courriel : [adresse de contact]. Téléphone : [numéro].</p>
        <p>Directeur de la publication : [nom et prénom].</p>
      </section>
      <section>
        <h2>Activité réglementée</h2>
        <p>[À compléter selon le statut retenu : numéro de la carte professionnelle, autorité qui l'a délivrée, garantie financière et assurance de responsabilité civile professionnelle. Shlomo ne reçoit ni ne détient aucun fonds pour le compte de ses clients.]</p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>Le site est hébergé par Vercel Inc., [adresse et téléphone de l'hébergeur à reporter], États-Unis.</p>
        <p>Les données des dossiers sont conservées par Supabase, dans un centre de données situé à Paris.</p>
      </section>
      <section>
        <h2>Intelligence artificielle</h2>
        <p>Les fiches, les messages et les réponses proposés sur ce site sont rédigés avec l'aide d'un système d'intelligence artificielle, puis relus par une personne avant tout envoi. Les estimations de valeur sont des ordres de grandeur tirés des comptes publiés ; elles ne remplacent pas l'avis d'un expert-comptable.</p>
      </section>
      <section>
        <h2>Sources des informations</h2>
        <p>Les informations sur les sociétés proviennent du registre public des entreprises et du bulletin officiel des annonces civiles et commerciales, ainsi que de pages web dont l'adresse est indiquée à côté de chaque fait. Pour faire corriger une information qui vous concerne, écrivez à [adresse de contact].</p>
      </section>
    </PageLegale>
  );
}
