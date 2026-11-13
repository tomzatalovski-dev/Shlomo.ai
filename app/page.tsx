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

      <p className="pied">Shlomo est une intelligence artificielle. Ses estimations sont indicatives et ne remplacent pas un expert-comptable.</p>
    </div>
  );
}
