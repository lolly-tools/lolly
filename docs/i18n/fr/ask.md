# Ask Lolly

Saisis une question et Ask Lolly répond avec la section de ces guides qui la couvre, mot pour mot, avec la page d'origine citée et un lien **Open in docs** directement vers cette section. Rien n'est généré : la réponse est retrouvée, citée et attribuée, sur ton appareil.

Sous la section citée figurent les endroits de l'application qui correspondent à la même question : un outil, un utilitaire, un projet enregistré, une ressource du catalogue, un réglage ou une page de l'application. Chaque ligne ne fait que naviguer. Rien dans une réponse ne change un réglage, n'ouvre un fichier ni n'agit à ta place, la même règle que suit [Search](/info/search.html).

## Poser une question

Saisis dans le champ de question au pied de la vue et appuie sur Entrée. Tout ce qui fait moins de deux caractères est ignoré. Les réponses s'empilent au-dessus du champ, la plus récente en dernier, et tu peux continuer de poser des questions.

![Ask Lolly, ouvert et vide : le champ de question au pied de la vue, avec la note disant que les réponses viennent de la documentation](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Chaque question reçoit sa réponse isolément : les questions précédentes ne transmettent aucun contexte, donc « et le PDF ? » après une question sur l'export est lu comme une question sur le PDF et rien d'autre. Pose la question entière à chaque fois.

Le premier mot de ta question décide de ce qui ouvre la réponse :

| Tu commences par | Ce qui vient en premier |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | les endroits de l'application qui correspondent |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | les outils qui correspondent |
| tout le reste - y compris *how do I* et *what is* | la section de documentation, qui est le choix par défaut |

Les deux moitiés sont toujours retrouvées, donc une question mal interprétée réordonne une réponse au lieu de perdre la moitié de la réponse.

La correspondance écarte les mots de question courants (*how*, *do*, *I*, *the*, *my*) et classe une section selon le nombre de tes mots restants qu'elle couvre, puis selon l'endroit où ils correspondent : un titre compte plus que le corps du texte. La correspondance se fait par sous-chaîne, sans tenir compte de la casse ni des accents, donc une faute de frappe n'est pas corrigée. Quand rien ne correspond, Ask le dit et renvoie vers l'index de la documentation au lieu d'inventer une réponse.

**Better matching** est facultatif. Après ta première réponse, Ask peut proposer un petit modèle de correspondance, avec sa taille de téléchargement, qui aide à rapprocher une question d'un guide qui emploie d'autres mots pour la même chose. Il ne se télécharge que si tu acceptes, tourne sur cet appareil et ne change que les sections classées en premier : la réponse reste les mots propres de la documentation. Tu peux aussi le télécharger depuis **Settings → Preferences → Available offline**, où il figure sous le nom **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Ce qui revient

Une carte de réponse est assemblée dans un ordre fixe :

1. **La section elle-même**, rendue à partir de la source de la documentation - paragraphes, listes, tableaux, code et citations, avec les liens vers l'application et vers `/info` actifs. Une longue section est plafonnée par un **Show more** qui l'ouvre sur place. Les images sont retirées, et un lien vers un autre site s'affiche comme du texte simple plutôt que comme une ancre.
2. **La citation** - *Page › Heading* - et le lien **Open in docs** vers cette section exacte.
3. **More in the docs** - jusqu'à quatre autres sections qui correspondaient, sous forme de liens.
4. **Les lignes de l'application**, sous les mêmes titres de groupe que Search.

Le texte complet vient du jumeau en markdown simple que chaque page de documentation publie à `/info/<slug>.md`, et ces jumeaux n'existent qu'en anglais. Dans une autre langue - et sur la poignée de pages qui ne sont pas construites à partir de markdown - la réponse se rabat sur l'extrait court conservé dans l'index de recherche au lieu de la section entière. La citation et le lien **Open in docs** sont là dans les deux cas, et pointent vers la page dans ta propre langue.

## Où elle se trouve

La route est `#/ask`. Elle n'a ni onglet ni tuile dans la grille Utilities ; les accès sont la barre de recherche et l'adresse elle-même.

- <!--i:search--> **Depuis la recherche.** Chaque panneau de résultats porte tout en bas une ligne **Ask Lolly: *your query***, sous les éventuels résultats concrets trouvés par les autres groupes. Elle transmet la question sous la forme `#/ask?q=…`, et la vue pose la question une fois à l'arrivée. Les mots transmis arrivent en minuscules, ponctuation retirée ; affine-les donc dans le champ de question si besoin.
- <!--i:link--> **Depuis un lien.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` ouvre la vue avec cette question déjà posée. Le hash n'est que l'amorce d'entrée : les questions que tu saisis ensuite reçoivent leur réponse sur place et ne réécrivent jamais l'adresse.

La barre de recherche s'efface dans cette vue, puisque le champ de question prend Entrée, et la pastille de retour te ramène d'où tu viens.

Les réponses à l'écran durent le temps de cette session : elles sont encore là si tu navigues ailleurs et reviens, et un rechargement les efface. Rien n'est écrit dans le stockage, donc il n'y a pas d'historique à gérer.

## Hors ligne

Les réponses sont assemblées à partir de deux fichiers statiques que le site de documentation publie déjà : l'index de recherche par langue et le jumeau markdown de la page. Les deux sont récupérés par leur nom, donc Ask continue de fonctionner sans connexion une fois qu'ils sont en cache. Lire les guides dans l'application les met en cache au fur et à mesure, et **Guides & docs** sous [Available offline](/info/dashboard.html#available-offline) prend le site entier, captures d'écran comprises, en un seul téléchargement.

Sans eux, la moitié documentation d'une réponse n'apparaît tout simplement pas, sans erreur. Les lignes de l'application, elles, apparaissent toujours, car elles sont appariées à des données déjà présentes sur l'appareil.

## Confidentialité

Ta question ne quitte jamais l'appareil. La correspondance s'exécute en local sur des fichiers récupérés par leur nom, donc ce que tu as saisi ne fait partie d'aucune requête ; aucun serveur ne le voit, aucun compte n'y est rattaché et aucune trace n'en reste après un rechargement. Voir la [Privacy Policy](/info/privacy.html) pour la liste complète de ce que l'application récupère ou envoie.

---

**Voir aussi :** [Search](/info/search.html) pour la barre qui transmet les questions. [Using Lolly](/info/using.html) pour le reste de l'application. [Settings](/info/dashboard.html#available-offline) pour emporter d'abord la documentation hors ligne.
