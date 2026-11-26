# Lolly Batch et Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** crée plusieurs versions d'un même design, comme une carte dans une douzaine de langues ou tous les formats d'une bannière. **Lolly Multi-edit** applique une modification, comme une nouvelle date ou un nouveau titre, à plusieurs designs enregistrés différents.

Les deux fonctionnent sur ton appareil et exportent par le même chemin de rendu que les outils.

::: cols
## Batch

- Un modèle, plusieurs lignes. Chaque ligne est un jeu d'entrées et produit un fichier.
- Remplis les lignes en tapant, en collant depuis un tableur ou en important un CSV.
- Aucune limite de lignes ; 50 s'affichent par page.
- S'ouvre depuis **Lolly Batch** dans l'en-tête de Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- De deux à huit designs enregistrés différents, côte à côte sous forme de cartes en direct.
- Une barre latérale modifie les entrées communes, puis celles de chaque carte.
- Chaque design s'enregistre à son emplacement d'origine.
- S'ouvre depuis **Edit together** dans la barre de sélection de Projects.
:::

<!--i:eti-table-->
## Créer plusieurs versions d'un même design

Ouvre la vue **Projects** et appuie sur **Batch** dans son en-tête. La grille commence avec une ligne. Choisis un modèle dans cette ligne, puis duplique-la ou colle des données depuis un tableur. Ouvert depuis un dossier, Batch te ramène à ce dossier.

