# Comment Lolly se compare

Ce que Lolly fait que les outils créatifs actuels ne font pas, et ce qu'il leur laisse délibérément.

Pour la version outil par outil, une page chacun pour Canva, Adobe, Figma, les API de rendu et les convertisseurs en ligne, voir [Lolly comparé, outil par outil](/info/compare.html). Chaque page indique ce que l'autre outil fait mieux et ce que Lolly fait à la place.

> **Statut pilote :** Lolly est un prototype en pilote fermé, pas un produit fini, et sa sécurité est actuellement soumise au durcissement d'infrastructure strict de SUSE, en préparation d'une échelle entreprise. La page [Adoption & gouvernance](/info/adoption-governance.html#status) couvre l'état actuel.

## Les outils d'aujourd'hui

Chaque anneau ci-dessous note à quel point une classe de produit livre complètement une capacité **telle que livrée aujourd'hui** - pas telle que promue - chaque classe étant notée sur son meilleur représentant. Lolly est noté avec le même couteau : il porte le seul anneau rouge du tableau, pour la maturité. Ouvre le nom d'une ligne pour voir le raisonnement derrière ses scores. Les colonnes sont triées par la ligne Complétude globale en haut - la moyenne des lignes notées, la ligne dépense exclue.

::: figure positioning-comparison
Exhaustivité des fonctionnalités des outils créatifs actuels, étudiée en août 2026. Notation : 0 absent, 25 solution de contournement, 50 réel mais restreint ou partiel, 75 solide avec réserves, 100 compétence de base.
:::

**Notes sur la notation.** Les scores de Lolly supposent que ses affirmations publiées tiennent, ce qui explique pourquoi la maturité est son seul anneau rouge : pilote fermé, durcissement de sécurité en cours, rien d'audité pour l'instant. La recherche a déplacé plusieurs cellules.

Canva est noté sur son meilleur membre de famille par ligne, puisqu'il possède Affinity et Cavalry (tous deux offerts en octobre 2025). Le rendu hors ligne et sur l'appareil obtient 75 grâce à Affinity - une suite de bureau qui exige toujours un compte vérifié et porte de la télémétrie, la même déduction qu'Adobe subit - tandis que le mode hors ligne propre de Canva n'édite que des créations pré-synchronisées, un seul appareil, fenêtre limitée. L'autofill obtient 50 : réel mais réservé à l'Enterprise, asynchrone, texte et image seulement. La génération de masse de Figma est passée de 25 à 50 quand Buzz a livré le remplissage de feuille de calcul (bêta gratuite, août 2026).

Une règle gouverne le tableau : Complet (100), sur les lignes qui touchent ton contenu ou ton identité, exige une capacité utilisable sans compte et sans précondition cloud ; les lignes décrivant le produit lui-même (maturité, facilité d'usage) en sont exemptées. Cela coûte à Adobe sur la provenance : le C2PA le plus large livré (Photoshop, Lightroom, Premiere, Firefly) signe localement et dans le cloud, mais jamais sans compte et identité Adobe, d'où 75. Cela plafonne aussi les API de rendu sur la génération de masse et l'automatisation, pour la même raison.

Le 75 de Lolly en provenance reflète la signature hors ligne sur l'appareil : plus solide architecturalement mais non auditée, et une clé d'appareil se lit comme non vérifiée dans les validateurs standards tant qu'une identité ou l'AC propre d'une organisation ne s'en porte pas garante. Le 50 de Penpot vient du plugin officiel Lolly Export : la même signature du moteur, opt-in, déclarée comme celle de Lolly. Penpot porte aussi le seul anneau hors échelle du tableau, 90 en rendu sur l'appareil - canvas navigateur, sauvegarde vers ton propre cloud souverain (même un ordinateur portable), export privé ; seul le saut serveur le sépare de Lolly. Cloudinary obtient sa propre colonne : un pipeline média (DAM, API de transformation, CDN), et la seule colonne cloud livrant du C2PA (50, car fl_c2pa signe à la livraison, attestant « livré par Cloudinary », pas « fait par toi »).

La collaboration en direct fonctionne dans l'autre sens : Figma fixe la référence d'échelle (200 éditeurs) et le P2P pairwise, air-gapped de Lolly obtient Partiel. Le prix est une estimation, indiquée comme telle : arithmétique au prix catalogue sur des mélanges de sièges réalistes, volontairement large, pour l'échelle et non pour l'achat. Les API de rendu obtiennent 75 sur les contraintes : modèles verrouillés, pas de couche de gouvernance de marque.

L'écart : rien de livré aujourd'hui n'est à la fois axé contraintes en premier et hors ligne, sans compte et sans serveur dans le chemin de rendu, et personne n'a copié la clause du compte. Lolly livre désormais son propre canvas ouvert - **Design**, un canvas libre à manipulation directe - mais les couleurs, la typographie et les ressources qu'on y trouve se conforment aux globales de la marque, donc même l'arrangement libre reste axé contraintes en premier.

Ce que Lolly n'est **toujours pas**, c'est une suite de design sans contraintes ; les designers continueront d'utiliser Illustrator et Figma pour le travail sur mesure - et quand ce travail doit devenir un actif gouverné et reproductible, [Importer un design](/info/design-import.html) de l'outil Design amène le fichier Figma, Penpot, Illustrator, InDesign ou PDF terminé sur le canvas sous forme de boîtes éditables et conformes à la marque.

![Le canvas libre de Design, où les couleurs, les polices et les ressources proposées sont celles de la marque](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## À utiliser pour

- La génération rapide d'actifs créatifs opérationnalisés (tuiles d'événement, badges, signatures, alertes)
- L'arrangement libre sur le canvas ouvert (Design) quand les éléments - couleurs, typographie, icônes, images - doivent rester conformes aux globales de la marque
- L'intégration d'un design Figma, Penpot, Illustrator, InDesign ou PDF terminé (Importer un design de l'outil Design) pour qu'il puisse être édité, gouverné et re-rendu de façon déterministe dans chaque format Lolly
- Les flux « un vers plusieurs » du type « remplis trois champs, obtiens l'actif fini » - y compris les traitements en masse depuis une feuille de calcul/CSV dans la grille de traitement par lots `/pro` (colle ou importe des lignes, un actif fini par ligne, télécharge sous forme de zip)
- Les sorties de marque toujours actives et récurrentes
- Les cas où le contrôle central de l'expression de marque compte plus que la flexibilité expressive

Deck Studio est une bonne mesure du plafond ici : tout un diaporama déclaré comme des données, mis en page en direct sur le canvas et exporté comme un PowerPoint natif éditable.

![Deck Studio en vue scindée - les diapositives du diaporama listées comme des blocs à gauche, le diaporama mis en page rendu à droite](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## À ne pas utiliser pour

- Le contenu vedette sur mesure ou phare (panneaux publicitaires, vidéos majeures)
- Le travail de campagne unique qui a réellement besoin d'un designer
- L'idéation qui doit échapper entièrement au système de marque - le canvas ouvert de Lolly conforme toujours les couleurs, la typographie et les ressources aux globales de la marque, et c'est bien le but

## Innover de façon probabiliste, passer à l'échelle de façon déterministe

La plupart des discours « créatif IA » placent le modèle du mauvais côté d'une vieille ligne. Les scribes et les enlumineurs avaient déjà réglé la question de savoir où elle tombe : tu travailles librement sur l'esquisse, où tout peut être tenté et rien n'est engagé, puis tu passes à la presse d'imprimerie, qui intimide justement parce qu'elle engage. Les esquisses, c'était là qu'était l'art. La presse, c'était comment il voyageait. Deux instruments, deux rôles, chacun inventif à sa façon, et l'œuvre imprimée pouvait être digne de confiance parce que la presse tenait sa promesse à chaque tirage.

Lolly est la presse, pas l'esquisse. Apporte ce que tu veux à l'idéation - un modèle, un designer, un coin de nappe - mais dès qu'une idée doit devenir dix mille actifs, elle passe par quelque chose qui rend le même résultat à chaque fois, à partir d'entrées que n'importe qui peut relire. C'est de cela que parle vraiment la comparaison ci-dessus : pas qui a le meilleur générateur, mais qui rend reproductible l'étape engagée.

> Fais confiance au processus créatif, passe à l'échelle avec rigueur.

## Approuve l'outil, pas le fichier

Tout autre outil sur le marché produit un *fichier* qui doit ensuite être vérifié - un responsable de marque dans un fil Slack, le service juridique pour la clause de non-responsabilité, une série de retouches, une nouvelle relecture. Lolly déplace l'approbation **une étape en amont**. Les règles de marque - codes hexadécimaux exacts, polices sous licence, marges de fond perdu, espacement - sont codées en dur dans le HTML et le CSS de l'outil, si bien que le gabarit *ne peut pas* produire un rendu hors marque. C'est la mise en page elle-même qui fait respecter les règles.

Tu arrêtes donc d'approuver des rendus et tu commences à approuver l'**outil** qui les produit. Approuve-le une fois, et chaque rendu qu'il produira sera pré-approuvé par construction - aucun humain dans la boucle, aucun cycle de relecture, quel que soit le volume.

C'est le changement que le moteur déterministe apporte réellement : ce n'est pas une version plus rapide de l'ancien processus d'approbation, c'est la suppression du processus. Pour l'équipe créative, c'est un garde-fou, pas un remplacement - tu lances toujours la balle (les données, le texte, l'image) et le code est la rambarde qui empêche chaque lancer de finir dans la gouttière.

![Tout le travail du producteur : taper les mots. La typo, la couleur et l'espacement ont été fixés au moment où l'outil a été approuvé](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Approuver les rendus à l'ancienne | Approuver l'outil, à la façon Lolly |
|---|---|
| Chaque fichier fini est vérifié, un par un | L'outil est vérifié une seule fois |
| Demande → le designer construit → relecture de marque → vérification juridique → retouches → nouvelle relecture | Un paramètre change → rendu fini |
| Designer, responsable de marque, juridique et demandeur tous dans la boucle | Le producteur, seul |
| Des jours par rendu | Des secondes par rendu |
| 10 000 rendus = 10 000 cycles de relecture | 10 000 rendus = zéro (le gabarit était déjà approuvé) |

## Ce que cela apporte, et rien d'autre

- **Un potentiel créatif audacieux livré en toute sécurité, en contexte.** Les outils peuvent exprimer des idées de design audacieuses à l'intérieur de garde-fous codés en dur.

- **Une automatisation de contenu définie par logiciel qui renvoie le rendu final.** Entrée → fichier final. Pas de "maintenant, exporte-le depuis ton outil de design et post-traite-le".
- **Les outils composent des outils.** Un outil peut intégrer le rendu d'un autre outil et le renvoyer comme partie d'un seul rendu fini, sans aucun couplage de code entre outils - une capacité qu'aucun produit de canevas ouvert ou de gabarits DAM sur le marché n'offre.
- **Neutralité vis-à-vis des fournisseurs.** Contrôle total des fonctionnalités et des coûts. Moteur open source. Les outils et les rendus sont du contenu suivi par git, pas enfermés dans une base de données SaaS.

Le premier de ces points est celui que l'on sous-estime le plus. Un plan de ville de qualité affiche, dessiné en véritables tracés vectoriels de routes et de cours d'eau, à partir d'un menu déroulant et de deux champs de couleur qui ne peuvent pas être orientés hors marque :

![Les anneaux de canaux et le réseau routier d'Amsterdam dessinés d'un bord à l'autre dans l'encre propre de la marque, chaque trait placé par le gabarit plutôt qu'à la main](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Souveraineté des contenus

Il y a un nom pour ce vers quoi tend la section précédente : la souveraineté. Ton pipeline de médias tourne sur du matériel que tu possèdes. Ta marque - les tokens, les polices, les logos, les outils qui les font respecter - vit dans des fichiers que tu détiens, dans un système de gestion de versions que tu contrôles, pas dans la base de données d'un fournisseur avec un bouton d'export. Le rendu se fait sur l'appareil devant toi, si bien qu'un rendu n'a jamais besoin de transiter par un tiers pour exister, et tout le chemin de l'entrée au fichier final est open source et inspectable. Si tous les fournisseurs de design SaaS disparaissaient demain, un déploiement Lolly ne s'en apercevrait pas.

Cela compte pour quiconque dont le travail devrait survivre à un abonnement : le parent dont l'album photo vit sur cet ordinateur portable autant que l'organisme public dont la bibliothèque de marque relève des règles de marchés publics. Pour les organisations - organismes publics, secteurs réglementés, quiconque dont la marque est un actif stratégique plutôt qu'une décoration - "où vit notre contenu et qui peut le couper" est une question de gouvernance, pas une préférence. Ici, la souveraineté est une propriété de l'architecture plutôt qu'une fonctionnalité d'hébergement ajoutée pour la conformité, et les pages [Politique de confidentialité](/info/privacy.html) et [Vérifie-le toi-même](/info/verify-yourself.html) existent pour que tu puisses vérifier cette affirmation plutôt que la croire sur parole.

Sous tout cela se trouve une seule promesse, formulée comme un engagement plutôt que comme une fonctionnalité : **si ça se rend sur ton appareil, c'est gratuit pour toujours.** Le moteur, les shells, les outils, les formats - tout le parcours créatif sur l'appareil est open source et le reste. Cette promesse a un mécanisme : une version qui a été publiée est sous licence de telle sorte qu'elle ne peut pas être reprise, et il n'existe aucun accord de contribution qui pourrait reconcéder le travail sous une autre licence plus tard. Toute la frontière tient en une phrase : tout ce qui se rend sur ton appareil est libre et open source, pour toujours ; coordonner les personnes et les machines sur un réseau est le travail d'un plan de contrôle distinct, [lolly.work](https://lolly.work).
