import type { Metadata } from "next";
import { PageLegale } from "../composants/Pied";

export const metadata: Metadata = { title: "Conditions d'utilisation — Shlomo.ai" };

export default function Page() {
  return (
    <PageLegale titre="Conditions d'utilisation." chapeau="Ce que Shlomo fait pour vous, ce qu'il ne fait pas, et ce que vous lui devez.">
      <section>
        <h2>Le service</h2>
        <p>Shlomo recherche, pour le compte d'un dirigeant qui souhaite céder sa société, des repreneurs susceptibles de la racheter, prépare les messages d'approche et accompagne les échanges jusqu'au dépôt d'une offre. Shlomo agit comme intermédiaire : il n'a pas le pouvoir d'engager le vendeur, qui accepte ou refuse lui-même chaque offre.</p>
      </section>
      <section>
        <h2>Ce qui est gratuit, ce qui est payant</h2>
        <p>La fiche de la société, l'estimation et la liste des repreneurs sont gratuites. Aucune somme n'est due avant la vente. Si la vente se conclut avec un repreneur présenté par Shlomo, une commission de 5 % du prix de vente est due, avec un minimum de 5 000 euros, dans les conditions du mandat signé. [Modalités et moment de l'exigibilité à préciser par notre avocat.]</p>
      </section>
      <section>
        <h2>Le mandat</h2>
        <p>La recherche active ne commence qu'après la signature d'un mandat écrit, numéroté et inscrit au registre des mandats. Il est conclu pour douze mois. La commission reste due pendant 24 mois après chaque présentation enregistrée. [Clause à valider par notre avocat.]</p>
      </section>
      <section>
        <h2>L'estimation</h2>
        <p>La fourchette affichée est un ordre de grandeur calculé sur les comptes publiés. Ce n'est ni une évaluation, ni un prix garanti. Le prix annoncé aux repreneurs est celui que le vendeur fixe lui-même.</p>
      </section>
      <section>
        <h2>L'intelligence artificielle</h2>
        <p>Les textes proposés par Shlomo sont rédigés par un système d'intelligence artificielle et relus par une personne avant tout envoi. Les messages adressés aux repreneurs l'indiquent.</p>
      </section>
      <section>
        <h2>Vos engagements</h2>
        <p>Vous déclarez avoir qualité pour engager la société ou pour céder ses titres. Vous répondez de l'exactitude des documents et des chiffres que vous fournissez. Si vous êtes repreneur, vous respectez l'accord de confidentialité que vous signez avant de connaître le nom de la société.</p>
      </section>
      <section>
        <h2>Fin du service</h2>
        <p>Vous pouvez demander le retrait de votre dossier en écrivant à [adresse de contact]. Les présentations déjà faites restent couvertes par le mandat. [Droit applicable et tribunal compétent à préciser par notre avocat.]</p>
      </section>
    </PageLegale>
  );
}
