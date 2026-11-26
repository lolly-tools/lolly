# Polices de repli

Quand les polices d'un design system ne peuvent pas dessiner une lettre, Lolly la dessine avec une police libre Noto, pour que l'export garde la lettre comme contour vectoriel plutôt que comme image. Les polices de Lolly Demo, Outfit pour les titres et SUSE pour le texte, n'ont pas de lettres cyrilliques, grecques, arabes, hébraïques, devanagari, bengalies, thaïes, chinoises, japonaises ou coréennes.

Les polices du design system passent toujours en premier, dans l'ordre de leur liste. Outfit n'a pas de lettres vietnamiennes, donc un titre vietnamien les prend dans SUSE, la police suivante dans la liste de Lolly Demo. Une police de repli ne dessine que les caractères qu'aucune de ces polices ne peut dessiner. Une police de marque garde chaque lettre, chiffre et signe qu'elle possède, y compris les caractères chinois, même dans un mot d'une autre écriture.

<!--i:eti-package-->
## Ce qui est fourni

Quinze polices, toutes issues de Google Fonts à un commit fixé. Chaque fichier est présenté avec sa taille de téléchargement.

| Écriture | Police | Version | Téléchargement |
|---|---|---|---|
| Arabe, y compris les lettres ourdoues et persanes | Noto Sans Arabic | 2.012 | 211 Ko |
| Hébreu | Noto Sans Hebrew | 3.001 | 37 Ko |
| Devanagari (hindi, marathi, népalais) | Noto Sans Devanagari | 2.007 | 151 Ko |
| Bengali | Noto Sans Bengali | 3.011 | 139 Ko |
| Thaï | Noto Sans Thai | 2.002 | 62 Ko |
| Cyrillique | Noto Sans, lettres cyrilliques | 2.015 | 115 Ko, italique 132 Ko |
| Grec | Noto Sans, lettres grecques | 2.015 | 77 Ko, italique 83 Ko |
| Latin, y compris le vietnamien et les autres lettres accentuées | Noto Sans, lettres latines | 2.015 | 316 Ko, italique 350 Ko |
| Chinois simplifié, les caractères GB 2312 | Noto Sans SC | 2.004 | 2,0 Mo |
| Chinois traditionnel, les caractères Big5 | Noto Sans TC | 2.004 | 3,8 Mo |
| Japonais, les caractères Shift_JIS | Noto Sans JP | 2.004 | 2,2 Mo |
| Coréen, toutes les syllabes hangul et les caractères KS X 1001 | Noto Sans KR | 2.004 | 2,5 Mo |

Chaque police garde toutes les graisses de son axe de graisse, donc un titre chinois, japonais ou coréen en gras est bien en gras. L'axe de chasse des polices Noto Sans est fixé à la valeur normale, ce qui divise la taille de chaque fichier par deux. Les polices chinoises, japonaises et coréennes n'ont pas d'axe de chasse. Noto Sans est découpé par écriture, donc un mot cyrillique ne télécharge que les lettres cyrilliques. Les contours restent identiques à ceux de la source amont.

::: details Où se trouvent les polices et comment elles sont construites
Les polices se trouvent dans un dossier partagé, `community/fallback-fonts`, servi à chaque design system depuis `/catalog/packs/fallback-fonts/`, comme les jeux d'emoji. `scripts/import-fallback-fonts.ts` construit les fichiers à partir des polices amont fixées dans `scripts/data/fallback-fonts.json`, vérifie chaque fichier amont par rapport à son SHA-256 consigné et écrit les textes de licence à côté des polices.
:::

<!--i:eti-globe-->
## Chinois, japonais et coréen

Une police chinoise, japonaise ou coréenne complète fait de 9,6 Mo à 17,8 Mo. Chacune est réduite à son jeu de caractères national, avec la ponctuation, les kana, les formes pleine chasse et les symboles du texte courant :

- Chinois simplifié : GB 2312, les 6 763 hanzi courants et ses symboles, soit 7 522 caractères en tout.
- Chinois traditionnel : Big5, ses 13 053 hanzi et ses symboles, soit 13 629 caractères en tout. Le jeu de caractères supplémentaire de Hong Kong n'est pas inclus.
- Japonais : Shift_JIS tel que Windows et le web le lisent, soit JIS X 0208 avec les ajouts NEC et IBM nécessaires aux noms comme 髙 et 﨑, tous les kana et les katakana demi-chasse, soit 7 432 caractères en tout.
- Coréen : les 11 172 syllabes hangul et KS X 1001, avec ses 4 888 hanja, soit 17 082 caractères en tout.

