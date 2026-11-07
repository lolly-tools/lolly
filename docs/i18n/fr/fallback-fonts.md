# Polices de repli

Les polices d'un design system ne couvrent souvent qu'une partie des écritures du monde. Lolly Demo compose les titres en Outfit et le texte en SUSE, et aucune des deux n'a de lettres cyrilliques, grecques, arabes, hébraïques, devanagari, bengalies, thaïes, chinoises, japonaises ou coréennes. Quand un document contient des lettres que les polices de son design system ne savent pas dessiner, Lolly les dessine avec une police Noto ouverte, de sorte que l'export les garde en tracés vectoriels au lieu de transformer les mots en image.

Les polices du design system passent toujours en premier, dans l'ordre où le design system les liste. Outfit n'a pas de lettres vietnamiennes, donc un titre vietnamien les prend à SUSE, la police suivante dans la liste de Lolly Demo. Une police de repli ne dessine que les caractères qu'aucune de ces polices ne sait dessiner : une police de marque garde donc chaque lettre, chiffre et signe qu'elle possède, même à l'intérieur d'un mot dans une autre écriture. Une police de marque qui a un caractère chinois garde aussi ce caractère.

## Ce qui est inclus

Quinze polices, toutes issues de Google Fonts à un commit figé et toutes sous la SIL Open Font License 1.1. Chaque fichier est indiqué avec sa taille de téléchargement.

| Écriture | Police | Version | Téléchargement |
|---|---|---|---|
| Arabe, y compris les lettres ourdoues et persanes | Noto Sans Arabic | 2.012 | 206 KB |
| Hébreu | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, népalais) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengali | Noto Sans Bengali | 3.011 | 136 KB |
| Thaï | Noto Sans Thai | 2.002 | 61 KB |
| Cyrillique | Noto Sans, lettres cyrilliques | 2.015 | 112 KB, italique 129 KB |
| Grec | Noto Sans, lettres grecques | 2.015 | 75 KB, italique 81 KB |
| Latin, y compris le vietnamien et d'autres lettres accentuées | Noto Sans, lettres latines | 2.015 | 309 KB, italique 342 KB |
| Chinois simplifié, les caractères GB 2312 | Noto Sans SC | 2.004 | 1,9 MB |
| Chinois traditionnel, les caractères Big5 | Noto Sans TC | 2.004 | 3,6 MB |
| Japonais, les caractères Shift_JIS | Noto Sans JP | 2.004 | 2,1 MB |
| Coréen, toutes les syllabes hangeul et les caractères KS X 1001 | Noto Sans KR | 2.004 | 2,4 MB |

L'axe de graisse de chaque police est conservé en entier, donc chaque graisse qu'un design demande se dessine, et un titre chinois, japonais ou coréen en gras est bien en gras. L'axe de chasse des polices Noto Sans est fixé sur normal, ce qui divise chaque fichier par deux ; les polices chinoise, japonaise et coréenne n'ont pas d'axe de chasse. Noto Sans est découpée par écriture, donc un mot cyrillique ne télécharge que les lettres cyrilliques. Les contours sont ceux d'origine, inchangés.

Les polices vivent dans un seul dossier partagé, `community/fallback-fonts`, servi à chaque design system depuis `/catalog/packs/fallback-fonts/`, comme les jeux d'emoji sont partagés. `scripts/import-fallback-fonts.ts` construit les fichiers à partir des polices d'origine figées dans `scripts/data/fallback-fonts.json`, vérifie chaque fichier d'origine par rapport à son SHA-256 enregistré et écrit les textes de licence à côté des polices.

## Chinois, japonais et coréen

Une police chinoise, japonaise ou coréenne complète pèse de 9,6 MB à 17,8 MB, donc chacune de ces polices est réduite au jeu de caractères national que ses lecteurs utilisent chaque jour, plus la ponctuation, les kana, les formes pleine chasse et les symboles du texte courant :

- Chinois simplifié : GB 2312, les 6 763 hanzi courants et ses symboles, 7 522 caractères au total.
- Chinois traditionnel : Big5, ses 13 053 hanzi et ses symboles, 13 629 caractères au total. Le Hong Kong Supplementary Character Set n'est pas inclus.
- Japonais : Shift_JIS tel que Windows et le web le lisent, c'est-à-dire JIS X 0208 avec les ajouts NEC et IBM dont des noms comme 髙 et 﨑 ont besoin, tous les kana et les katakana demi-chasse, 7 432 caractères au total.
- Coréen : les 11 172 syllabes hangeul et KS X 1001, avec ses 4 888 hanja, 17 082 caractères au total.

Les lettres latines, grecques et cyrilliques sont exclues de ces quatre polices, parce que les polices du design system et celles ci-dessus les dessinent. Les jeux sont lus dans les fichiers d'index de l'Encoding Standard à un commit figé, donc une reconstruction donne les mêmes fichiers.

Le chinois, le japonais et le coréen partagent la plupart de leurs caractères, mais chacun en dessine beaucoup de façon différente. Le même caractère 直 s'écrit d'une façon en chinois et d'une autre en japonais. Un passage de texte prend donc tous ses caractères partagés dans une seule de ces polices, jamais deux, et Lolly choisit cette police dans cet ordre :

