# Comment fonctionne Lolly

Un outil Lolly contient les règles d'un type de fichier : la mise en page, la typographie, les couleurs et les parties que les autres peuvent modifier. Toi, un collègue, un script ou un agent IA remplissez les champs, et chaque fichier sort juste. Cette page montre qui fait quoi, et les quatre chemins qui mènent d'un outil à un fichier terminé.

## Un outil, tes règles, beaucoup de fichiers

Les règles de marque vivent dans l'outil, pas dans chaque fichier qu'il produit. Mets l'outil au point une fois et chaque sortie hérite de la même typographie, des mêmes couleurs et des mêmes espacements, qu'il s'agisse d'une seule carte ou d'un tableur de lignes en une dizaine de langues.

![Un outil de logotype avec un seul champ rempli : la typographie, la couleur et les espacements ont été fixés quand l'outil a été créé](/info/shots/aud-rules-in-the-tool.svg)

La personne qui fait le centième fichier ne saisit que les mots. La manière de vérifier le travail, et qui le vérifie, reste ta décision. Lolly rend plus petit ce qui mérite d'être vérifié et accélère la création du fichier suivant.

## Qui touche à un outil

Suis une carte de campagne à travers une organisation et trois paires de mains apparaissent. Chacune s'appuie sur la précédente.

![Un designer fixe les règles une fois dans un outil ; un développeur le lance depuis un script et n'importe qui peut remplir ses champs ; les deux produisent des fichiers terminés](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un designer fixe les règles.** Il compose la carte dans Design avec la typographie et les couleurs de la marque, puis choisit quels champs restent ouverts. Il le fait une seule fois, donc plus personne ne localise la carte à la main.
- <!--i:code--> **Un développeur fait passer l'outil à l'échelle.** Le même outil tourne dans un script nocturne via la ligne de commande, si bien qu'un nouveau graphique ou une nouvelle version linguistique arrive sans que personne rouvre le design.
- <!--i:people--> **N'importe qui le remplit.** Un commercial dans un avion, sans réseau et sans formation en design, ouvre l'outil et crée la carte pour la réunion de demain.
:::

Le nouveau graphique de l'étape du développeur est un rendu comme celui-ci, produit à partir d'une chaîne de données et de quelques réglages, sans que personne ouvre un fichier de design :

![Un graphique en aires empilées titré, ses trois séries en bandes dans une palette froide, avec axes, légende et titre placés par le modèle plutôt qu'à la main](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

La minute facile du commercial n'est possible que grâce au soin du designer et au script du développeur. Chaque rôle travaille avec le même outil, au lieu d'avoir un produit distinct.

## Quatre chemins vers un fichier

Chaque chemin fait tourner le même moteur sur le même outil, donc le fichier qu'un script produit correspond à celui que tu prévisualises dans l'application.

![Les paramètres d'URL et les arguments de ligne de commande deviennent le même modèle d'entrées, traité par un runtime et un pont d'export communs](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Dans l'application, un à la fois.** Ouvre un outil, remplis les champs et appuie sur **Export**. [Make your first file](/info/make-something.html) t'en guide un.
- <!--i:layers--> **Dans l'application, plusieurs à la fois.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) prend un tableau collé ou importé et produit un fichier terminé par ligne.
- <!--i:cpu--> **Depuis un script ou un agent IA.** La [CLI](/info/cli.html) exécute un outil sans interface, et le [serveur MCP](/info/mcp.html) permet à un agent de découvrir et de lancer des outils. Un lien vers un outil porte aussi ses entrées, donc un lien est une requête complète.
- <!--i:server--> **Via le serveur de ton organisation.** [Lolly Work](/info/organisation.html) rend sur le serveur selon la connexion et la politique d'outils de ton organisation, garde des tâches qu'il peut reprendre et conserve la sortie pour téléchargement ou livraison approuvée.

Le chemin qu'une tâche peut emprunter dépend des formats de l'outil et de ce que l'hôte sait faire : certains formats ont besoin d'un navigateur, donc la ligne de commande les confie à un niveau navigateur. [Render with the CLI](/info/cli-rendering.html) liste quels formats se rendent où.

## Ce qui tourne où

Créer, modifier et exporter se font sur ton appareil, sans compte. Une fonction qui a besoin d'un serveur, comme Sync ou l'envoi d'un fichier vers un service connecté, ne se connecte que lorsque tu l'utilises. Avec Lolly Work, les projets partagés, l'édition d'équipe en direct, les approbations et les tâches serveur utilisent le serveur de ton organisation. [What runs where](/info/compare.html#what-runs-where) met les deux parties côte à côte.

## À lire ensuite

- [Make your first file](/info/make-something.html), pour essayer tout de suite.
- [Start](/info/quickstart.html), pour mettre ton propre design system.
- [Automate](/info/builders.html), pour la ligne de commande, les liens et les agents.
- [Lolly architecture](/info/overview.html), pour les contributeurs : le moteur, les shells et les règles qui les tiennent ensemble.
