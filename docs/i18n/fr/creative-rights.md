# Droits créatifs et crédits

Tu devrais pouvoir utiliser un bon travail fait par d'autres sans devenir expert en licences, et sans oublier discrètement les personnes qui l'ont fait. Lolly garde donc la source de chaque œuvre qu'il utilise, lit la licence enregistrée pour elle, détermine ce que cette licence demande pour l'usage que tu en fais réellement, fait la partie qu'un programme peut faire et te dit la partie que toi seul peux faire.

Rien de tout cela n'est un conseil juridique, et rien n'est une décision sur ton projet. Lolly consigne des faits, applique un petit ensemble de règles lues dans les textes juridiques mêmes des licences et montre son raisonnement. Une licence avec conditions est un choix normal et permis. Elle n'est jamais présentée comme une ressource défectueuse.

## Où tu rencontres cela

Les jeux d'emoji sont le cas courant. Twemoji est sous CC BY 4.0, donc un titre contenant un emoji s'exporte avec l'illustration créditée et sans rien à faire de ta part. Les deux jeux OpenMoji sont sous CC BY-SA 4.0, donc recolorer l'un de leurs glyphes avec un traitement de marque est une adaptation, et partager cette adaptation te demande de choisir une fois une licence compatible. Fluent (MIT), Noto et Blobmoji (tous deux Apache 2.0) sont aussi enregistrés, et chacun se résout selon sa propre licence relue.

Choisir un jeu n'est jamais bloqué, et le contrôle du jeu montre la licence là où tu choisis. Les mêmes règles répondent pour une illustration de catalogue, une LUT, une police et toute autre œuvre consignée.

## Trois faits, gardés séparés

« CC BY 4.0 », « cet usage nécessite un crédit » et « le crédit est dans le fichier que tu viens de télécharger » sont trois affirmations différentes, et Lolly les garde séparées :

- **Les preuves** sont ce qu'une source a déclaré, consigné tel qu'il a été trouvé, avec qui l'a dit et où il a été lu. Un import ultérieur n'écrase jamais un enregistrement antérieur.
- **L'obligation** est ce que les règles relues font de ces preuves pour un usage, une voie de livraison et un public. Les conditions qui s'appliquent au partage restent conditionnelles tant que tu travailles en privé.
- **La livraison** est ce que les octets terminés portent réellement, mesuré en les relisant. Lolly ne dit que les crédits sont inclus qu'après qu'un lecteur les a trouvés dans le fichier livré.

![Les preuves de source consignées et l'usage choisi alimentent les règles relues. L'export prépare les crédits, puis une vérification de livraison relit les octets terminés pour dire quels crédits ont été trouvés ou sont encore nécessaires.](/info/diagrams/concepts/rights-evidence-to-delivery.svg)

## Ce que tu vois, et quoi faire

Les mêmes mots apparaissent dans le panneau d'export, Verify, la ligne de commande et le résultat machine, à peu près par ordre de fréquence de rencontre.

| Ce que tu vois | Ce que cela signifie |
|---|---|
| Source credits will be included. | Le crédit est préparé et la voie peut porter le crédit. Rien n'a encore été écrit, donc ce n'est pas un message de succès. |
| Credits included in this file's metadata. | Les octets livrés ont été relus, le credential vérifié et chaque source requise a été trouvée dans le credential. |
| Credits and credentials are in the download package. | Le crédit voyage comme fichier d'accompagnement avec l'artefact. Garde-les ensemble quand tu les transmets. |
| If you share this adaptation, it needs a compatible licence. | Une source ShareAlike a été modifiée et le résultat va ailleurs que vers un usage privé. Choisir est une seule action, pas une boîte de dialogue par emplacement. |
| Add this credit to the post description. | La voie choisie ne porte ni credential ni crédit lisible, donc le texte du crédit est à coller par toi. |
| No required credit under the recorded CC0 dedication. | La dédicace ne demande rien. Un crédit de courtoisie est proposé quand même. |
| Source licence not recorded. | Rien n'a été consigné pour cette source. C'est une lacune à combler, pas un constat contre l'œuvre. Ce n'est jamais une preuve que l'œuvre peut être transmise librement. |
| Conditions recorded, not yet interpreted. | L'identifiant est reconnu et ses conditions sont listées, et aucune règle ici ne les lit. Pas de validation automatique, pas d'interdiction automatique. |
| Two licence declarations disagree. | Deux enregistrements nomment des licences différentes et rien n'a choisi quelle concession s'applique. |
| The credits are not in the file that was delivered. | Un crédit était promis, la relecture ne l'a pas trouvé et le fichier reste à toi. Exporte de nouveau, ou utilise le texte du crédit à la main. |

