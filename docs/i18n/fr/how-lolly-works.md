# Comment fonctionne Lolly

Un outil Lolly contient les règles d'un type de fichier : la mise en page, la typographie, les couleurs et les parties que les autres peuvent modifier. Toi, un collègue, un script ou un agent IA remplissez les champs et chaque fichier respecte ces règles.

<!--i:eti-repeat-->
## Un outil, tes règles, de nombreux fichiers

Les règles de la marque sont dans l'outil. Configure-le une fois et chaque résultat reprend la même typographie, les mêmes couleurs et les mêmes espacements, d'une seule carte aux lignes d'une feuille de calcul dans une douzaine de langues.

![Un outil de logotype avec un seul champ rempli : la typographie, la couleur et l'espacement ont été définis à la création de l'outil](/info/shots/aud-rules-in-the-tool.svg)

La personne qui crée le centième fichier ne fait que saisir les mots. Tu décides comment le travail est vérifié et qui le vérifie. Lolly réduit ce qu'il reste à vérifier et accélère la création du fichier suivant.

<!--i:eti-users-->
## Qui intervient sur un outil

Trois rôles dans une organisation travaillent sur une même carte de campagne.

![Un designer définit les règles une fois dans un outil ; un développeur le lance depuis un script et chacun peut remplir ses champs ; les deux produisent des fichiers finis](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un designer définit les règles.** Il compose la carte dans Lolly Design avec la typographie et les couleurs de la marque, puis choisit les champs qui restent ouverts. Il le fait une fois, pour que plus personne n'ait à adapter manuellement la carte à chaque langue.
- <!--i:code--> **Un développeur fait passer l'outil à l'échelle.** Le même outil s'exécute chaque nuit dans un script en ligne de commande. Un graphique actualisé ou une version dans une nouvelle langue arrive sans que personne ne rouvre le design.
- <!--i:people--> **Chacun le remplit.** Un commercial dans un avion, sans réseau ni formation en design, ouvre l'outil et crée la carte pour la réunion du lendemain.
:::

Le graphique actualisé du développeur est un rendu comme celui-ci, créé à partir d'une chaîne de données et de quelques réglages :

![Un graphique en aires empilées avec un titre, dont les trois séries forment des bandes dans une palette froide, avec les axes, la légende et le titre placés par le modèle plutôt qu'à la main](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Le commercial peut agir en une minute grâce aux règles du designer et au script du développeur. Tous les rôles travaillent avec le même outil.

<!--i:eti-train-->
## Quatre chemins vers un fichier

Chaque chemin exécute le même moteur sur le même outil : le fichier produit par un script correspond donc à celui que tu prévisualises dans l'application.

![Les paramètres d'URL et les arguments de ligne de commande deviennent le même modèle d'entrée, traité par un environnement d'exécution et une passerelle d'export communs](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Dans l'application, un à la fois.** Ouvre un outil, remplis les champs et appuie sur **Export**. [Créer ton premier fichier](/info/make-something.html) te guide pour en faire un.
- <!--i:layers--> **Dans l'application, plusieurs à la fois.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) prend un tableau collé ou importé et produit un fichier fini par ligne.
- <!--i:cpu--> **Depuis un script ou un agent IA.** La [CLI](/info/cli.html) exécute un outil sans interface graphique et le [serveur MCP](/info/mcp.html) permet à un agent de découvrir et d'exécuter des outils. Un lien vers un outil contient aussi ses entrées : un lien est donc une requête complète.
- <!--i:server--> **Via le serveur de ton organisation.** [Lolly Work](/info/organisation.html) effectue le rendu sur le serveur selon la politique de connexion et d'utilisation des outils de ton organisation, conserve les tâches qu'il peut reprendre et garde le résultat pour le téléchargement ou une livraison approuvée.

Le chemin qu'une tâche peut emprunter dépend des formats de l'outil et des capacités de l'hôte. Certains formats nécessitent un navigateur, donc la ligne de commande les confie à une couche d'exécution dans un navigateur. [Effectuer un rendu avec la CLI](/info/cli-rendering.html) indique où chaque format est rendu.

<!--i:eti-monitor-->
## Ce qui s'exécute où

La création, la modification et l'export s'exécutent sur ton appareil, sans compte. Une fonction qui nécessite un serveur, comme Sync ou l'envoi d'un fichier à un service connecté, ne se connecte que lorsque tu l'utilises. Avec Lolly Work, les projets partagés, la modification en direct en équipe, les approbations et les tâches serveur utilisent le serveur de ton organisation. [Ce qui s'exécute où](/info/compare.html#what-runs-where) présente les deux parties côte à côte.

<!--i:eti-graduation-cap-->
## À lire ensuite

- [Créer ton premier fichier](/info/make-something.html), pour essayer maintenant.
- [Démarrer](/info/quickstart.html), pour intégrer ton propre design system.
- [Automatiser](/info/builders.html), pour la ligne de commande, les liens et les agents.
- [Architecture de Lolly](/info/overview.html), pour les contributeurs : le moteur, les interfaces et les règles qui les relient.
