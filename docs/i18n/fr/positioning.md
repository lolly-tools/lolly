# Comment Lolly se compare

Lolly est deux parties d'un même projet open source. **Lolly** est le moteur, les applications et les outils pour créer, modifier, convertir et exporter sur ton appareil, sans compte. **Lolly Work** est le serveur d'organisation, exploité sur ta propre infrastructure, pour la connexion, les projets partagés, les approbations et le rendu serveur. Les deux sont sous MPL-2.0. Cette page compare la paire aux autres façons de concevoir, d'encadrer et de produire des fichiers.

## Les outils d'aujourd'hui

Chaque anneau note à quel point une classe de produit offre complètement une capacité, chaque classe étant notée sur son meilleur représentant. La colonne Lolly couvre Lolly et Lolly Work ensemble, et chaque ligne dit quelle partie fournit quoi. Ouvre le nom d'une ligne pour le raisonnement derrière sa note. Les colonnes sont triées par la ligne Overall completeness en haut : la moyenne des lignes notées, la ligne de dépense exclue.

::: figure positioning-comparison
Comparaison des capacités : recherche sur les concurrents et notes d'août 2026 ; couverture de Lolly + Lolly Work relue le 28 septembre 2026. Notation : 0 absent, 25 contournement, 50 réel mais restreint ou partiel, 75 solide avec réserves, 100 compétence centrale.
:::