Lolly ne dit jamais « copyright verified », « legally safe », « fully cleared » ni « rights cleared », et il n'y a nulle part dans le produit de badge de licence vert unique. Ces mots prétendraient quelque chose qu'aucun programme ne peut vérifier.

## Ce qui reste à toi

- **Ton choix de licence t'appartient.** Revendiquer un fichier sépare trois états qui n'en faisaient qu'un : aucune licence publique déclarée, une mention explicite de tous droits réservés et une vraie concession de licence publique. Lolly n'écrit une ligne de droits que pour les deux derniers, et jamais à partir de ton profil.
- **Ton travail n'est pas relicencié à ta place.** Les conditions d'une source et ta propre déclaration de sortie sont des enregistrements distincts. Une condition ShareAlike s'applique à l'adaptation qu'elle régit, pas automatiquement à tout le reste de ce que tu as créé.
- **Le travail privé reste utilisable.** Les conditions qui s'appliquent au partage sont soulevées quand le partage est en vue. Rien ici ne devient une interdiction d'import, et aucun questionnaire de licence ne se dresse entre toi et tes propres fichiers.
- **Une décision est retenue par rapport à ses propres faits.** Chaque choix que tu consignes est marqué d'une empreinte des œuvres, usages, voie et public concernés. Change le jeu, le traitement, le format ou le public et la question est reposée. Il n'y a pas d'interrupteur général « ignorer les licences », car faire disparaître un avertissement d'un clic ne peut ni livrer un crédit ni accorder une permission.
- **Tes informations restent distinctes du crédit d'un tiers.** Retirer tes propres métadonnées personnelles ne retire pas un artiste crédité, et un crédit requis n'est jamais une excuse pour exporter tes coordonnées.

## Ce que Lolly fait à chaque endroit

- **Dans le catalogue.** La fiche d'une œuvre montre sa source et son créateur, le nom canonique de la licence avec le libellé d'origine conservé dessous, un crédit copiable là où il est consigné et une ligne disant ce que son utilisation demande. Une tuile énonce l'exigence ; elle ne prétend jamais qu'un export a été terminé.
- **Dans le panneau d'export.** Une carte Source credits apparaît dans Content protection dès qu'un rendu utilise une œuvre consignée, à côté de la Licence que tu choisis pour ton propre export. Elle montre l'état, le texte du crédit derrière Details, un bouton Copy credit et une carte en ligne quand une décision est due. Une décision n'est jamais une boîte de dialogue bloquante : un téléchargement avec une action en suspens se poursuit.
- **Dans le fichier.** Un export qui a placé une œuvre consignée écrit un ingrédient source de Content Credentials par œuvre distincte, lié aux octets d'origine à leur adresse publique, et portant le créateur, la licence et son lien, la source, la révision et les modifications. Lolly signe ce qu'il a observé. Il ne signe jamais une déclaration au nom de l'artiste d'origine, et Verify dit lequel des deux s'est produit.
- **Dans un paquet.** Un téléchargement qui ne peut pas contenir de credential, comme une animation `.lottie`, porte les crédits sous forme de `CREDITS.txt` et `credits.json` à l'intérieur du paquet. Ils sont relus après l'écriture, et aucun credential signé n'est revendiqué pour eux.
- **Après l'écriture.** Les octets livrés sont relus avant que quoi que ce soit dise que les crédits sont inclus. Un credential qui n'a pas été vérifié ne compte pas comme un crédit livré.
- **Dans un fichier `.lolly` modifiable.** Les octets ne voyagent que lorsqu'une licence relue consigne la permission de transmettre la source. Le `CREDITS.txt` du pack liste ce qui a voyagé, sous quelle licence et ce qui a été retenu avec la raison. Une licence non consignée est retenue. Tu peux quand même inclure délibérément du contenu retenu, et le fichier de crédits consigne que c'était ton choix.
- **Dans Verify.** Un panneau Sources liste chaque source qu'un fichier consigne, avec un résumé calculé, le crédit, un bouton Copy credit, un lien Open source qui ne s'ouvre que sur ta demande et les limites déclarées de ce qui a été inspecté. Une question Check for this use n'apparaît que lorsque tu choisis un usage, et rien n'est récupéré pour y répondre.
- **Quand tu retires des métadonnées.** Le nettoyage te dit combien de crédits de sources le fichier ne porte plus, propose le texte du crédit et propose un fichier propre avec les crédits dans un fichier séparé. Les octets nettoyés ne sont jamais réestampillés.

