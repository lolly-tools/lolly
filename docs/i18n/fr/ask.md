# Ask Lolly

Ask Lolly répond à une question avec la section correspondante de ces guides, citée mot pour mot, avec sa page en référence et un lien **Open in docs** vers cette section. Rien n'est généré : la réponse est trouvée et citée sur ton appareil.

Sous la section citée se trouvent les endroits de l'application qui correspondent à la question : un outil, un utilitaire, un projet enregistré, une ressource du catalogue, un réglage ou une page de l'application. Chaque ligne sert uniquement à naviguer. Rien dans une réponse ne change un réglage, n'ouvre un fichier ou n'agit à ta place, la même règle que [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Poser une question

Tape dans le champ de question en bas de la vue et appuie sur Entrée. Toute saisie de moins de deux caractères est ignorée. Les réponses s'empilent au-dessus du champ, la plus récente en dernier.

![Ask Lolly, ouvert et vide : le champ de question en bas de la vue, avec la note indiquant que les réponses viennent de la documentation](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Chaque question est indépendante
Les questions précédentes ne transmettent aucun contexte, donc « et pour le PDF ? » après une question sur l'export est lu comme une question sur le PDF seul. Pose la question complète à chaque fois.
:::

Le premier mot de ta question détermine ce qui vient en tête de la réponse :

| Tu commences par | Ce qui vient en tête |
|---|---|
| *où*, *trouve*, *ouvre*, *montre*, *va à*, *va*, *emmène*, *saute*, *navigue*, *passe* | les endroits correspondants dans l'application |
| *fais*, *crée*, *génère*, *construis*, *conçois*, *convertis*, *redimensionne*, *compresse*, *supprime*, *retire*, *exporte*, *rends*, *ajoute* | les outils correspondants |
| tout le reste - y compris *comment faire* et *qu'est-ce que* | la section de documentation, le choix par défaut |

Les deux parties sont toujours récupérées, donc une question mal interprétée ne change que l'ordre de la réponse.

La recherche de correspondances écarte les mots courants des questions (*comment*, *faire*, *je*, *le*, *mon*). Elle classe une section selon le nombre de tes autres mots qu'elle couvre, puis selon l'endroit où ils correspondent : un titre compte plus que le corps du texte. La correspondance se fait par sous-chaîne, sans tenir compte de la casse ni des accents, donc une faute de frappe n'est pas corrigée. Quand rien ne correspond, Ask le dit et renvoie à l'index de la documentation.

**Better matching** est facultatif. Après ta première réponse, Ask peut proposer un petit modèle de correspondance, avec sa taille de téléchargement. Le modèle associe une question à un guide qui utilise d'autres mots pour la même chose. Il se télécharge seulement avec ton accord, fonctionne sur cet appareil et change uniquement les sections classées en premier. La réponse reste le texte même de la documentation. Tu peux aussi le télécharger sous le nom **Ask matching model** dans **Settings → Preferences → Available offline** ([Available offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Ce que tu reçois

Une carte de réponse suit un ordre fixe :

1. **La section elle-même**, rendue depuis la source de la documentation : paragraphes, listes, tableaux, code et citations, avec les liens vers l'application et `/info` actifs. Une longue section se termine par **Show more**, qui ouvre la suite sur place. Les images sont retirées, et un lien vers un autre site s'affiche comme du texte simple.
2. **La référence** - *Page › Titre* - et le lien **Open in docs** vers cette section précise.
3. **More in the docs** - jusqu'à quatre autres sections correspondantes, sous forme de liens.
4. **Les lignes de l'application**, sous les mêmes titres de groupe que Search.

Le texte complet vient de la version markdown que chaque page de documentation publie à l'adresse `/info/<slug>.md`. Ces versions sont uniquement en anglais. Dans une autre langue, et pour les quelques pages qui ne sont pas construites à partir de markdown, la réponse affiche plutôt le court extrait de l'index de recherche. La référence et le lien **Open in docs** pointent toujours vers la page dans ta langue.

<!--i:eti-map-pin-->
## Où le trouver

La route est `#/ask`. Elle n'a ni onglet ni tuile dans la grille Utilities. Tu accèdes à la vue depuis la barre de recherche ou par son adresse.

- <!--i:search--> **Depuis la recherche.** Chaque panneau de résultats se termine par une ligne **Ask Lolly : *ta requête***, sous les résultats des autres groupes. La ligne ouvre `#/ask?q=…`, et la vue pose la question une fois à l'arrivée. Les mots arrivent en minuscules sans ponctuation, donc ajuste-les dans le champ de question si nécessaire.
- <!--i:link--> **Depuis un lien.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` ouvre la vue avec cette question déjà posée. Le fragment d'URL ne fournit que la première question. Les questions que tu tapes ensuite reçoivent leur réponse sur place et ne changent jamais l'adresse.

La barre de recherche est masquée dans cette vue, car le champ de question utilise Entrée. La pastille de retour te ramène là d'où tu viens.

Les réponses restent pour cette session : elles sont toujours là si tu pars et reviens, et un rechargement les efface. Rien n'est écrit dans le stockage, donc il n'y a pas d'historique à gérer.

<!--i:eti-download-->
## Hors ligne

Les réponses viennent de deux fichiers statiques publiés par le site de documentation : l'index de recherche par langue et la version markdown de la page. Les deux sont récupérés par leur nom, donc Ask fonctionne sans connexion une fois qu'ils sont en cache. Lire les guides dans l'application les met en cache. **Guides & docs** sous [Available offline](/info/dashboard.html#available-offline) récupère tout le site, captures d'écran comprises, en un seul téléchargement.

Sans ces fichiers, la partie documentation d'une réponse n'apparaît pas, et aucune erreur ne s'affiche. Les lignes de l'application apparaissent toujours, car elles correspondent à des données déjà présentes sur l'appareil.

<!--i:eti-lock-->
## Confidentialité

Ta question ne quitte jamais l'appareil. La recherche de correspondances s'exécute localement sur des fichiers récupérés par leur nom, donc ce que tu as tapé ne fait partie d'aucune requête. Aucun serveur ne voit ta question, aucun compte ne la détient et aucune trace ne reste après un rechargement. La [Politique de confidentialité](/info/privacy.html) liste tout ce que l'application récupère ou envoie.

---

**À lire aussi :** [Lolly Search](/info/search.html) pour la barre qui transmet les questions. [Utiliser Lolly](/info/using.html) pour le reste de l'application. [Réglages de Lolly](/info/dashboard.html#available-offline) pour commencer par rendre la documentation disponible hors ligne.
