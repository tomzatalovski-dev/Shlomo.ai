# Shlomo.ai

Site web qui aide un dirigeant français à trouver un repreneur pour sa société. Il saisit son site ou son numéro SIREN, et l'agent travaille sous ses yeux.

Cette version contient deux tranches : la page d'accueil et l'étape 1 (comprendre la société), puis un premier passage de l'étape 4 (trouver les sociétés repreneuses), le tout avec les données du registre public.

## Lancer le site

Il faut Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 et saisir un SIREN ou un site.

Pour activer la rédaction de la description par IA, copier `.env.example` en `.env.local` et y mettre une clé `ANTHROPIC_API_KEY`. Sans clé, tout le reste fonctionne.

## Ce que fait cette tranche

1. Comprend la saisie : SIREN, SIRET, numéro de TVA français ou adresse de site.
2. Si c'est un site : lit la page d'accueil et les mentions légales, et y cherche le SIREN.
3. Interroge le registre public (API Recherche d'entreprises, sans clé).
4. Affiche la fiche en direct : nom, forme, ville, année de création, effectif, chiffre d'affaires et résultat publiés, dirigeants.
5. Avec une clé d'IA et un site : rédige une description et des points forts, à partir du seul texte du site.
6. Le dirigeant corrige la description et valide.

## La recherche de repreneurs, premier passage

Après validation de la fiche, le site cherche des repreneurs sans aucune IA, donc sans coût par recherche :

1. Trois interrogations du registre : sociétés actives du même code d'activité et d'une tranche d'effectif supérieure, dans le département, dans la région, puis dans toute la France.
2. Sont écartés : le vendeur, les sociétés cessées, les entrepreneurs individuels, et les sociétés qui ont refusé que leurs données servent à la prospection.
3. Chaque candidate reçoit un score et des raisons tirés des seuls faits du registre : proximité, rapport de taille, résultat publié, chiffre d'affaires, ancienneté.
4. Les dix meilleures sont classées. Le navigateur n'en reçoit qu'une version masquée : ni nom, ni SIREN, ni ville.

Limites de ce passage : il ne trouve que des sociétés du même code d'activité. Les métiers voisins, les fournisseurs, les fonds et les repreneurs individuels viendront avec l'étude de marché (étapes 2 et 3). Le registre renvoie 25 sociétés par interrogation.

## Ce qui n'est pas encore là

- Aucune base de données : ni la fiche validée ni la liste des repreneurs ne sont enregistrées.
- Les étapes 2, 3, 5 et 6 (marché, profils, décideurs, approche).
- Les comptes, le mandat, le paiement, tout envoi de message.
- La limite d'appels est gardée en mémoire : elle ne tient pas sur plusieurs serveurs.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `app/page.tsx` | Page d'accueil |
| `app/dossier/page.tsx` | Écran de l'agent : journal à gauche, fiche à droite |
| `app/api/analyse/route.ts` | L'analyse, envoyée au navigateur ligne par ligne |
| `app/repreneurs/page.tsx` | Écran des repreneurs, noms masqués |
| `app/api/repreneurs/route.ts` | La recherche de repreneurs, envoyée ligne par ligne |
| `lib/repreneurs.ts` | Filtrage, notation, classement et masquage des repreneurs |
| `lib/limite.ts` | Limite du nombre de recherches par adresse |
| `lib/saisie.ts` | Compréhension de la saisie |
| `lib/registre.ts` | Lecture du registre. Seul fichier à changer pour une autre source |
| `lib/site.ts` | Lecture d'un site public |
| `lib/ia.ts` | Seul fichier qui appelle un modèle d'IA |
| `tests/` | Tests automatiques : `npm test` |

## Règles tenues par le code

- Aucune donnée inventée : un champ absent du registre s'affiche « Non publié ».
- Le texte d'un site est traité comme une donnée, jamais comme une consigne pour l'IA.
- Le serveur ne lit que des sites publics : adresses locales et privées refusées, redirections revérifiées, robots.txt respecté.
- Aucune clé dans le code : tout passe par les variables d'environnement.

## Limite connue

La vérification qu'un site est public se fait juste avant la lecture. Un attaquant qui contrôle son propre nom de domaine pourrait changer sa réponse entre les deux. À durcir avant une mise en ligne publique, en forçant la connexion vers l'adresse vérifiée.

## Mémoire, mandat et suivi

Depuis cette version, le site garde en mémoire ce qui suit la signature du mandat, dans une base Supabase (projet « Shlomo.ai », région Paris).

- `app/mandat/page.tsx` et `app/api/mandat/route.ts` : la signature. Le serveur refait lui-même la recherche, puis enregistre le mandat et la liste des repreneurs présentés, chacun daté.
- `app/suivi/page.tsx` : la page du vendeur après signature. Compteurs, liste nominative, fil d'actualité, et un bouton pour rayer un repreneur tant qu'il n'a pas été contacté.
- `lib/base.ts` : seul fichier qui parle à la base.

Règles tenues par la base elle-même :

- Aucune table n'est lisible directement. Trois fonctions seulement sont ouvertes, et deux exigent le jeton secret du dossier, qui figure dans l'adresse de la page de suivi.
- Le nom, le SIREN et la date d'une présentation ne peuvent plus être modifiés une fois enregistrés.
- Chaque changement de statut d'un repreneur ajoute une ligne au fil d'actualité du vendeur.

Pour faire avancer un dossier à la main : dans Supabase, table `presentations`, changer la colonne `statut` (`contacte`, `relance`, `a_repondu`, `interesse`, `confidentialite_signee`, `rendez_vous`, `sans_suite`). La page de suivi du vendeur se met à jour au rechargement.

Limites : le mandat est une version de test sans valeur juridique, il n'y a pas encore de comptes, et aucun message n'est envoyé par le site.

## Prospection après le mandat

Après la signature, `/atelier?d=<jeton>` montre trois agents qui préparent les approches : fiche du repreneur au registre, choix du décideur (`lib/approche.ts`), rédaction du message par l'IA, enregistrement en base (`enregistrer_approche`).

- Le message ne cite jamais le vendeur : s'il contient son nom ou sa ville, il est remplacé par un modèle fixe. Sans clé d'IA, le modèle fixe sert aussi.
- Une société qui s'est opposée au démarchage au registre est laissée de côté.
- Rien n'est envoyé par le site. L'équipe relit, envoie, puis change `presentations.statut` dans Supabase ; la page de suivi se met à jour.
- Limite connue : toute personne qui détient le jeton peut enregistrer une approche (une seule fois par repreneur). La relecture avant envoi couvre ce risque.

## Vrai métier, activités voisines et notes

- Quand le site est donné, l'IA propose, avec la fiche, le métier réel et quatre codes d'activité au plus (`lib/ia.ts`). Chaque code est vérifié au registre avant usage ; un code inconnu est écarté (`lib/metiers.ts`).
- La recherche porte sur ces activités : département, région, France pour le métier du vendeur ; région, France pour les voisines. Neuf appels au registre au plus.
- La note (`noter`, `lib/repreneurs.ts`) repose sur cinq critères du registre : lien avec le métier, proximité, taille, comptes publiés (marge, évolution du chiffre d'affaires), ancienneté et nombre d'établissements.
- Sans SIREN sur le site, la société est cherchée au registre par son nom (`lib/identite.ts`). Elle n'est retenue d'office que si le nom est exact et l'adresse présente sur le site ; sinon le vendeur choisit parmi trois fiches au plus, ou saisit son SIREN.

## Veille, écrans d'agents et présentation anonyme

- Veille (`lib/veille.ts`) : pour chaque repreneur, l'IA cherche sur le web son site et des faits publics (rachat, ouverture, investissement). Chaque fait garde l'adresse de sa source. Un homonyme reste possible : la relecture avant envoi est obligatoire.
- Écrans d'agents (`/atelier`) : ils rejouent ce que chaque recherche a réellement fait, c'est-à-dire les requêtes lancées, les pages reçues, les faits retenus. Rien n'est simulé.
- Présentation anonyme (`/fiche?f=<jeton de fiche>`) : activité, région, effectif, ancienneté en tranche, chiffre d'affaires à un chiffre significatif. Ni nom, ni SIREN, ni ville. Le jeton de fiche est distinct du jeton du vendeur.
- Un repreneur intéressé laisse ses coordonnées (`interets`, lisible seulement dans Supabase). Le vendeur voit qu'une demande est arrivée, jamais de qui.

## Mesure, relecture et présentation rédigée

- Mesure (`mesures`, `enregistrer_mesure`) : une ligne par étape, par dossier et par jour, sans donnée personnelle. Le serveur note chaque étape ; seul l'ouverture du mandat est signalée par le navigateur. Lecture sur `/pilotage?c=<code de pilotage>` (le code est dans la table `reglages`).
- Provenance (`verifierProvenance`) : un fait public n'est gardé que si sa source est une page réellement reçue par la recherche.
- Relecture (`redigerEtRelire`) : un second appel à l'IA relit chaque message contre les faits autorisés. Un défaut entraîne une réécriture, puis une seconde relecture ; en cas de nouvel échec, le modèle fixe remplace le message. Une réponse illisible du relecteur ne vaut jamais validation.
- Présentation anonyme (`presenter`) : trois phrases écrites à partir du site du vendeur. Le texte est rejeté s'il contient un mot du nom, la ville ou le nom de domaine. La raison de la cession vient d'une liste fermée.
