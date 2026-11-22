# Comment Lolly se compare

Lolly crée des fichiers conformes à la marque sur ton propre appareil, sans compte. **Lolly Work** est le serveur pour les équipes : authentification, projets partagés, approbations et rendu serveur, sur des machines exploitées par ton organisation. Les deux sont open source sous MPL-2.0.

La plupart des équipes gardent les outils qu'elles ont. Une application de design fournit les designs, un DAM reste la source de référence, et Lolly transforme les entrées approuvées en fichiers terminés. [Utiliser Lolly avec ton DAM existant](/info/use-with-dam.html) décrit cette combinaison. L'idée derrière cette combinaison est la [souveraineté du contenu](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Les outils d'aujourd'hui

Chaque anneau montre dans quelle mesure une catégorie de produits répond à un besoin. Appuie sur un **?** à côté d'une ligne pour voir les éléments qui étayent le score, et sur le **?** à côté de la légende pour comprendre le calcul des scores.

::: figure positioning-comparison
Comparaison des capacités. Étude des concurrents à partir des documents des éditeurs, d'août au 21 novembre 2026. Lolly et Lolly Work évalués le 21 novembre 2026. Barème : 0 absent, 25 contournement, 50 réel mais à accès restreint ou partiel, 75 solide avec réserves, 100 compétence centrale.
:::

::: details Sources des scores qui ont changé en novembre 2026
- Canva : [journal des modifications de l'API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [applications de service](https://www.canva.dev/blog/developers/canva-service-accounts/), [aide de Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe : [journal des modifications de l'API InDesign](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [tarifs d'Adobe Express](https://www.adobe.com/express/pricing)
- Figma : [crédits d'agents et d'IA](https://help.figma.com/hc/en-us/articles/42614902212887), [serveur MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify et Bynder : [note de version Frontify d'octobre 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear et Placid : [tarifs de Bannerbear](https://www.bannerbear.com/pricing/), [journal des modifications de Bannerbear](https://www.bannerbear.com/changelog/), [tarifs de Placid](https://placid.app/pricing)
- Penpot : [tarifs de l'auto-hébergement](https://penpot.app/pricing/self-host), [versions](https://github.com/penpot/penpot/releases)
- Cloudinary : [provenance du contenu](https://cloudinary.com/documentation/content_provenance_and_authenticity), [tarifs](https://cloudinary.com/pricing)
:::

Les fonctionnalités et l'expérience acquise figurent sur des lignes distinctes. La première version publique de Lolly était la 1.0.1, le 30 août 2026, sa sécurité n'a pas encore fait l'objet d'un audit indépendant et les preuves de son adoption datent de quelques mois. [Adoption & gouvernance](/info/adoption-governance.html#status) présente l'état actuel.

<!--i:eti-hammer-->
## Quand choisir Lolly

::: cols
## Choisis Lolly quand

- Le même type de fichier est nécessaire encore et encore : visuels d'événement, badges, certificats, alertes, cartes pour les réseaux sociaux
- De nombreux fichiers sont produits à partir d'un modèle et d'un tableau de valeurs, dans [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) ou la CLI
- Les couleurs, la typographie et les ressources doivent rester dans le design system, même sur un canevas libre
- Un design terminé dans Figma, Penpot, Illustrator, InDesign, Affinity ou en PDF doit devenir modifiable et reproductible ([Importer un design](/info/design-import.html))
- Les fichiers doivent être créés sur tes propres appareils ou serveurs

## Choisis autre chose quand

- Le travail consiste en de la retouche photo détaillée ou de l'illustration
- Tu conçois et prototypes une interface d'application
- Tu as besoin d'une vaste bibliothèque d'images et de modèles prête dès le premier jour
- Tu as besoin d'un service géré qui a fait ses preuves à grande échelle depuis longtemps
:::

Les designs importés et les design tokens partagés permettent à une équipe de combiner Lolly avec des applications spécialisées, tandis que Lolly Work encadre les ressources partagées, la révision et la livraison.

Pour les équipes disposant d'un DAM soigneusement organisé, commence par conserver cette bibliothèque et ses administrateurs. [L'expérience de SUSE avec Brandfolder](/info/suse-brandfolder.html) relate comment l'intégration a soutenu l'adoption et la gestion du changement des processus d'approbation. Les éditeurs de DAM et les partenaires d'intégration peuvent évaluer la même organisation via [le flux de travail partenaire](/info/dam-partners.html).

Dans **Lolly Markdown Slides**, un deck entier est écrit sous forme de données, mis en page en direct et exporté en fichier PowerPoint natif et modifiable.

![Lolly Markdown Slides dans la vue divisée : les diapositives du deck listées sous forme de blocs à gauche, le rendu du deck mis en page à droite](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Les règles sont dans l'outil

Lolly place les règles de marque réutilisables dans l'outil : couleurs, polices, marges de fond perdu, espacement et entrées autorisées. Le modèle fixe les parties qu'un destinataire ne doit pas changer. Lolly Work ajoute des politiques d'accès par groupe et de saisie autour de ce modèle, avec des chaînes d'approbation pour les soumissions au catalogue et la livraison.

Vérifier un outil une fois facilite la production reproductible, car chaque sortie hérite de ses règles de mise en page. Le texte, les images importées et les droits d'utilisation peuvent encore demander une vérification, et Lolly Work fournit des catalogues partagés et des étapes d'approbation pour cela. Pour l'équipe créative, l'outil est un garde-fou : tu apportes toujours les données, le texte et l'image, et l'outil garde chaque résultat conforme à la marque.

![Tout le travail de la personne qui produit : saisir les mots. La typographie, la couleur et l'espacement ont été fixés lors de la création de l'outil](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Trois autres différences :

- **Le fichier final, à partir des entrées.** Des entrées au départ, un fichier terminé à l'arrivée, sans « maintenant, enregistre-le depuis ton outil de design et retouche-le ».
- **Les outils composent avec d'autres outils.** Un outil peut incorporer le rendu d'un autre outil dans un seul fichier terminé, sans couplage de code entre eux.
- **Open source.** Le moteur est open source, et les outils, ressources et design tokens sont des fichiers que tu peux conserver sous gestion de versions ou gérer dans Lolly Work, pas des lignes dans la base de données de quelqu'un d'autre.

Un design audacieux reste possible avec des garde-fous. Cette carte urbaine de qualité affiche est faite de véritables tracés vectoriels de routes et de voies d'eau, à partir d'une liste déroulante et de deux champs de couleur qui ne peuvent pas sortir du design system :

![Les anneaux de canaux et le réseau routier d'Amsterdam dessinés bord à bord avec l'encre propre au design system, chaque trait placé par le modèle plutôt qu'à la main](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innover de façon probabiliste, passer à l'échelle de façon déterministe

La plupart des discours sur la « création par IA » placent le modèle du mauvais côté d'une frontière ancienne. Les scribes et les enlumineurs en ont fixé le tracé. Tu travailles librement sur l'esquisse, où tout peut être essayé et rien n'est définitif. Puis tu passes à la presse à imprimer, qui fixe le résultat. L'art se trouvait dans les esquisses, et la presse permettait de le diffuser, et l'œuvre imprimée était digne de confiance parce que la presse tenait sa promesse à chaque tirage.

Lolly est la presse. Apporte ce que tu veux aux idées, un modèle, un designer ou un croquis, mais dès qu'une idée doit devenir de nombreux fichiers, elle passe par un système qui produit le même rendu à chaque fois, à partir d'entrées que chacun peut relire. La comparaison ci-dessus porte en réalité sur qui rend cette étape définitive reproductible.

> Fais confiance au processus créatif, passe à l'échelle avec rigueur.

<!--i:eti-tag-->
## Gratuit pour toujours

**Si le rendu se fait sur ton appareil, c'est gratuit pour toujours.** Le moteur, les interfaces hôtes, les outils et les formats sont open source, et une version publiée ne peut pas être reprise. Lolly Work est aussi open source. Une organisation paie l'infrastructure et l'exploitation qu'elle choisit, sans frais de licence logicielle par utilisateur ou par rendu en auto-hébergement. [Questions & réponses](/info/faq.html) raconte l'histoire derrière cette promesse.

<!--i:eti-map-pin-->
## Où réside ton contenu

Le travail créatif de Lolly peut s'exécuter sur du matériel qui t'appartient, et ses design tokens, polices, logos et outils sont des fichiers que tu peux conserver. Avec Lolly Work, les projets partagés, les ressources, les politiques et les enregistrements d'audit résident dans un stockage configuré par ton organisation. [Confiance](/info/trust.html) explique pourquoi cela compte, et la [Politique de confidentialité](/info/privacy.html) et [Vérifie par toi-même](/info/verify-yourself.html) te permettent de vérifier cette affirmation plutôt que de nous croire sur parole.

<!--i:eti-grid-->
## Outil par outil

[Lolly comparé, outil par outil](/info/compare.html) compare Lolly à Canva, Adobe, Figma, Penpot, aux portails de marque, aux API de rendu et aux convertisseurs en ligne, avec une page pour chacun, et précise [ce qui s'exécute où](/info/compare.html#what-runs-where).