1. La langue du passage, d'après le `lang` de son élément ou de l'élément le plus proche qui l'entoure dans le document. Le réglage de langue d'un outil, comme la Langue du certificat, la définit. La langue de l'interface de Lolly et celle du design system ne comptent pas, donc un document s'exporte de la même façon pour tout le monde.
2. L'écriture du passage : les kana indiquent le japonais et les hangeul le coréen. Quand le passage n'a ni l'un ni l'autre, tout le document est lu, donc un titre en kanji seuls dans un document japonais est dessiné en japonais. Un document qui contient à la fois des kana et des hangeul ne tranche rien ici.
3. Un caractère que seul le chinois traditionnel utilise, comme 體 ou 說, dans le passage ou à défaut dans le document, signifie chinois traditionnel, sauf si le même texte en contient aussi un que seul le chinois simplifié utilise.
4. Sinon, chinois simplifié.

Un caractère que la police choisie n'a pas n'est jamais pris dans l'une des trois autres. Il reste une image, comme décrit plus bas. Des kana ou des hangeul que la police choisie n'a pas, comme des mots coréens dans une ligne marquée japonaise, peuvent quand même venir de la police japonaise ou coréenne, mais seulement quand cette police ne dessinerait aucun caractère partagé de la ligne.

Sur la page, un canevas qui contient deux de ces langues liste les deux polices, et le navigateur dessine les caractères partagés avec la première. L'export dessine chaque passage avec la sienne.

## Quand une police se télécharge

Rien ne se télécharge tant qu'un document ne contient pas un caractère qu'aucune police de son design system ne sait dessiner. Un document en anglais, ou dans n'importe quelle langue que son design system couvre, ne télécharge jamais de police de repli. Un symbole dans une ligne en anglais, comme ★ ou ※, ne télécharge jamais de police chinoise, japonaise ou coréenne.

La première fois qu'un document en a besoin, Lolly télécharge cette seule police, pour cette seule écriture, et la garde sur ton appareil. Un document japonais télécharge uniquement la police japonaise, 2,1 MB, et un document en chinois traditionnel la police traditionnelle de 3,6 MB. Ensuite l'écriture se dessine hors ligne, et la police reste quand le catalogue est nettoyé. La police est conservée avec les propres fichiers du catalogue, jamais parmi les polices que tu as importées, donc elle n'apparaît pas dans la liste des polices de ta marque.

La ligne de commande, l'application de terminal et le serveur MCP lisent les mêmes fichiers sur le disque, donc ils n'ont aucun téléchargement à faire.

## Sur la page et dans l'export

La page utilise la même police de repli que l'export. Sans cela, un navigateur dessine ces lettres dans une police système alors que l'export utilise Noto, et une ligne qui en contient change de largeur entre les deux. Lolly ajoute la police de repli à la fin de la liste de polices du design system sur ce canevas seulement, après les propres polices du design system et avant toute police système. Un outil qui définit sa propre liste de polices, dans ses styles ou sur ses éléments, reçoit la police de repli au même endroit : après les polices que la liste donne et avant toute police système. Un canevas que le design system couvre garde sa liste de polices exactement comme avant.

La page laisse une liste de polices telle quelle quand elle commence par une police système, comme `system-ui` ou Helvetica, car l'export dessine ce texte avec les polices du design system et la page non.

Dans un PDF, les mots deviennent des tracés dessinés avec la police de repli, quel que soit le réglage de texte choisi, car le texte PDF actif ne peut pas porter une écriture que la police incorporée n'a pas. En SVG, EMF, EPS, DXF et WMF, ils deviennent des tracés chaque fois que le texte est converti en tracés ; avec le texte laissé actif, ce sont les polices du lecteur qui les dessinent, comme avant. Quand une police de repli a dessiné une partie d'un export, le panneau d'export affiche une note comme :

> Le texte japonais est dessiné avec Noto Sans JP, car les polices de ce design system n'ont pas ces lettres.

La ligne de commande affiche la même phrase sous forme de note.

## Ce qui reste une image

Un caractère hors des quatre jeux nationaux n'a pas de police de repli. Les caractères rares comme 𠮷, les caractères ajoutés pour Hong Kong par son jeu supplémentaire, et les écritures sans police de repli, comme le tamoul, l'éthiopien ou le syriaque, sont tous traités de la même façon. Dans un PDF, la ligne qui en contient un entre comme une image à 300 dpi, et le panneau d'export liste les écritures. Dans un SVG, le passage reste du texte actif, que les polices du lecteur dessinent.

## La vérification avant d'exporter

La carte **Before you export** de Lolly Design et les vérifications `render` de `lolly check` signalent le texte qu'aucune police ne sait dessiner. Elles comptent les polices de repli comme le fait un export, d'après les mêmes listes des caractères que chaque police possède, donc le texte qu'une police de repli dessine n'est pas signalé. Une écriture sans police de repli, comme le tamoul, et un caractère chinois, japonais ou coréen hors des jeux nationaux sont toujours signalés, car l'export les dessine comme une image ou comme du texte actif. La vérification lit ces listes dans le catalogue et ne télécharge aucune police.

## Licences et crédits

Chaque police de repli est sous la SIL Open Font License 1.1, et chaque entrée du catalogue consigne cette licence avec un hachage du texte de licence, donc les règles de droits de [Droits créatifs et crédits](/info/creative-rights.html) lisent la licence comme celle de n'importe quelle autre police. Les textes de licence se trouvent à côté des polices. Les fichiers Noto Sans ne déclarent aucun Reserved Font Name. Les polices chinoise, japonaise et coréenne sont celles d'Adobe et réservent le nom Source ; les fichiers réduits gardent leurs noms Noto, qui n'utilisent pas ce nom.

La licence dit que ses termes ne s'appliquent pas aux documents créés avec les polices. Un export ne contient que les contours dessinés des lettres qu'il utilise, comme pour les polices propres du design system, et Lolly n'ajoute aucun programme de police, aucune ligne de crédit ni aucune nouvelle entrée de content credential pour une police de repli.