::: details Les licences que Lolly a relues
Version des règles `rights-rules-2026-09-13.2`. Chaque règle a été lue dans le texte juridique propre de la licence, et la section dont elle vient est citée ici et à côté de la règle dans `engine/src/rights-profiles.ts`. Une version et un port sont conservés tels que consignés : une déclaration CC BY 3.0 garde sa propre version au lieu d'être déclarée en 4.0 parce que le sélecteur de l'application préfère la 4.0.

| Licence | Ce qu'elle demande pour un usage que Lolly peut faire | Lu dans |
|---|---|---|
| CC BY 4.0 | Le créateur, le titre, la mention de droit d'auteur, le nom et le lien de la licence, le lien de la source et une indication des modifications, chacun lorsque la source en a fourni un. Aucun usage n'est exclu, usage commercial compris. | [Code juridique](https://creativecommons.org/licenses/by/4.0/legalcode.en), sections 2(a)(1) et 3(a) |
| CC BY-SA 4.0 | Le même crédit. En outre, si tu partages une adaptation, elle sort sous une licence compatible : CC BY-SA 4.0, la Free Art License 1.3 ou GPL-3.0-or-later, qui ne fonctionne que dans un sens. Ces trois sont portées sous forme de données depuis la liste de Creative Commons, jamais appariées par nom. | [Code juridique](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), sections 3(a) et 3(b) ; la [liste des licences compatibles](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Rien. La dédicace ne porte aucune condition, donc Lolly propose un crédit de courtoisie et n'en présente jamais un comme requis. | [La dédicace](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), sections 2 et 3 ; la [FAQ CC](https://creativecommons.org/faq/) sur le crédit |
| CC-PDDC | Rien. Ce qui est consigné, c'est l'assertion elle-même et qui l'a faite, car une certification est la déclaration d'une partie et non une preuve. | Les paragraphes de [la dédicace et de la certification](https://creativecommons.org/licenses/publicdomain/) |
| Apache License 2.0 | Les mentions de la source et le texte d'attribution du fichier NOTICE voyagent avec une œuvre distribuée. Un usage à l'exécution ne demande rien. Une licence qui demande un texte de mention et une œuvre qui n'en porte aucun sont signalées comme une lacune. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), section 4, conditions 1 à 4 |
| MIT | La ligne de droit d'auteur et la mention de permission voyagent avec les copies et les parties substantielles. Les usages à l'exécution et de référence ne demandent rien. | [MIT](https://opensource.org/license/mit), la condition de mention de permission |
| SIL OFL 1.1 | Rendre du texte avec la police ne demande rien sur le texte. Transmettre le fichier de police porte la licence, la mention de droit d'auteur et la règle du nom réservé. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), conditions 2, 3 et 5 ; la [FAQ OFL](https://openfontlicense.org/ofl-faq/) sur les documents |

**Consigné, non interprété.** CC BY-NC, CC BY-ND et les combinaisons NC-SA et NC-ND sont reconnues, leurs conditions sont listées et aucune règle ici ne les lit. Elles rapportent `licence.unknown` avec une ligne qui nomme les conditions. Un contexte commercial ne peut pas se lire à partir d'un prix ou d'un compte, et chaque texte combiné exige sa propre relecture avant qu'une règle le lise.

Trois réponses honnêtes de plus, dont aucune n'est une permission :

- Un identifiant `LicenseRef-` revient tel quel. Il pointe vers une définition stockée et n'est jamais propriétaire à cause de son orthographe.
- Une déclaration que rien ne reconnaît revient non analysée, et le texte d'origine est conservé.
- `A OR B` est un choix que le titulaire des droits a offert, donc chaque alternative est renvoyée et aucune n'est choisie. `A AND B` est cumulatif, et ces règles l'enregistrent plutôt que de lire deux profils ensemble.
:::

::: details En ligne de commande et via MCP
Un rendu affiche un bloc `Rights:` sur la sortie d'erreur standard quand l'évaluation comporte un crédit requis ou un problème. Il porte le statut, une ligne par problème sous la forme `code - summary`, ce que le fichier livré a été relu comme et le texte du crédit à coller.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Ici le crédit est dans le fichier, et une décision de licence reste due avant que le fichier soit partagé. Le fichier est écrit dans les deux cas.

| Statut | Signification | Sortie |
|---|---|---|
| `ready` | Rien n'attend une personne. | 0 |
| `actions-required` | Une décision reste à prendre avant que le fichier ne soit partagé. Le fichier est quand même écrit. | 4 |
| `use-not-covered` | Une règle examinée dit que la licence ne couvre pas cet usage. | 4 |
| `unknown` | Les seuls problèmes sont des lacunes : une licence qui n'a pas été enregistrée, ou des conditions qui ne sont pas interprétées. | 0 |
| `delivery-failed` | Défini par un accusé de réception, jamais par une évaluation : un crédit promis n'a pas été trouvé dans les octets livrés. Le panneau d'export l'affiche ; le CLI rapporte le même fait dans sa ligne de relecture à la place. | non affiché |

Exit 4 est le code que cette CLI donne déjà quand une vérification protectrice dit non. Ce n'est pas 3, qui signifie « réessayer sur un autre exécuteur », car une décision de licence attendra sur chaque exécuteur qui existe.

`--rights=private` déclare que ce rendu n'est livré à personne. Le bloc s'affiche quand même et le crédit est toujours là à copier ; ce qui se retire, c'est la condition qui s'applique au partage, et aucune affirmation de livraison n'est enregistrée. Il n'y a pas d'option pour ignorer une condition : `--rights=ignore` est une erreur d'utilisation.

Les codes de problème sont stables et lisibles par machine, indépendants du texte traduit : `attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Via MCP, `lolly_verify` renvoie une charge `rights` avec le résumé, une ligne par source consignée et les limites déclarées. Un `lolly_render` sans navigateur renvoie `status`, `issues`, `credits`, `fingerprint` et un indicateur `creditsInFile` mesuré en relisant les octets.
:::

::: details Où vivent les règles
Cinq modules du moteur, tous purs : pas de réseau, pas d'horloge, pas de système de fichiers. Les données des règles sont versionnées et dans le dépôt, jamais récupérées.

| Module | Ce qu'il contient |
|---|---|
| `engine/src/rights-profiles.ts` | La table des identifiants, le lecteur minimal d'expressions SPDX, les profils relus avec leurs citations et l'unique règle pour un lien qu'un crédit peut imprimer. |
| `engine/src/rights-evaluate.ts` | La classification, les problèmes, le plan d'attribution et l'empreinte. Déterministe : les mêmes faits dans un ordre différent donnent la même réponse. |
| `engine/src/rights-attribution.ts` | Les crédits lisibles, les fichiers d'accompagnement, les ingrédients sources et le reçu mesuré après l'écriture. |
| `engine/src/rights-companion.ts` | La relecture des crédits de paquet (`CREDITS.txt` et `credits.json` dans un téléchargement à base de ZIP), qui confirme les crédits sans revendiquer de credential signé. |
| `engine/src/rights-report.ts` | Un credential vérifié relu sous forme des trois questions que pose Verify. |

Les fichiers d'attentes dans `tests/fixtures/rights/` ont été écrits à partir des textes des licences plutôt que de la sortie de l'évaluateur, et leur README cite la section derrière chaque attente.
:::

## Ce que cela ne fait pas encore

- **Aucune destination n'est confirmée.** Lolly prépare une légende. Un connecteur qui accepte une requête n'est pas la preuve qu'un crédit a atteint un lecteur, et rien ici ne promet qu'un envoi, une capture d'écran ou un transcodage ultérieur conserve les métadonnées cachées.
- **Les champs natifs de crédit dans les métadonnées ne sont pas écrits à partir du plan.** Les crédits voyagent dans les Content Credentials et dans du texte lisible. Les champs de crédit par source d'IPTC et XMP ne sont pas encore remplis à partir du plan d'attribution.
- **Les corrections et le retrait ne sont pas construits.** Ajouter un créateur manquant ou une correction locale à une œuvre consignée, et retirer un enregistrement, n'ont pas d'interface.
- **Les fournisseurs connectés ne sont pas construits.** Les images de stock achetées, une permission personnalisée et un compte de fournisseur n'ont pas de chemin d'import, donc leurs concessions ne peuvent être consignées que comme ta propre déclaration.
- **La politique d'organisation n'est pas combinée à ces résultats.** La politique d'export et les conditions de licence sont séparées aujourd'hui, et l'approbation d'une organisation n'est pas la permission d'un titulaire de droits.
- **Plusieurs voies de livraison ne sont pas encore sur ce chemin.** Télécharger un original du catalogue, un ZIP en masse, Send et Copy image n'évaluent ni ne portent encore ces crédits. Un recadrage, un étalonnage de couleur, une copie encadrée, une conversion Download as et un montage vidéo le font : une source avec une licence consignée et sans Content Credentials propres voyage comme ingrédient source non signé avec son crédit, une LUT est créditée sous sa propre licence et jamais comme celle de l'image, et un fichier qui ne peut pas porter un crédit que sa source demande n'est pas enregistré. Rien ne relit encore ces fichiers, donc leurs crédits sont écrits, pas confirmés. Retouch, la suppression de fond et l'agrandissement d'une seule image, et l'extraction audio ne conservent que le credential propre d'une source.
