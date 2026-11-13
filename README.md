# Shlomo.ai

Site web qui aide un dirigeant français à trouver un repreneur pour sa société. Il saisit son site ou son numéro SIREN, et l'agent travaille sous ses yeux.

Cette version contient la **première tranche** : la page d'accueil et l'étape 1 (comprendre la société), avec les vraies données du registre.

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

## Ce qui n'est pas encore là

- Aucune base de données : la fiche validée n'est pas enregistrée.
- Les étapes 2 à 6 (marché, profils, sociétés repreneuses, décideurs, approche).
- Les comptes, le mandat, le paiement, tout envoi de message.
- La limite d'appels est gardée en mémoire : elle ne tient pas sur plusieurs serveurs.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `app/page.tsx` | Page d'accueil |
| `app/dossier/page.tsx` | Écran de l'agent : journal à gauche, fiche à droite |
| `app/api/analyse/route.ts` | L'analyse, envoyée au navigateur ligne par ligne |
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
