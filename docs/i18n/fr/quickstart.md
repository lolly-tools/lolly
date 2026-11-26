# Commencer

Règle tes outils avec tes propres couleurs et polices, et réutilise le travail que tu as déjà. Tu n'as pas besoin de compte, et la création et l'export se font sur ton appareil.

::: steps
- <!--i:eti-sparkles--> **[Créer un fichier](/info/make-something.html)** Un QR code en quelques minutes, avec chaque étape montrée.
- <!--i:eti-palette--> **[Ajouter ta marque](#put-your-brand-in)** Pars d'une couleur, d'un fichier de tokens ou d'un design terminé.
- <!--i:eti-folder-move--> **[Importer ton travail](#bring-in-what-you-already-have)** Les designs, decks et données que tu as déjà, lus sur ton appareil.
- <!--i:eti-repeat--> **[En créer d'autres du même type](#make-many-share-and-automate)** Partage un lien, remplis une feuille de calcul ou lance l'outil depuis un script.
:::

[Qu'est-ce que Lolly ?](/info/what-is-lolly.html) est une présentation en cinq minutes. [Comment fonctionne Lolly](/info/how-lolly-works.html) montre qui fait quoi.

<!--i:eti-palette-->
## Ajouter ta marque

lolly.tools s'ouvre avec **Lolly Demo**, le propre design system d'exemple de Lolly ([Découvrir Lolly Demo](/info/lolly-demo.html)). Ton design system remplace Lolly Demo. C'est un petit ensemble de design tokens (couleurs, polices et quelques règles) avec lesquels chaque outil dessine. Configure-le une fois, et tout ce que tu crées respecte ta marque dès le départ.

Choisis le chemin qui correspond à ce que tu as :

- <!--i:palette--> **Une couleur.** Ouvre la vue **Design System Setup** (`#/start`), nomme ton design system et choisis une couleur principale. Lolly en tire une palette accessible, avec des surfaces claires et sombres, du texte et des accents. Choisis une police et tu as une marque utilisable.
- <!--i:upload--> **Un fichier de tokens.** **Add from…**, en haut de Lolly Design System Setup, accepte un fichier de tokens DTCG, Tokens Studio ou Penpot, un SVG ou un pack `LollyBrand`. La palette se remplit à partir du fichier. Tant que le design system est vide, **Start from a reference** sur le Board ouvre le même sélecteur.
- <!--i:pentool--> **Un design terminé.** Dans Lolly Design, choisis **Import a design** et dépose un fichier Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint ou SVG ([tous les formats](/info/design-import.html#what-comes-in-from-each-app)). Voir [Importer ce que tu as déjà](#bring-in-what-you-already-have) ci-dessous.

La première fois que tu ouvres la galerie, un message d'accueil en haut propose une prochaine étape. Sur lolly.tools, **Start making** ouvre Lolly Design sur l'affiche Launch. Sur une nouvelle installation, **Make it yours** ouvre Lolly Design System Setup. Sous ce bouton, **Bring a file** ouvre un sélecteur de fichier pour un design, et l'autre de ces deux choix apparaît sous forme de lien. Chacun de ces choix, ou le bouton de fermeture, fait disparaître le message d'accueil pour de bon.

![La salle Colours de Lolly Design System Setup sur un nouveau design system : une pastille active, un champ et toute la première décision](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Huit salles, à utiliser dans n'importe quel ordre, permettent d'aller plus loin avec le design system : **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** et **Skills**. Chaque aperçu dans l'application se met à jour pendant que tu saisis du texte. [Lolly Design System Setup](/info/brand-studio.html) couvre chaque salle.

Les polices sont gardées sur ton appareil. Une Google Font que tu choisis est stockée comme ressource de marque, donc ta typographie fonctionne hors ligne et rien n'est récupéré quand un outil dessine.

### Voir, changer et partager un design system

- **Voir celui qui est actif.** **Settings → Design system** montre le design system actif sous forme de couverture et de pages, en lecture seule.
- **Passer de l'un à l'autre.** **Settings → Preferences → Design systems** liste chaque design system sur cet appareil. Une organisation peut utiliser plusieurs design systems, ou un seul avec plusieurs colourways. [Architectures de marque](/info/brand-architectures.html) présente ces configurations.
- **En partager un.** Exporte le design system comme pack `LollyBrand` : un fichier qu'un collègue importe pour obtenir la même palette, les mêmes polices et les mêmes règles.

Un design system fourni par ta version de l'application ou ton organisation est **géré** : il affiche un cadenas et reste en lecture seule. Pour le modifier, crée une copie modifiable depuis **Settings → Preferences → Design systems**.

![L'onglet Design system dans Settings : le design system actif sous forme de couverture et de pages](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Ton design system est constitué de tokens DTCG, le format que Penpot lit et écrit et que Tokens Studio apporte à Figma. La palette avec laquelle tu crées et celle que Lolly applique forment un seul document. [Tokens de design](/info/design-tokens.html) donne les détails.

::: details Pour les développeurs : créer un pack de marque en ligne de commande
`ingest:brand` crée un pack de marque réutilisable dans une copie de travail du dépôt. Il accepte les trois conteneurs exportés par Penpot et Tokens Studio : un fichier `tokens.json` unique, un dossier de fichiers par ensemble avec `$metadata.json` ou une archive `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` enregistre la marque comme profil, puis construit et valide son catalogue. Il ne change jamais le profil par défaut : lance la commande avec `LOLLY_PROFILE=acme` pour utiliser le nouveau pack. [Configuration](/info/configuration.html) explique comment les packs de marque et les profils s'articulent.
:::

<!--i:eti-folder-move-->
## Importe ce que tu as déjà

**Fichiers Lolly Design.** Les créations terminées dans Figma, Penpot, Illustrator, InDesign ou toute application SVG s'ouvrent dans Lolly Design sous forme de mises en page modifiables. Le texte reste modifiable, les formes restent des formes et les images arrivent dans ta bibliothèque. Le fichier est lu dans ton navigateur et rien n'est envoyé. [Importer un design](/info/design-import.html) liste chaque format et ce qui est conservé.

**Decks.** Dépose un PowerPoint `.pptx` sur Lolly pour ranger ses diapositives parmi tes ressources. Rédige un nouveau deck en Markdown dans **Lolly Markdown Slides**. [Adapter un deck à ta marque](/info/rebrand.html) fait passer un deck à ton design system.

**Données.** Colle ou dépose un tableau CSV ou JSON pour remplir les champs répétables d'un outil. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) produit un fichier fini par ligne.

### D'une création ponctuelle à un modèle

Une mise en page importée est une session Lolly Design ordinaire. **Share with rules** transforme la session en outil. Tu choisis les parties que les autres peuvent modifier et ils ne remplissent que celles-ci.

![Conserve l'original Lolly Design, choisis les entrées et les limites dans une copie de création, puis partage un outil .lolly réutilisable que les destinataires remplissent](/info/diagrams/concepts/share-with-rules.svg)

[Partager un design avec des règles](/info/create-a-tool.html) te guide à chaque étape.

<!--i:eti-repeat-->
## Produis en série, partage et automatise

- <!--i:download--> **Exporter.** Les outils produisent du SVG, du PDF, du PNG, du JPG, du WebP, de la vidéo et d'autres formats, aux dimensions réelles d'impression si nécessaire. Chaque outil propose ses propres formats. Voir [Exporter un fichier](/info/exporting.html).
- <!--i:link--> **Partager un lien.** Les réglages d'un outil sont inclus dans son lien, qui rouvre donc le même fichier partout.
- <!--i:layers--> **Produire un fichier par ligne.** Pilote un outil depuis une feuille de calcul dans [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatiser.** Le même rendu s'exécute depuis la [CLI](/info/cli.html) et depuis un [agent IA](/info/ai-agents.html).

Un lien est une requête complète. Le type, le titre et le tableau de données du graphique ci-dessous ont été saisis dans la barre d'adresse.

![Un graphique en barres des inscriptions mensuelles par canal dans les couleurs du design system, dont chaque valeur provient d'un paramètre de requête plutôt que d'un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Où aller ensuite

- <!--i:people--> **[Créer](/info/creators.html)** : créer, animer, enregistrer, partager et exporter.
- <!--i:code--> **[Automatiser](/info/builders.html)** : design systems, création d'outils, ligne de commande, liens et agents.
- <!--i:usercheck--> **[Gérer](/info/operators.html)** : utiliser Lolly pour une équipe avec Lolly Work.
- <!--i:server--> **[Déployer](/info/operate.html)** : héberger Lolly et Lolly Work.
- <!--i:shieldcheck--> **[Faire confiance](/info/trust.html)** : confidentialité, sécurité et vérification d'un fichier par toi-même.
