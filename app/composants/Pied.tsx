/** Liens vers les pages légales, au pied du site. */
export function Pied() {
  return (
    <nav className="liens-pied" aria-label="Informations légales">
      <a href="/mentions-legales">Mentions légales</a>
      <a href="/confidentialite">Données personnelles</a>
      <a href="/conditions">Conditions d'utilisation</a>
      <a href="/retrouver">Retrouver mon dossier</a>
    </nav>
  );
}

/** Cadre commun aux pages légales. Tant que l'avocat ne les a pas validées, elles s'affichent comme des projets. */
export function PageLegale({ titre, chapeau, children }: { titre: string; chapeau: string; children: React.ReactNode }) {
  return (
    <div className="page">
      <header className="haut"><a className="logo" href="/">Shlomo.ai</a></header>
      <div className="corps seul contrat-page">
        <main className="resultat">
          <div>
            <h1>{titre}</h1>
            <p className="sous">{chapeau}</p>
          </div>
          <p className="message alerte-douce"><b>Projet en attente de validation juridique.</b> Les passages entre crochets seront complétés à la création de la société et après relecture par notre avocat. Le service est en phase d'essai : les mandats et accords signés sur ce site n'ont, à ce stade, pas de valeur juridique.</p>
          <article className="contrat legal">{children}</article>
          <Pied />
        </main>
      </div>
    </div>
  );
}
