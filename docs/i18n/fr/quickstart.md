# Démarrer

À la fin de cette page, tes outils porteront tes propres couleurs et polices, et le travail que tu as déjà sera prêt à être réutilisé. Tu n'as besoin d'aucun compte, et la création et l'export se font sur ton appareil.

::: timeline
- <!--i:sparkle--> **Crée un fichier.** [Crée ton premier fichier](/info/make-something.html) te guide vers un QR code en quelques minutes.
- <!--i:palette--> **Mets ta marque dedans.** Pars d'une couleur, d'un fichier de tokens ou d'un design terminé.
- <!--i:layers--> **Fais-en d'autres du même genre.** Partage un lien, remplis un tableur ou lance l'outil depuis un script.
:::

Tu découvres l'idée elle-même ? [What is Lolly?](/info/what-is-lolly.html) est l'introduction de cinq minutes, et [How Lolly works](/info/how-lolly-works.html) montre qui fait quoi.

## Mets ta marque dedans

lolly.tools s'ouvre sur **Lolly Demo**, le design system d'exemple de Lolly ; [Meet Lolly Demo](/info/lolly-demo.html) montre ce que tu as sous les yeux. Ton design system le remplace : un petit ensemble de design tokens, c'est-à-dire des couleurs, des polices et quelques règles, avec lesquels chaque outil dessine. Définis-le une fois, et tout ce que tu crées démarre aux couleurs de ta marque.

Choisis la voie qui correspond à ce que tu as :