![Batch sur une nouvelle grille : le nom du fichier et les outils de ligne en haut, et la liste des modèles de la première ligne ouverte sur les outils disponibles](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Remplir les lignes.** Tape dans une cellule ou colle un bloc depuis Excel, Google Sheets ou un autre tableur. **Import CSV** ajoute des lignes ou remplace le lot. Quand tu colles dans une cellule contenant des réglages d'export, Lolly demande quelle entrée chaque colonne collée remplit. **Export CSV** exporte la grille. Ouvre **Columns** sous la grille pour afficher plus d'entrées, ou la largeur, la hauteur, l'unité et le DPI de chaque ligne. Le popover **Fill** d'une colonne de nombres, de texte ou de choix comporte aussi une section **Design token** qui lie un token à toutes les lignes de la colonne ([Lier plusieurs documents à la fois](/info/token-workflows.html#link-many-documents-at-once)).

**Régler la sortie.** La barre d'outils définit le nom du fichier zip, le **Default format**, les unités et le DPI pour toutes les lignes. Le menu des formats reprend la liste groupée du panneau d'export : les formats proposés par le catalogue et pris en charge par ton navigateur. Une ligne avec son propre format, sa propre taille ou son propre nom de fichier garde son réglage.

**Rendu.** **Render all** exporte toutes les lignes dans un seul `.zip`. Quand des lignes sont sélectionnées, **Render selected**, **Export selected CSV** et **Print selected rows** n'agissent que sur elles. Efface la sélection pour retravailler sur tout le lot. **Print sheet** dispose les lignes sur une feuille imprimable. **Batch activity** rapporte chaque import et chaque rendu, et peut se replier.

**Conserver le lot.** **Sessions** enregistre toutes les lignes de la grille comme une session de lot nommée, quelle que soit la sélection. La session se rouvre depuis Projects. **Folders…** dans le même menu ouvre un dossier Projects sous forme de lignes, une par session enregistrée ; chaque nom de fichier contient son chemin de dossier.

::: details Sélectionner des lignes et des cellules
Sélectionne les lignes avec leurs cases à cocher, ou fais Maj-clic sur une case pour sélectionner une plage. La case de l'en-tête sélectionne la page actuelle, et **Select all *N* rows** inclut aussi les lignes des autres pages. Les sélections restent quand tu changes de page. **Edit input**, **Duplicate** et **Remove** agissent sur les lignes sélectionnées, et **Undo remove** restaure les dernières lignes supprimées. Depuis une cellule qui a le focus, Maj+Espace sélectionne cette ligne et Échap efface la sélection.

Fais glisser sur les cellules, fais Maj-clic sur une cellule ou utilise Maj+touches fléchées pour sélectionner un rectangle. **Copy cells**, ou Ctrl+C / Command+C, copie les valeurs pour un tableur. Ctrl+A / Command+A depuis une cellule qui a le focus sélectionne toutes les colonnes visibles sur toutes les pages ; depuis une case de ligne, le même raccourci sélectionne toutes les lignes. Sélectionner des cellules laisse les lignes cochées. Double-clique sur une cellule ou appuie sur Entrée pour modifier son texte. Colle un rectangle depuis le presse-papiers, ou colle une valeur pour remplir toutes les cellules sélectionnées ; les cellules vides et le texte multiligne gardent leurs positions.
:::

### Colourways et thèmes par ligne

Chaque ligne garde ses propres choix de thème : clair ou sombre, et un colourway quand le design system en propose. Une ligne ouverte depuis Projects, un dossier ou un lot enregistré utilise pour le rendu et l'aperçu les choix avec lesquels sa session a été enregistrée. La feuille d'impression, une ligne dupliquée et une ligne remplie les conservent.

Un CSV contient ces choix dans une colonne `_themes` après les colonnes de taille. Cette colonne utilise le même JSON que le paramètre de lien `_themes`, par exemple `{"":"dark","colourway":"beach"}`. Une cellule vide, ou `{}`, signifie les valeurs par défaut du design system. La colonne n'est écrite que si au moins une ligne a des choix. À l'import, une cellule qui ne contient pas de choix de thème valides est signalée comme un problème et sa ligne utilise les valeurs par défaut pour le rendu.

::: note Définir les choix d'une ligne dans le CSV
La grille n'a pas encore de contrôle pour modifier les choix d'une ligne, donc définis-les dans le CSV ou dans la session enregistrée.
:::

### Une langue par ligne

Un outil qui imprime ses propres formulations, comme Certificate, peut accepter une colonne `language` contenant un code de langue court comme `de`, `ja` ou `ar`. Chaque ligne imprime alors son texte et sa date dans cette langue. Les lignes en arabe et en ourdou sont disposées de droite à gauche. Une cellule vide suit la langue de l'application. Une langue pour laquelle Lolly n'a pas encore de traduction s'imprime en anglais, date comprise, donc un certificat n'est jamais à moitié traduit.

### Batch ou Render folder

Pour refaire le rendu de sessions déjà enregistrées, sélectionne-les dans Projects et utilise **Render selection**, ou **Render folder** pour un dossier entier. [Retrouver et récupérer ton travail](/info/find-your-work.html#find-something-you-saved) couvre les deux.

<!--i:eti-layers-->
## Modifier plusieurs designs enregistrés ensemble

Coche entre deux et huit sessions enregistrées dans **Projects** et choisis **Edit together** dans la barre de sélection. Elles s'ouvrent côte à côte sous forme de cartes en direct à l'adresse `#/multi?s=<slot>,<slot>…`. Chaque carte est un vrai rendu de sa session et montre ce qui sera exporté.

Une seule barre latérale les contrôle toutes :

- <!--i:sliders--> **Shared** vient en premier : toutes les entrées que deux sessions ou plus déclarent de la même manière (même identifiant, même type et mêmes contraintes, la règle utilisée par la grille de lot pour ses colonnes). Modifier un contrôle partagé touche toutes les sessions qui déclarent l'entrée, en direct sur chaque carte. Deux sessions du même outil partagent tout ; deux outils différents ne partagent que leurs entrées communes. Le menu **Input actions** de la carte Shared lie un token de design dans chaque session qui déclare l'entrée.
- <!--i:document--> Sous la carte Shared, **une carte repliée par session** contient toutes les entrées propres à cette session, comme dans la barre latérale de l'outil, avec un bloc d'export compact : **Format**, **W** / **H**, **Unit**, **DPI** et **Download**. Ce Download enregistre d'abord la session, puis produit le fichier avec le même nom, le même format et les mêmes Content Credentials que depuis l'outil.
- <!--i:search--> **Filter inputs…** en haut filtre les contrôles sur toutes les cartes à la fois.

Clique sur une carte (ou appuie sur Entrée sur la carte) pour ouvrir la carte de cette session dans la barre latérale. **Save all** réenregistre chaque session à son emplacement. **Download all** enregistre d'abord, puis produit l'ensemble dans un seul zip, comme **Render selection** dans Projects, et propose le verrouillage facultatif par mot de passe.

Chaque carte utilise les choix de thème de sa propre session pour le rendu, y compris pour un outil placé dans le design. L'application autour des cartes garde ses propres couleurs. **Save all**, les téléchargements, **Batch grid** et **Send to Print Sheet** gardent les choix de chaque session.

### Limites

- **Huit au maximum.** Chaque carte charge son propre moteur d'exécution en direct, et huit cartes restent réactives. Un lien qui en demande plus, ou demande une session qui n'existe plus, le signale et ne charge pas un résultat incomplet.
- **Le lien est local.** Il désigne tes propres emplacements enregistrés et rouvre cet ensemble sur cet appareil. Ce n'est pas un lien de partage.
- **Pour un ensemble plus grand,** choisis **Edit as sheet** dans la même barre de sélection. La sélection s'ouvre comme des lignes dans la grille de lot (`#/batch?s=…`), sans limite de taille ni obligation d'utiliser le même outil. Les dossiers sont exclus des deux : ouvre un dossier dans la grille avec **Sessions → Folders…**, ou produis son rendu avec **Render folder** dans Projects.
- **La recherche n'atteint pas Lolly Multi-edit.** C'est la seule vue que la barre de recherche ne couvre pas.

<!--i:eti-map-pin-->
## Où aller ensuite

- **[Exporter un fichier](/info/exporting.html)** : les formats, tailles et réglages d'impression que chaque ligne peut utiliser.
- **[Modèles](/info/templates.html)** : des points de départ pour une bonne première ligne.
- **[Retrouver et récupérer ton travail](/info/find-your-work.html)** : Projects, les dossiers et le rendu de ce que tu as enregistré.
