import { Pied } from "./composants/Pied";
export default function Accueil() {
  return (
    <div className="page">
      <header className="haut">
        <a className="logo" href="/">Shlomo.ai</a>
      </header>

      <main className="hero">
        <h1>
          Vos trois meilleurs repreneurs. <span>Identifiés en quelques minutes.</span>
        </h1>
        <p className="sous">
          Donnez votre site ou votre numéro SIREN. Shlomo comprend votre société et cherche qui a une vraie raison de la racheter, sous vos yeux.
        </p>

        <form className="saisie" action="/dossier" method="get">
          <label className="cache" htmlFor="q">Site internet ou numéro SIREN</label>
          <input id="q" name="q" type="text" placeholder="votresociete.fr ou numéro SIREN" autoComplete="off" required />
          <button className="bouton" type="submit">Trouver mes repreneurs</button>
        </form>
        <p className="aide">L'un des deux suffit. Rien d'autre à remplir.</p>

        <ul className="garanties">
          <li>Gratuit jusqu'à la signature du mandat</li>
          <li>Rien n'est envoyé sans votre accord</li>
          <li>Votre nom reste caché des repreneurs</li>
        </ul>
      </main>

      <section className="suite" aria-label="Ce que Shlomo fait ensuite">
        <b>Ce que Shlomo fait ensuite, sans vous</b>
        <ol className="six">
          <li>Comprend votre société</li>
          <li>Étudie votre marché</li>
          <li>Définit les profils de repreneurs</li>
          <li>Trouve les sociétés repreneuses</li>
          <li>Trouve la bonne personne</li>
          <li>Prépare l'approche</li>
        </ol>
      </section>

      <section className="vendre" aria-label="Pourquoi Shlomo">
        <div className="bloc">
          <h2>Les autres attendent qu'un repreneur s'inscrive. Shlomo va le chercher.</h2>
          <p>Une annonce en ligne ne touche que ceux qui cherchent déjà. Shlomo part de votre numéro SIREN, fouille le registre de toutes les sociétés françaises, retient celles qui ont une raison précise de vous racheter, et prépare le message pour la personne qui décide.</p>
        </div>

        <ul className="preuves">
          <li>
            <b>Il chasse au lieu d'afficher</b>
            <p>Aucune annonce publique. Des sociétés de votre métier ou d'un métier voisin, plus grandes que vous, classées une par une avec la raison de leur intérêt.</p>
          </li>
          <li>
            <b>Vous restez anonyme et vous décidez</b>
            <p>Votre nom n'est donné qu'à un repreneur qui a signé un accord de confidentialité, et seulement si vous dites oui. Le prix annoncé est celui que vous fixez.</p>
          </li>
          <li>
            <b>Tout est vérifiable</b>
            <p>Chaque fait affiche sa source, chaque message est relu avant de partir, et vous voyez qui a ouvert vos documents.</p>
          </li>
        </ul>

        <div className="bloc">
          <h2>Ce que vous faites, ce que Shlomo fait</h2>
          <div className="partage">
            <div>
              <span>Vous</span>
              <ul>
                <li>Donner votre site ou votre SIREN</li>
                <li>Signer le mandat</li>
                <li>Fixer votre prix et déposer vos documents</li>
                <li>Dire oui ou non à chaque repreneur et à chaque offre</li>
              </ul>
            </div>
            <div>
              <span>Shlomo</span>
              <ul>
                <li>Comprendre votre société et l'estimer</li>
                <li>Trouver et classer les repreneurs</li>
                <li>Identifier la personne qui décide et rédiger l'approche</li>
                <li>Mener les échanges jusqu'à l'offre</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bloc prix">
          <h2>Rien à payer avant la vente.</h2>
          <p>La fiche, l'estimation et la liste de vos repreneurs sont gratuites. Si la vente se fait avec un repreneur présenté par Shlomo, la commission est de 5 % du prix, avec un minimum de 5 000 €. Sinon, vous ne devez rien.</p>
          <a className="bouton" href="#q">Trouver mes repreneurs</a>
        </div>
      </section>

      <p className="pied">Shlomo est une intelligence artificielle. Ses estimations sont indicatives et ne remplacent pas un expert-comptable.</p>
      <Pied />
    </div>
  );
}
