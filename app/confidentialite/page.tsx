import type { Metadata } from "next";
import { PageLegale } from "../composants/Pied";

export const metadata: Metadata = { title: "Données personnelles — Shlomo.ai" };

export default function Page() {
  return (
    <PageLegale titre="Vos données personnelles." chapeau="Quelles données nous traitons, pourquoi, combien de temps, et comment exercer vos droits.">
      <section>
        <h2>Responsable du traitement</h2>
        <p>[Dénomination sociale], [adresse du siège]. Pour toute question : [adresse de contact].</p>
      </section>
      <section>
        <h2>Si vous vendez votre société</h2>
        <p>Nous traitons votre nom, votre fonction, vos coordonnées, les documents que vous déposez, le prix que vous fixez et vos disponibilités. Ces données servent à exécuter le mandat que vous nous confiez. Votre nom n'est communiqué à un repreneur qu'après la signature d'un accord de confidentialité et votre accord exprès.</p>
      </section>
      <section>
        <h2>Si nous vous avons écrit pour vous proposer un rachat</h2>
        <p>Nous avons trouvé le nom de votre société, votre nom et votre fonction dans le registre public des entreprises. Votre adresse professionnelle a pu nous être fournie par [prestataire de coordonnées]. Nous vous écrivons parce que votre société exerce le même métier ou un métier voisin de celui d'une société à céder : c'est notre intérêt légitime à vous contacter.</p>
        <p>Vous pouvez vous y opposer à tout moment en répondant STOP à l'un de nos messages ou en écrivant à [adresse de contact]. Votre société est alors inscrite sur notre liste d'opposition et ne reçoit plus aucun message, pour aucun dossier.</p>
        <p>Vos coordonnées ne sont jamais montrées au vendeur.</p>
      </section>
      <section>
        <h2>Durées de conservation</h2>
        <p>Les coordonnées et les messages d'un repreneur resté sans réponse ou sans suite sont effacés au bout de [180 jours]. Les mandats, accords de confidentialité, offres et le journal des actes sont conservés [durée à fixer avec notre avocat] à titre de preuve. La liste d'opposition est conservée tant qu'elle est nécessaire pour respecter votre refus.</p>
      </section>
      <section>
        <h2>Qui reçoit vos données</h2>
        <p>Nos prestataires techniques, pour le seul fonctionnement du service : Supabase (base de données, Paris), Vercel (hébergement du site, États-Unis), Anthropic (système d'intelligence artificielle, États-Unis) et [prestataire de coordonnées]. Les transferts vers les États-Unis sont encadrés par [mécanisme à préciser].</p>
        <p>L'adresse de connexion des visiteurs n'est pas conservée en clair : seule une empreinte sert à limiter les abus.</p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation de leur traitement, et vous opposer à leur utilisation, en écrivant à [adresse de contact]. Nous répondons dans un délai d'un mois. Vous pouvez aussi adresser une réclamation à la CNIL, sur cnil.fr.</p>
      </section>
      <section>
        <h2>Traceurs</h2>
        <p>Ce site ne dépose aucun traceur publicitaire ni de mesure d'audience.</p>
      </section>
    </PageLegale>
  );
}
