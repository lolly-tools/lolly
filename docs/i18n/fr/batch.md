# Batch et Multi-edit

Deux besoins apparaissent quand tu crées souvent le même type de fichier. Parfois il te faut beaucoup de versions d'un même design : une carte en une dizaine de langues, ou chaque taille d'une bannière. Parfois tu as plusieurs designs enregistrés différents et tu veux qu'une seule modification les atteigne tous, comme une nouvelle date ou un nouveau titre.

**Batch** s'occupe du premier besoin et **Multi-edit** du second. Les deux tournent sur ton appareil et exportent par le même chemin de rendu que les outils eux-mêmes.

::: cols
## Batch

- Un modèle, beaucoup de lignes. Chaque ligne est un jeu d'entrées et produit un fichier.
- Remplis les lignes en tapant, en collant depuis un tableur ou en important un CSV.
- Pas de limite de lignes ; 50 s'affichent par page.
- S'ouvre depuis **Batch** dans l'en-tête de Projects (`#/batch`).

## Multi-edit

- De deux à huit designs enregistrés différents, côte à côte sous forme de cartes en direct.
- Une seule barre latérale modifie les entrées qu'ils partagent, puis celles de chaque carte.
- Chaque design est réenregistré là d'où il vient.
- S'ouvre depuis **Edit together** dans la barre de sélection de Projects.
:::

## Crée beaucoup de versions d'un design

Ouvre **Projects** et appuie sur **Batch** dans son en-tête. La grille démarre avec une ligne : choisis-y un modèle, puis duplique la ligne ou colle des données depuis ton tableur. Ouvert depuis l'intérieur d'un dossier, Batch te ramène à ce dossier.