- <!--i:palette--> **Une couleur.** Ouvre **Design System Setup** (`#/start`), donne un nom à ton design system et choisis une couleur primaire. Lolly en dérive une palette complète et accessible, avec des surfaces claires et sombres, du texte et des accents. Choisis une police et tu as une marque fonctionnelle.
- <!--i:upload--> **Un fichier de tokens.** **Add from…**, au pied du rail des pièces de Design System Setup, accepte un fichier de tokens DTCG, Tokens Studio ou Penpot, un SVG ou un pack `LollyBrand`. Dépose-le et la palette se remplit. Tant que le design system est vide, **Start from a reference** dans la pièce Overview ouvre le même sélecteur.
- <!--i:pentool--> **Un design terminé.** Dans Design, choisis **Import a design** et dépose un fichier `.fig`, `.penpot`, `.ai`, `.idml` ou SVG. Voir [Reprends ce que tu as déjà](#bring-in-what-you-already-have) ci-dessous.

La première fois que tu ouvres la galerie, un court message d'accueil propose les mêmes choix : **Make it yours** ouvre Design System Setup, **Bring your design** ouvre un sélecteur de fichier pour un design et **Explore the community tools** ferme l'accueil.

![La pièce Colours de Design System Setup sur une installation neuve : une pastille en direct, un champ et toute la première décision](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

À partir de là, sept pièces te mènent aussi loin que tu veux, dans l'ordre que tu veux : **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** et **Usage & rules**. Chaque aperçu de l'application se met à jour pendant que tu saisis. [Design System Setup](/info/brand-studio.html) couvre chaque pièce.

Les polices sont conservées sur ton appareil. Choisis une Google Font et Lolly stocke le fichier comme ressource de marque, de sorte que ta typographie voyage hors ligne et que rien n'est récupéré quand un outil dessine.

### Voir, changer et partager un design system

- **Voir celui qui est actif.** **Settings → Design system** montre le design system actif sous forme de couverture et de pages, en lecture seule.
- **Passer de l'un à l'autre.** **Settings → Preferences → Design systems** liste chaque design system présent sur cet appareil. Une organisation peut gérer plusieurs design systems, ou un seul avec plusieurs colourways ; [Brand architectures](/info/brand-architectures.html) cartographie les agencements.
- **En partager un.** Exporte le design system sous forme de pack `LollyBrand` : un seul fichier qu'un collègue importe pour obtenir la même palette, les mêmes polices et les mêmes règles.

Un design system fourni par ta version ou ton organisation est **managed** : il affiche un cadenas et reste en lecture seule. Pour en modifier un, crée une copie modifiable depuis **Settings → Preferences → Design systems**.

![L'onglet Design system dans les réglages : le design system actif sous forme de couverture et de pages](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Ton design system, ce sont des tokens DTCG, le format que Penpot lit et écrit et que Tokens Studio apporte à Figma, donc la palette avec laquelle tu conçois et celle que Lolly applique forment un seul document. [Design Tokens](/info/design-tokens.html) donne les détails.

::: details Pour les développeurs : créer un pack de marque en ligne de commande
Pour monter un pack de marque réutilisable dans un checkout, `ingest:brand` accepte les trois conteneurs qu'exportent Penpot et Tokens Studio : un seul `tokens.json`, un répertoire de fichiers par jeu avec `$metadata.json`, ou une archive `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` enregistre la marque comme profil, puis construit et valide son catalogue. Il ne change jamais le profil par défaut : lance avec `LOLLY_PROFILE=acme` pour utiliser le nouveau pack. [Configuration](/info/configuration.html) explique comment les packs de marque et les profils s'articulent.
:::

## Reprends ce que tu as déjà

Tu ne pars pas d'une page blanche.

**Fichiers de design.** Un travail terminé venu de Figma, Penpot, Illustrator, InDesign ou de n'importe quelle application SVG s'ouvre dans Design comme une mise en page vivante : le texte reste modifiable, les formes restent des formes et les images arrivent dans ta bibliothèque. Le fichier est lu dans ton navigateur et rien n'est envoyé. [Import a design](/info/design-import.html) liste chaque format et ce qui est conservé.

**Decks.** Dépose un `.pptx` PowerPoint dans Lolly pour ranger ses diapositives comme ressources, écris un nouveau deck à partir de Markdown dans **Markdown Slides**, ou utilise [Rebrand a deck](/info/rebrand.html) pour faire passer tout le deck sur ton design system.

**Données.** Colle ou dépose un tableau CSV ou JSON et les champs répétables d'un outil s'en remplissent, ou [Batch](/info/batch.html#make-many-versions-of-one-design) produit un fichier terminé par ligne.

### D'une création ponctuelle à un modèle

Une mise en page importée est une session Design ordinaire. **Share with rules** la transforme en outil : tu choisis quelles parties les autres peuvent modifier, et ils ne remplissent que celles-là.

![Garde le master Design, choisis les entrées et les limites dans une copie d'édition, puis partage un outil .lolly réutilisable que les destinataires remplissent](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) détaille chaque étape.

## En faire beaucoup, partager et automatiser

- <!--i:download--> **Export.** Les outils produisent du SVG, du PDF, du PNG, du JPG, du WebP, de la vidéo et plus encore, dans les formats que chaque outil propose, aux vraies dimensions d'impression quand tu en as besoin. Voir [Export a file](/info/exporting.html).
- <!--i:link--> **Partager un lien.** Les réglages d'un outil voyagent dans son lien, donc le lien rouvre le même fichier n'importe où.
- <!--i:layers--> **En faire un par ligne.** Pilote un outil depuis un tableur dans [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatiser.** Le même rendu s'exécute depuis la [CLI](/info/cli.html) et depuis un [agent IA](/info/ai-agents.html).

Un lien est une requête complète. Personne n'a dessiné le graphique ci-dessous : son type, son titre et tout son tableau de données ont été saisis dans la barre d'adresse, et le même lien dessine le même graphique sur n'importe quel appareil.

![Un graphique en aires des inscriptions mensuelles, dont chaque valeur est arrivée comme paramètre de requête plutôt que par un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Où aller ensuite

- <!--i:people--> **[Create](/info/creators.html)** : créer, animer, enregistrer, partager et exporter.
- <!--i:code--> **[Automate](/info/builders.html)** : design systems, création d'outils, ligne de commande, liens et agents.
- <!--i:usercheck--> **[Manage](/info/operators.html)** : faire tourner Lolly pour une équipe avec Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)** : héberger Lolly et Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)** : confidentialité, sécurité et vérification d'un fichier par toi-même.