::: details Notes sur la notation
Les fonctions disponibles et la maturité de production sont deux choses distinctes. Lolly est publié : la version 1.0 est sortie en open source le 30 août 2026, sa sécurité n'a pas encore fait l'objet d'un audit indépendant et ses preuves d'adoption ont quelques mois ([Adoption & Governance](/info/adoption-governance.html#status) donne l'état actuel). Disposer de l'authentification unique, des approbations ou du rendu serveur n'établit pas un historique en production, et la note de maturité en tient compte. Les notes des concurrents gardent leur revue datée d'août.

Une règle gouverne le tableau. La note maximale (100), sur les lignes qui touchent ton contenu ou ton identité, exige une capacité utilisable sans compte et sans précondition cloud ; les lignes sur le produit lui-même, comme la maturité et la facilité d'usage, en sont exemptées. Cette règle coûte à Adobe sur les Content Credentials : l'implémentation livrée la plus large (Photoshop, Lightroom, Premiere, Firefly) signe en local et dans le cloud, mais jamais sans compte et identité Adobe, donc 75. Elle plafonne les API de rendu sur la génération en masse et l'automatisation pour la même raison.

Canva est noté sur son meilleur membre de la famille pour chaque ligne, puisqu'il possède Affinity et Cavalry (tous deux offerts en octobre 2025). Le rendu hors ligne et sur l'appareil reçoit 75 grâce à Affinity, une suite de bureau qui exige encore un compte vérifié et porte de la télémétrie, la déduction qu'Adobe subit aussi ; le mode hors ligne propre de Canva ne modifie que des designs déjà synchronisés, sur un appareil, pour une durée limitée. Autofill reçoit 50 : il est réel mais réservé à Enterprise et asynchrone, et il ne remplit que du texte et des images. La génération en masse de Figma est passée de 25 à 50 quand Buzz a livré le remplissage par tableur (une bêta gratuite, août 2026).

La note de 75 de Lolly sur les Content Credentials couvre la signature sur l'appareil et la signature serveur de Lolly Work avec une identité d'organisation configurée ; un vérificateur doit quand même faire confiance au signataire ([Content Credentials Identity](/info/content-credentials-identity.html)). Le 50 de Penpot vient du plugin d'export propre de Lolly pour Penpot : la même signature du moteur, facultative et déclarée comme celle de Lolly. Penpot reçoit 90 sur le rendu sur l'appareil : un canevas de navigateur avec une cible d'enregistrement sur son serveur, qui peut être auto-hébergé. Cloudinary a sa propre colonne pour sa bibliothèque de ressources, son API de transformation et son CDN ; la revue d'août a noté sa signature de livraison à 50.

La collaboration en direct de Lolly comprend des collabs privées directes entre deux appareils et des collabs de travail authentifiées via Lolly Work, avec modifications partagées, curseurs et sessions d'équipe enregistrées. La note Partial reflète le déploiement de travail actuel à nœud unique et son court historique d'exploitation, pas une absence d'édition en équipe. Les estimations de prix sont de l'arithmétique datée sur prix catalogue pour donner une échelle, pas un achat.
:::

## Quand choisir Lolly

::: cols
## Choisis Lolly quand

- Le même type de fichier est nécessaire encore et encore : tuiles d'événements, badges, certificats, alertes, cartes sociales
- Beaucoup de fichiers viennent d'un seul modèle et d'un tableau de valeurs, dans [Batch](/info/batch.html#make-many-versions-of-one-design) ou la CLI
- Les couleurs, la typographie et les ressources doivent rester dans le design system, même sur un canevas ouvert
- Un design Figma, Penpot, Illustrator, InDesign ou PDF terminé doit devenir modifiable et répétable ([Import a design](/info/design-import.html))
- Les fichiers doivent être créés sur tes propres appareils ou serveurs

## Choisis autre chose quand

- Le travail est de la retouche photo détaillée ou de l'illustration
- Tu conçois et prototypes l'interface d'une application
- Tu as besoin d'une grande bibliothèque d'images et de modèles prête dès le premier jour
- Tu as besoin d'un service géré avec un long historique à grande échelle
:::

Les designs importés et les design tokens partagés permettent à une équipe de combiner Lolly avec des applications spécialisées, tandis que Lolly Work encadre les ressources partagées, la revue et la livraison.

Un deck de diapositives entier montre le plafond : dans **Markdown Slides**, un deck est déclaré sous forme de données, mis en page en direct et exporté sous forme de fichier PowerPoint natif et modifiable.

![Markdown Slides en vue partagée : les diapositives du deck listées comme blocs à gauche, le deck mis en page à droite](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Les règles vivent dans l'outil

Lolly place les règles de marque réutilisables dans l'outil : couleurs, polices, marges de fond perdu, espacements et entrées autorisées. Le modèle fixe les parties qu'un destinataire ne doit pas changer. Lolly Work ajoute autour de ce modèle l'accès par groupe et les politiques d'entrées, avec des chaînes d'approbation pour les soumissions au catalogue et la livraison.

Vérifier un outil une fois facilite la production répétable, car chaque sortie hérite de ses règles de mise en page. Les textes, les images importées et les droits d'usage peuvent quand même demander des vérifications, et Lolly Work fournit des catalogues partagés et des étapes d'approbation pour cela. Pour l'équipe créative, l'outil est un garde-fou : tu apportes toujours les données, le texte et l'image, et l'outil garde chaque résultat aux couleurs de la marque.

![Tout le travail de celui qui produit : saisir les mots. La typographie, la couleur et les espacements ont été fixés quand l'outil a été créé](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Trois autres choses distinguent cette approche :

- **Le fichier final, à partir d'entrées.** Des entrées en entrée, un fichier terminé en sortie, sans « maintenant enregistre-le depuis ton outil de design et retouche-le ».
- **Les outils composent des outils.** Un outil peut incorporer le rendu d'un autre outil dans un seul fichier terminé, sans couplage de code entre eux.
- **Ouvert jusqu'au bout.** Le moteur est open source, et les outils, les ressources et les design tokens sont des fichiers que tu peux garder sous contrôle de version ou gérer dans Lolly Work, pas des lignes dans la base de données de quelqu'un d'autre.

Un design audacieux survit aux garde-fous. Cette carte de ville de qualité affiche est faite de vrais tracés vectoriels de routes et d'eau, à partir d'une liste déroulante et de deux champs de couleur qui ne peuvent pas être dirigés hors du design system :

![Les anneaux de canaux et le réseau routier d'Amsterdam dessinés de bord à bord dans l'encre propre du design system, chaque trait placé par le modèle plutôt qu'à la main](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innover de façon probabiliste, passer à l'échelle de façon déterministe

La plupart des discours sur la « création par IA » placent le modèle du mauvais côté d'une vieille frontière. Les scribes et les enlumineurs ont fixé où elle passe. Tu travailles librement sur l'esquisse, où tout peut être essayé et rien n'est engagé. Puis tu vas à la presse d'imprimerie, qui engage. L'art était dans les esquisses, et la presse était le moyen de le faire voyager, et l'œuvre imprimée pouvait être crue parce que la presse tenait sa promesse à chaque tirage.

Lolly est la presse. Apporte ce que tu veux aux idées, un modèle, un designer ou un dessin au crayon, mais dès qu'une idée doit devenir beaucoup de fichiers, elle passe par quelque chose qui rend de la même façon à chaque fois, à partir d'entrées que n'importe qui peut relire. La comparaison ci-dessus porte en réalité sur qui rend cette étape engagée répétable.

> Fais confiance au processus créatif, passe à l'échelle avec rigueur.

## Gratuit pour toujours

**Si cela se rend sur ton appareil, c'est gratuit pour toujours.** Le moteur, les shells, les outils et les formats sont open source, et une version publiée ne peut pas être reprise. Lolly Work est open source aussi. Une organisation paie l'infrastructure et l'exploitation qu'elle choisit, sans frais de licence logicielle par poste ni par rendu pour l'auto-hébergement. [Questions & answers](/info/faq.html) raconte l'histoire derrière cette promesse.

## Où vit ton contenu

Le travail créatif de Lolly peut tourner sur du matériel que tu possèdes, et ses design tokens, polices, logos et outils sont des fichiers que tu peux garder. Avec Lolly Work, les projets partagés, les ressources, la politique et les enregistrements d'audit vivent dans un stockage que ton organisation configure. [Trust](/info/trust.html) explique pourquoi c'est important, et la [Privacy Policy](/info/privacy.html) et [Verify It Yourself](/info/verify-yourself.html) te laissent vérifier l'affirmation plutôt que nous croire sur parole.

## Outil par outil

[Lolly compared, tool by tool](/info/compare.html) compare Lolly à Canva, Adobe, Figma, Penpot, aux portails de marque, aux API de rendu et aux convertisseurs en ligne, une page chacun, et expose [what runs where](/info/compare.html#what-runs-where).