Ces quatre polices omettent les lettres latines, grecques et cyrilliques, que dessinent les polices du design system et les polices ci-dessus. Les jeux proviennent des fichiers d'index de l'Encoding Standard à un commit fixé, donc une reconstruction produit les mêmes fichiers.

Le chinois, le japonais et le coréen partagent la plupart de leurs caractères mais en dessinent beaucoup différemment. 直, par exemple, s'écrit d'une façon en chinois et d'une autre en japonais. Un segment de texte prend tous ses caractères partagés dans une seule de ces polices, jamais deux. Lolly choisit cette police dans cet ordre :

1. La langue du segment, d'après le `lang` de son élément ou de l'élément qui l'entoure le plus proche dans le document. Le réglage de langue d'un outil, comme Language dans le certificat, la définit. La langue de l'interface de Lolly et celle du design system ne comptent pas, donc un document s'exporte de la même façon pour tout le monde.
2. L'écriture du segment : les kana indiquent le japonais et le hangul indique le coréen. Si le segment ne contient ni l'un ni l'autre, Lolly lit le document, donc un titre composé uniquement de kanji dans un document japonais est dessiné en japonais. Un document contenant à la fois des kana et du hangul ne permet pas de trancher à cette étape.
3. Un caractère utilisé uniquement en chinois traditionnel, comme 體 ou 說, dans le segment ou, à défaut, dans le document, indique le chinois traditionnel, sauf si le même texte contient aussi un caractère utilisé uniquement en chinois simplifié.
4. Sinon, le chinois simplifié.

Un caractère absent de la police choisie n'est jamais pris dans l'une des trois autres. Il reste une image. Des kana ou du hangul absents de la police choisie, comme des mots coréens dans une ligne marquée comme japonaise, peuvent tout de même provenir de la police japonaise ou coréenne, mais seulement si cette police ne dessinerait aucun caractère partagé de la ligne.

Sur la page, un canevas contenant deux de ces langues liste les deux polices, et le navigateur dessine les caractères partagés avec la première. L'export dessine chaque segment avec sa propre police.

<!--i:eti-download-->
## Quand une police se télécharge

Rien ne se télécharge tant qu'un document ne contient pas un caractère qu'aucune police de son design system ne peut dessiner. Un symbole dans une ligne en anglais, comme ★ ou ※, ne télécharge jamais de police chinoise, japonaise ou coréenne.

La première fois qu'un document a besoin d'une police de repli, Lolly télécharge cette seule police et la garde sur ton appareil. Un document japonais ne télécharge que la police japonaise, de 2,2 Mo, et un document en chinois traditionnel la police traditionnelle de 3,8 Mo. Dès lors, l'écriture se dessine hors ligne, et la police reste quand le catalogue est nettoyé. La police est conservée avec les fichiers du catalogue, jamais parmi tes polices importées, et n'apparaît pas dans la liste des polices de ta marque.

La ligne de commande, l'application de terminal et le serveur MCP lisent les mêmes fichiers sur le disque, donc ils n'ont besoin d'aucun téléchargement.

<!--i:eti-eye-->
## Sur la page et dans l'export

La page utilise la même police de repli que l'export, donc une ligne contenant ces lettres a la même largeur dans les deux. Sur ce seul canevas, Lolly ajoute la police de repli après les polices du design system et avant toute police système. Un outil qui définit sa propre liste de polices, dans ses styles ou sur ses éléments, reçoit la police de repli au même endroit. Un canevas couvert par le design system garde sa liste de polices inchangée.

La page laisse une liste de polices intacte quand elle commence par une police système, comme `system-ui` ou Helvetica, car l'export dessine ce texte avec les polices du design system alors que la page ne le fait pas.

Dans un PDF, les mots deviennent des contours dans la police de repli quel que soit le réglage du texte, car le texte actif PDF ne peut pas contenir une écriture absente de la police incorporée. Dans SVG, EMF, EPS, DXF et WMF, ils deviennent des contours chaque fois que le texte est converti en contours. Si le texte reste actif, les polices du lecteur le dessinent. Quand une police de repli a dessiné une partie d'un export, le panneau d'export affiche une note comme :