![Batch sur une grille neuve : le nom de fichier et les outils de ligne en haut, et la liste de modèles de la première ligne ouverte sur les outils que tu peux choisir](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Remplis les lignes.** Tape dans une cellule ou colle un bloc directement depuis Excel, Google Sheets ou un autre tableur. **Import CSV** ajoute des lignes ou remplace le lot. Quand tu colles dans une cellule qui contient des réglages d'export, Lolly demande quelle entrée chaque colonne collée remplit. **Export CSV** réécrit la grille. Ouvre **Columns** sous la grille pour afficher plus d'entrées, ou la largeur, la hauteur, l'unité et le DPI par ligne.

**Règle la sortie.** La barre d'outils définit le nom de fichier du zip, le **Default format**, les unités et le DPI pour chaque ligne. Le menu de format est la liste groupée du panneau d'export, qui montre les formats que le catalogue propose et que ton navigateur prend en charge. Une ligne qui a son propre format, sa propre taille ou son propre nom de fichier garde son propre réglage.

**Rendu.** **Render all** exporte chaque ligne dans un seul `.zip`. Sélectionne d'abord des lignes et **Render selected**, **Export selected CSV** et **Print selected rows** n'agissent que sur celles-là ; efface la sélection pour travailler de nouveau sur tout le lot. **Print sheet** dispose les lignes sur une feuille imprimable. **Batch activity** rend compte de chaque import et rendu, et se replie pour laisser plus de place au tableau.

**Garde le lot.** **Sessions** enregistre toute la grille comme session de lot nommée, qui se rouvre plus tard depuis Projects. Sessions enregistre toujours chaque ligne, quelle que soit la sélection. **Folders…** dans le même menu ouvre tout un dossier de Projects sous forme de lignes, une par session enregistrée, avec chaque nom de fichier portant le chemin de son dossier.

::: details Sélectionner des lignes et des cellules
Sélectionne des lignes avec leurs cases à cocher, ou Maj-clique sur une case pour une plage. La case de l'en-tête sélectionne la page courante, et **Select all *N* rows** prend aussi les lignes des autres pages. Les sélections se maintiennent quand tu changes de page. **Edit input**, **Duplicate** et **Remove** agissent sur les lignes sélectionnées, et **Undo remove** rétablit les dernières lignes supprimées. Depuis une cellule au focus, Maj+Espace sélectionne cette ligne et Échap efface la sélection.

Fais glisser sur des cellules, Maj-clique sur une cellule ou utilise Maj+flèches pour sélectionner un rectangle. **Copy cells**, ou Ctrl+C / Commande+C, copie les valeurs pour un tableur. Ctrl+A / Commande+A depuis une cellule au focus sélectionne chaque colonne visible de chaque page ; depuis la case d'une ligne, le même raccourci sélectionne chaque ligne. Sélectionner des cellules laisse cochées les lignes cochées. Double-clique sur une cellule ou appuie sur Entrée pour modifier son texte. Colle un rectangle depuis le presse-papiers, ou colle une seule valeur pour remplir chaque cellule sélectionnée ; les cellules vides et le texte multiligne gardent leur position.
:::

### Colourways et thèmes par ligne

Chaque ligne garde ses propres choix de thème : clair ou sombre, et un colourway quand le design system en a. Une ligne ouverte depuis Projects, un dossier ou un lot enregistré se rend avec les choix dans lesquels sa session a été enregistrée, et son aperçu s'ouvre avec eux. La feuille d'impression, une ligne dupliquée et une ligne remplie les gardent toutes.

Un CSV porte les choix dans une colonne `_themes` après les colonnes de taille, avec le même JSON que le paramètre de lien `_themes`, par exemple `{"":"dark","colourway":"beach"}`. Une cellule vide, ou `{}`, signifie les valeurs par défaut du design system. La colonne n'est écrite que si certaines lignes ont des choix, donc un lot sans choix exporte le même CSV qu'avant. À l'import, une cellule qui ne contient pas des choix de thème valides est listée comme problème et sa ligne se rend avec les valeurs par défaut. La grille n'a pas encore de contrôle pour modifier les choix d'une ligne ; définis-les donc dans le CSV ou dans la session enregistrée.

### Batch, ou Render folder

Batch produit de nombreuses variantes d'un seul modèle. Pour refaire le rendu de sessions que tu as déjà enregistrées, sélectionne-les dans Projects et utilise **Render selection**, ou **Render folder** pour un dossier entier ; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) couvre les deux.

## Modifier plusieurs designs enregistrés ensemble

Coche de deux à huit sessions enregistrées dans **Projects** et choisis **Edit together** dans la barre de sélection. Elles s'ouvrent côte à côte sous forme de cartes en direct à `#/multi?s=<slot>,<slot>…`. Chaque carte est un vrai rendu de sa session, donc ce que tu vois est ce qui s'exportera.

Une seule barre latérale les pilote toutes :

- <!--i:sliders--> **Shared** vient en premier : chaque entrée que deux sessions ou plus déclarent de la même façon (même identifiant, même type, mêmes contraintes, la règle que la grille de Batch utilise pour ses colonnes). Modifie un contrôle partagé une fois et la valeur atteint chaque session qui déclare l'entrée, en direct sur chaque carte. Deux sessions du même outil partagent tout ; deux outils différents ne partagent que les entrées qu'ils ont en commun.
- <!--i:document--> En dessous, **une carte repliée par session** contient toutes les entrées propres de cette session, aussi complètes que la barre latérale de l'outil lui-même, avec un bloc d'export compact : **Format**, **W** / **H**, **Unit**, **DPI** et **Download**. Ce Download enregistre d'abord la session, puis rend le fichier avec les mêmes nom de fichier, format et Content Credentials que ceux qu'il aurait depuis l'outil.
- <!--i:search--> **Filter inputs…** en haut réduit les contrôles de toutes les cartes à la fois, pour que tu atteignes « le titre » dans huit sessions sans défiler.

Clique sur une carte (ou appuie sur Entrée dessus) pour ouvrir la carte de barre latérale de cette session. **Save all** réécrit chaque session dans son propre emplacement. **Download all** enregistre d'abord, puis rend tout l'ensemble dans un seul zip, comme le fait **Render selection** dans Projects, avec le verrouillage par mot de passe facultatif proposé en chemin.

Chaque carte se dessine avec les choix de thème de sa propre session, y compris un outil placé dans le design. Des cartes d'aspects différents se côtoient pendant que l'application autour garde ses propres couleurs, et **Save all**, les téléchargements, **Batch grid** et **Send to Print Sheet** conservent les choix de chaque session.

### Limites

- **Huit au maximum.** Chaque carte monte son propre runtime en direct, et huit est le nombre qui reste réactif. Un lien qui en demande plus, ou une session qui n'existe plus, le dit au lieu de se charger à moitié.
- **Le lien est local.** Il nomme tes propres emplacements enregistrés, donc il rouvre cet ensemble sur cet appareil. Ce n'est pas un lien de partage.
- **Pour plus grand,** choisis **Edit as sheet** dans la même barre de sélection. Elle ouvre toute la sélection sous forme de lignes dans la grille de Batch (`#/batch?s=…`), sans limite de taille ni règle de même outil. Les dossiers restent en dehors des deux : ouvre un dossier dans la grille avec **Sessions → Folders…**, ou fais-en le rendu avec **Render folder** dans Projects.
- **La recherche n'atteint pas Multi-edit.** C'est la seule vue que la barre de recherche ne connaît pas.

## Où aller ensuite

- **[Export a file](/info/exporting.html)** : les formats, tailles et réglages d'impression que chaque ligne peut utiliser.
- **[Templates](/info/templates.html)** : des points de départ qui font une bonne première ligne.
- **[Find and recover your work](/info/find-your-work.html)** : Projects, les dossiers et le rendu de ce que tu as enregistré.
