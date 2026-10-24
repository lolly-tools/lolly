# Réglages

Settings est l'endroit où tu changes la façon dont Lolly travaille pour toi : tes informations, le design system que tu utilises, l'accessibilité, ce qui est stocké sur cet appareil et ce qui est prêt hors ligne. Ouvre-le avec **Settings** dans la barre au pied de l'écran d'accueil, ou depuis le menu de ton avatar. Il s'ouvre sur **Preferences**, avec quatre autres onglets à côté.

| Onglet | Adresse | Ce qu'il contient |
|---|---|---|
| **Preferences** | `#/settings` | Tes informations, les design systems, l'apparence, les emoji, l'accessibilité, les connexions, le stockage et les téléchargements hors ligne |
| **This device** | `#/settings?tab=device` | Un relevé en direct de ce navigateur et de cette machine, plus le son et une vue en lecture seule du stockage |
| **Design system** | `#/settings?tab=brand` | Le design system actif sous forme de couverture et de pages, avec une bande de couvertures pour changer de système |
| **Capabilities** | `#/settings?tab=caps` | Tout ce que Lolly sait faire, sous forme de cartes consultables |
| **Activity & stats** | `#/settings?tab=activity` | Le catalogue, tes compteurs locaux et ton travail récent |

Chaque onglet a sa propre adresse, et les anciens liens `#/profile` et `#/d` ouvrent toujours le bon endroit, jusqu'aux réglages individuels.

## Preferences