> Le texte japonais est dessiné avec Noto Sans JP, car les polices de ce design system n'ont pas ces lettres.

La ligne de commande affiche la même phrase comme note.

<!--i:eti-image-->
## Ce qui reste une image

Un caractère en dehors des quatre jeux nationaux, comme 𠮷 ou un caractère supplémentaire de Hong Kong, n'a pas de police de repli. Les caractères rares comme 𠮷, ceux ajoutés pour Hong Kong par son jeu supplémentaire et les écritures sans police de repli, comme le tamoul, l'éthiopien ou le syriaque, sont tous traités de la même façon. Une écriture comme le tamoul, l'éthiopien ou le syriaque n'en a pas non plus. Dans un PDF, la ligne contenant ce texte est intégrée comme une image à 300 dpi, et le panneau d'export liste les écritures. Dans un SVG, le segment reste du texte actif, que dessinent les polices du lecteur.

::: details Dans les exports EPS, WMF et EMF
Un EPS, un WMF ou un EMF avec **Outline fonts** activé n'a pas de texte actif vers lequel se replier, donc le segment est lui aussi intégré comme une image à 300 dpi. L'image ne peint la couleur du texte qu'à l'emplacement des lettres, ce qui laisse voir l'arrière-plan. Le panneau d'export liste les écritures. Une image ne se dessine que droite, donc un segment tourné ou incliné arrête l'export avec un message qui cite le segment. Dans un WMF ou EMF, l'image est une paire d'opérations bitmap, un masque et une peinture. Microsoft Office et LibreOffice les dessinent comme prévu. Une application qui les ignore, comme Inkscape, affiche les mots sur un rectangle blanc.

Un EMF avec **Outline fonts** désactivé garde ce segment comme texte actif, que dessinent les polices du lecteur. L'exception est un segment que le texte actif EMF ne peut pas contenir, comme du texte avec un espacement entre les lettres. Lolly convertit ce segment en contours, donc un segment qu'aucune police ne peut dessiner y est aussi intégré comme une image.
:::

::: warning Un export DXF s'arrête sur du texte qu'aucune police ne peut dessiner
Un DXF est destiné aux machines de découpe et aux logiciels de CAO, qui ont besoin de contours, donc un segment qu'aucune police ne peut dessiner arrête l'export DXF. Le message cite le segment et indique son écriture. Ajoute une police qui contient ces lettres, ou exporte en SVG ou PDF.
:::

<!--i:eti-checklist-->
## La vérification avant l'export

La carte **Before you export** de Lolly Design et les vérifications `render` de `lolly check` signalent le texte qu'aucune police ne peut dessiner. Elles prennent en compte les polices de repli comme le fait un export, à partir des mêmes listes de caractères par police, donc le texte dessiné par une police de repli n'est pas signalé. Une écriture sans police de repli, comme le tamoul, et un caractère chinois, japonais ou coréen en dehors des jeux nationaux restent signalés, car l'export les dessine comme une image ou du texte actif, et un export DXF s'arrête sur eux. La vérification lit ces listes dans le catalogue et ne télécharge aucune police.

<!--i:eti-stamp-->
## Licences et crédits

Chaque police de repli est sous SIL Open Font License 1.1. Chaque entrée du catalogue consigne cette licence avec une empreinte de son texte, donc les règles de droits décrites dans [Droits de création et crédits](/info/creative-rights.html) lisent la licence comme celle de toute autre police. Les textes de licence se trouvent à côté des polices. Les fichiers Noto Sans ne déclarent aucun nom de police réservé. Les polices chinoises, japonaises et coréennes appartiennent à Adobe et réservent le nom Source. Les fichiers réduits gardent leurs noms Noto, qui n'utilisent pas ce nom.

La licence indique que ses conditions ne s'appliquent pas aux documents créés avec les polices. Un export ne contient que les contours des lettres qu'il utilise, comme avec les polices du design system. Lolly n'ajoute aucun programme de police, aucune mention de crédit et aucune nouvelle entrée dans les Content Credentials pour une police de repli.