Preferences est une longue page avec un **settings rail** sur le côté et un champ **Search settings** au-dessus du rail qui le filtre pendant que tu tapes. Chaque section s'ouvre directement depuis un lien de la forme `#/settings?focus=<section-id>`, par exemple `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - ton nom, tes coordonnées et ta photo, et l'interrupteur **Use my details to create**. [Profiles](/info/profile.html) explique comment les outils les utilisent.
- <!--i:seal--> **Content Credentials** - l'identité vérifiée facultative qui signe tes exports. Voir [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - changer, ajouter, masquer ou supprimer des design systems. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) couvre chaque action.
- <!--i:moon--> **Appearance** - le thème (Light, Dark ou Brand, qui peint l'application dans ta palette) et **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - le jeu dans lequel tes emoji sont dessinés quand tu commences quelque chose de nouveau, avec sa licence d'illustration, et l'intensité avec laquelle ta palette les recolore (**Off**, **Subtle**, **Strong**, **Full**, **Mono** ou **Duotone**). **Keep skin tones and flags** les laisse dans leurs propres couleurs. Le travail déjà créé garde le jeu avec lequel il a été fait.
- <!--i:eyeoff--> **Accessibility** - quatre interrupteurs de confort, plus Sound et Neurospicy Mode. Voir [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - le stockage que tu connectes, comme Dropbox, Google Drive, OneDrive, Nextcloud ou S3, et **Sync across devices**. Voir [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - les sites qu'un bloc de page web Design ou une démo Sandbox peut contacter sans demander, et, quand le serveur le propose, **Allow pages from any site**. La [Privacy Policy](/info/privacy.html) liste ce que chaque requête envoie.
- <!--i:download--> **Your renders** - **Save my renders to my library** conserve dans Assets, sous une étiquette Renders, une copie de chaque image, clip audio et vidéo que tu télécharges.
- <!--i:database--> **Storage** - ce que Lolly conserve sur cet appareil, et les boutons qui effacent ou emportent tes données. Voir [Storage](#storage).
- <!--i:cpu--> **Available offline** - télécharge ce dont tu as besoin avant de perdre la connexion. Voir [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - dans l'application de bureau, surveille un dossier et fait entrer dans Lolly tout ce qui y est déposé, via le même sélecteur qu'un glisser-déposer.
- <!--i:clock--> **Your activity** - ce que tu as créé sur cet appareil, compté localement.
- <!--i:sliders--> **Feature flags** - active ou désactive des parties de l'application, comme **Print preflight** ou **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - d'où cette installation obtient ses outils et son catalogue. Voir [Lolly instance](#lolly-instance).

Les cartes de thème sont des aperçus en direct et s'appliquent dès que tu en choisis une, sur cet appareil uniquement.

![Trois cartes de thème, chacune prévisualisant sa propre typographie et ses couleurs, avec celle qui est active clairement signalée](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibilité

**Settings → Preferences → Accessibility** contient quatre réglages de confort pour l'application autour de ton travail. Chacun est désactivé tant que tu ne l'actives pas, et aucun n'atteint l'intérieur d'un canevas d'outil ou d'un export, donc une application plus calme ne déplace jamais un pixel du fichier que tu livres.

- <!--i:pause--> **Reduce motion** désactive les transitions, glissements et fioritures de l'application. Ton canevas et tout export animé continuent de bouger comme prévu.
- <!--i:photos--> **Hide colourful previews** remplace les illustrations d'aperçu de la galerie par des cartes calmes avec icône et texte, et adoucit les vignettes de projets pour qu'elles restent reconnaissables sans crier.
- <!--i:sliders--> **High contrast** renforce les bordures, le texte et les anneaux de focus de l'application. Les couleurs de ta marque et le canevas restent comme tu les as réglés.
- <!--i:font--> **Large text** agrandit les libellés, les menus et le texte des boutons de l'application. La typographie à l'intérieur de tes designs n'est pas touchée, donc rien de ce que tu exportes ne se remet en page.

Ces réglages vivent dans ton profil, donc ils voyagent dans un export de profil et arrivent à l'installation suivante avec ton nom et tes sessions. Une petite copie propre à l'appareil les applique avant le premier affichage.

La même carte contient **Sound**, une douce couche de sons d'assistance pour ce que tu fais (arrivée dans la galerie, résultat de Content Credentials, fermeture d'un panneau), et **Neurospicy Mode**, une piste calme de concentration. Activer Neurospicy ouvre un petit lecteur dans le coin qui te suit dans toute l'application. Tu y choisis une piste, tu passes, tu règles le volume et tu réduis ou fermes le lecteur. Les pistes comprennent des mélodies procédurales *Lolly Sings*, des boucles et rythmes d'ambiance, ton propre audio et des stations de radio sur Internet, qui demandent une connexion. Les deux sont désactivés par défaut et mémorisés, et désactiver Sound coupe aussi la piste de concentration. Le menu du profil et **This device** portent le même interrupteur.

L'interface se navigue au clavier, les contrôles personnalisés portent des libellés pour les lecteurs d'écran et l'aperçu en direct de chaque outil est exposé comme une seule image étiquetée qui décrit ce qu'elle montre.

### Stockage

Le compteur de stockage comptabilise chaque octet que cette installation contient, catégorie par catégorie, par rapport à ce que le navigateur indique.

![Le compteur de stockage, qui détaille les sessions enregistrées, les images et le cache par rapport à ce que le navigateur indique réellement](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sous le compteur :

- **Move to another device** contient **Export my data**, **Import data…** et **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) les détaille.
- **Clear cache** supprime les fichiers de catalogue téléchargés, qui se retéléchargent quand il le faut.
- **Remove automatic checkpoints older than 30 days** libère de l'espace dans History et conserve les versions enregistrées et nommées.
- **Clear all my data** supprime tout ce que Lolly conserve dans ce navigateur, après que tu as saisi un mot pour confirmer. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) liste ce qui disparaît.

### Disponible hors ligne

Lolly met en cache les écrans au fur et à mesure de tes visites, ce qui ne couvre que les endroits où tu es déjà allé. **Available offline** est pour le voyage que tu vois venir : télécharge les parties dont tu auras besoin, suis une seule barre de progression, et tout ce que tu as pris continue de fonctionner sans connexion.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (chaque vue, éditeur et police, y compris les écrans que tu n'as jamais ouverts), le **Catalogue** (en entier, ou **Choose by tag**) et **Guides & docs** (cette documentation dans ta langue, captures d'écran comprises).
- <!--i:cpu--> **AI models** - chaque modèle sur l'appareil sur sa propre ligne avec sa taille : Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector et Singing voices. Un modèle de plus de 50 MB est marqué **large download**.
- <!--i:wrench--> **Tools** - chaque outil se télécharge séparément, ou **Download all** prend tous les outils. Une coche signifie prêt hors ligne.

**Download everything**, en haut, prend l'application, la portée de catalogue que tu as choisie, les guides et tous les outils. Coche **Include all the AI models** pour ajouter les modèles, ou télécharge un modèle depuis sa propre ligne ; les voix chantées ne se téléchargent que depuis leur propre ligne. La politique d'une organisation peut désactiver les téléchargements d'IA, et les lignes te le disent alors.

Les téléchargements reprennent là où ils se sont arrêtés si tu annules ou perds la connexion, et s'actualisent d'eux-mêmes quand tu es de nouveau en ligne, en ne récupérant que ce qu'une version a changé. Si le navigateur n'a pas accordé de stockage persistant, **Protect downloads** le demande : la différence entre « téléchargé » et « téléchargé jusqu'à ce que le navigateur reprenne l'espace ».

### Lolly instance

**Lolly instance** dit d'où cette installation obtient ses outils et son catalogue : l'adresse d'une instance, ou *Bundled with this app* quand tout est livré dans le build.

- **Design-system source** montre d'où vient le design system fourni.
- **Instance console** ouvre les pages d'administration d'un déploiement, là où il les propose.
- **Change** dirige l'application de bureau vers une autre instance. Un navigateur ne peut pas charger d'outils ni de ressources entre origines, donc sur le web la section propose **Open a workspace** à la place.
- **Leave** supprime le design system, les outils et le catalogue de l'instance, et ton propre travail reste. Voir [Use Lolly at your organisation](/info/organisation.html#leaving).
- Quand tu es connecté à une organisation, **Sign out** met fin à cette session et **Sign out everywhere** met fin à tes sessions sur chaque appareil, y compris celui-ci.

## This device

- <!--i:monitor--> **This Machine** - écran, entrée, graphisme, mémoire, codecs, backend de stockage et plus, lus en direct depuis cette session. Rien n'est stocké et rien n'est envoyé. Il s'ouvre tout seul sur un grand écran, où l'onglet se dispose sur deux colonnes.
- <!--i:neurobeat--> **Sound** - les sons de l'interface et les boucles de concentration Neurospicy, le seul interrupteur de cet onglet qui écrit quelque chose.
- <!--i:database--> **Storage** - une vue en lecture seule du compteur de [Preferences](#storage), qui est l'endroit où tu effaces ou emportes tes données.

## Design system

Le design system actif, présenté pour la lecture. Quand ce navigateur contient au moins deux design systems, une bande de petites couvertures en haut les liste : choisis-en une pour l'activer, et **Undo** dans l'avis qui suit remet le précédent.

![L'onglet Design system sur Lolly Demo : une bande de couvertures pour changer de système, puis la couverture avec son logo, son nom, sa note et les totaux qui ouvrent chaque page](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

L'onglet s'ouvre sur une couverture peinte aux couleurs propres du système, avec son logo, son nom dans sa police d'affichage et la note que son auteur a écrite. Une ligne de totaux sur la couverture renvoie à chaque page :

- <!--i:palette--> **Colour** - la surface, le texte, le primaire et le secondaire des aspects clair et sombre, chaque couleur nommée sous forme de pastille avec son nom et son hexadécimal, une bande pour chaque dégradé de teintes et le spectre des graphiques, et les rôles de couleur dans un pli. Sélectionne une valeur pour copier l'hexadécimal.
- <!--i:font--> **Type** - Headings, Text, Emphasis et Code, chacun composé dans sa propre police.
- <!--i:photos--> **Logos** - chaque fichier de logo sur le fond pour lequel il a été conçu.
- <!--i:layers--> **Colourways** - la paire claire et sombre de chaque colourway, quand le système en a plus d'un.
- <!--i:sliders--> **Tokens** - rayon, espacement, effets et dégradés.
- <!--i:document--> **Print & CMYK** - les couleurs verrouillées sur une encre exacte, et les conditions d'impression qu'un PDF CMJN peut déclarer.

Changer de système est la seule modification que fait cet onglet. Tu modifies un design system dans [Design System Setup](/info/brand-studio.html) à `#/start`, vers lequel renvoie la couverture. Un système en lecture seule le dit sur sa couverture ; les systèmes locaux que tu crées restent modifiables. `/b` et `/brand` sont des raccourcis directs vers cet onglet.

## Capabilities

Chaque partie de la plateforme est décrite sous forme de carte, en douze groupes : Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control et Architecture (for builders). Chaque groupe se replie et affiche son nombre de cartes. Une carte s'ouvre en boîte de dialogue avec les fonctions de cette capacité et, pour environ la moitié d'entre elles, la capture d'écran qu'utilise cette documentation.

Le champ de recherche au-dessus des groupes filtre les cartes pendant que tu tapes et ouvre les groupes qui contiennent encore une correspondance. Il dit combien de capacités il parcourt, et une recherche sans résultat le dit en toutes lettres.

Cet onglet est une documentation écrite de ce que Lolly sait faire, tenue au même rythme que ces guides. Il ne sonde pas la machine sur laquelle tu es ; **This device** le fait.

## Activity & stats

D'abord le build : combien d'outils sont chargés, combien de formats d'export existent, sur combien de surfaces la plateforme tourne et combien de ressources de marque le catalogue contient, avec un panneau **Catalogue** qui détaille ce que ce build embarque.

Puis ton propre côté : **Your activity** compte ce que tu as créé sur cet appareil, et **Recent creations** et **Latest exports** sont des piles que tu peux balayer, chacune n'apparaissant qu'une fois qu'il y a quelque chose à montrer. Les deux ouvrent un élément tel qu'il était. Ces compteurs restent sur l'appareil ; une instance Lolly Work facultative tient ses propres [télémétrie d'organisation et enregistrements d'audit](/info/privacy.html#organisation-services-with-lolly-work).

## Deep links

Chaque onglet et chaque section de Settings a son propre lien, que tu peux mettre en favori ou coller. [Search](/info/search.html) dirige ses résultats **Settings** vers le même registre dont Settings se sert pour s'afficher, donc une section ne peut pas être renommée sous un résultat de recherche.

::: details Toutes les formes de lien

- **Un onglet :** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Une section de Preferences :** `#/settings?focus=<section-id>`, comme `#/settings?focus=offline-section`.
- **Une section, exactement :** son identifiant comme simple drapeau, comme `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` ou `#/settings?cap-formats`. Les anciens liens `#/settings?dash-lock` et `#/settings?dash-palette-wheel` ouvrent la couverture et la page Colour.
- **Une section par mot-clé :** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (la page Colour) ou `#/settings?tokens`. Les mots-clés peuvent être partagés : `print` appartient à la fois à la référence d'impression de l'onglet de marque et au groupe Print production, et le premier dans l'ordre de la page l'emporte. Utilise l'identifiant quand le choix compte.

Un lien profond bascule vers l'onglet qui possède la cible, ouvre tout groupe dans lequel elle est repliée, puis défile jusqu'à elle, en se stabilisant un instant pendant que les sections au-dessus finissent leur mise en page. Les anciennes adresses `#/platform` et `#/capabilities` se replient dans Settings avec leurs drapeaux de lien profond intacts.
:::

---

**Voir aussi :** [Profiles](/info/profile.html) pour tes informations et les contextes dans lesquels tu crées. [Design System Setup](/info/brand-studio.html) pour modifier ce que montre l'onglet Design system. [Find and recover your work](/info/find-your-work.html) pour le stockage, les sauvegardes et le changement d'appareil.
