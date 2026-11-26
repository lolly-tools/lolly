# Réglages

Les réglages regroupent tes informations, ton design system, l'accessibilité, le stockage sur cet appareil et les téléchargements hors ligne. Ouvre **Settings** depuis la barre au bas de l'écran d'accueil ou depuis le menu de ton avatar : l'onglet **Preferences** s'affiche.

| Onglet | Adresse | Son contenu |
|---|---|---|
| **Preferences** | `#/settings` | Tes informations, les design systems, l'apparence, les emoji, l'accessibilité, les connexions, le stockage et les téléchargements hors ligne |
| **This device** | `#/settings?tab=device` | Un état en direct de ce navigateur et de cette machine, ainsi que le son et une vue du stockage en lecture seule |
| **Design system** | `#/settings?tab=brand` | Le design system actif sous forme de couverture et de pages, avec une bande de couvertures pour changer de système |
| **Capabilities** | `#/settings?tab=caps` | Tout ce que Lolly peut faire, sous forme de cartes avec recherche |
| **Activity & stats** | `#/settings?tab=activity` | Le catalogue, tes compteurs locaux et ton travail récent |

Les anciens liens `#/profile` et `#/d` ouvrent toujours le bon endroit, jusqu'aux réglages individuels.

<!--i:eti-sliders-->
## Préférences

Preferences est une longue page avec une **barre latérale des réglages**. Le champ **Search settings** au-dessus de cette barre la filtre pendant ta saisie. Chaque section a un lien de la forme `#/settings?focus=<section-id>`, comme `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - ton nom, tes coordonnées et ta photo de portrait, et la bascule **Use my details to create**. [Profils](/info/profile.html) explique comment les outils les utilisent.
- <!--i:seal--> **Content Credentials** - l'identité vérifiée facultative qui signe tes exports. Voir [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - changer, ajouter, masquer ou supprimer des design systems. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) décrit chaque action.
- <!--i:moon--> **Appearance** - le thème (Light, Dark ou Brand, qui habille l'application de ta palette), **Your colourway** quand le design system en propose plusieurs ([Personnaliser ton colourway](/info/colourways.html#make-a-colourway-your-own)) et **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - le jeu d'emoji pour les nouvelles créations, avec la licence de ses illustrations, et l'intensité avec laquelle ta palette recolore les emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** ou **Duotone**). **Keep skin tones and flags** conserve leurs couleurs d'origine. Le travail déjà créé garde son jeu.
- <!--i:eyeoff--> **Accessibility** - quatre bascules de confort, ainsi que Sound et Neurospicy Mode. Voir [Accessibilité](#accessibility).
- <!--i:link--> **Connected services** - le stockage que tu connectes, comme Dropbox, Google Drive, OneDrive, Nextcloud ou S3, et **Sync across devices**. Voir [Synchroniser tes appareils](/info/sync.html).
- <!--i:globe--> **Trusted sites** - les sites qu'un bloc de page web Lolly Design ou une démo Lolly Sandbox peut contacter sans demander, et, quand le serveur le propose, **Allow pages from any site**. La [politique de confidentialité](/info/privacy.html) liste ce que chaque requête envoie.
- <!--i:download--> **Your renders** - **Save my renders to my library** conserve dans Assets une copie de chaque image, extrait audio et vidéo que tu télécharges, sous une étiquette Renders.
- <!--i:database--> **Storage** - ce que Lolly conserve sur cet appareil, et les boutons qui effacent ou transportent tes données. Voir [Stockage](#storage).
- <!--i:cpu--> **Available offline** - télécharge ce dont tu as besoin avant de perdre la connexion. Voir [Disponible hors ligne](#available-offline).
- <!--i:folder--> **Hot folder** - dans l'application de bureau, Lolly surveille un dossier et importe tout ce qui y est déposé, via le même sélecteur que le glisser-déposer.
- <!--i:clock--> **Your activity** - ce que tu as créé sur cet appareil, compté localement.
- <!--i:sliders--> **Feature flags** - active ou désactive des parties de l'application, comme **Print preflight** ou **Strip metadata from uploads**. **Performance UI** donne à l'application une apparence plus simple, moins coûteuse à dessiner. Lolly peut activer Performance UI de lui-même sur un appareil lent. La ligne sous la bascule indique alors quand et pourquoi, avec **Allow again** ([comment il décide](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - l'endroit où cette installation récupère ses outils et son catalogue. Voir [Instance Lolly](#lolly-instance).

Les cartes de thème sont des aperçus en direct. Un thème s'applique dès que tu le choisis, sur cet appareil uniquement.

![Trois cartes de thème, chacune montrant sa propre typographie et sa propre couleur, avec le thème actif signalé](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibilité

**Settings → Preferences → Accessibility** contient quatre réglages de confort pour l'application. Chacun reste désactivé jusqu'à ce que tu l'actives, et aucun n'agit dans le canevas d'un outil ou dans un export, donc une application plus calme ne déplace jamais un pixel du fichier que tu livres. Chacun est désactivé par défaut. Aucun ne modifie le canevas d'un outil ni un export.

- <!--i:pause--> **Reduce motion** désactive les transitions, les glissements et les animations décoratives de l'application.
- <!--i:photos--> **Hide colourful previews** remplace les visuels d'aperçu de la galerie par des cartes avec icône et texte et atténue les vignettes des projets, qui restent reconnaissables.
- <!--i:sliders--> **High contrast** renforce les bordures, le texte et les contours de focus de l'application. Tes couleurs de marque et le canevas restent tels que tu les as définis.
- <!--i:font--> **Large text** agrandit les libellés, les menus et le texte des boutons de l'application.

**Dominant hand** (Right ou Left) définit de quel côté se placent les contrôles quand Lolly affiche deux volets, sur un appareil pliable ou une tablette presque carrée. **Swap sides** dans l'en-tête d'un volet change aussi ce réglage.

Ces réglages sont conservés dans ton profil, donc ils suivent ton nom et tes sessions dans un export de profil. Une copie propre à l'appareil les applique avant le premier affichage.

La même carte contient **Sound**, des sons d'assistance doux pour des actions comme l'arrivée dans la galerie, un résultat Content Credentials ou la fermeture d'un panneau. Elle contient aussi **Neurospicy Mode**, une piste calme pour se concentrer. Activer Neurospicy ouvre un petit lecteur dans le coin qui te suit dans toute l'application. Dans le lecteur, tu choisis une piste, passes à la suivante, règles le volume et réduis ou fermes le lecteur. Les pistes comprennent les stations générées de Lolly, des boucles d'ambiance et des rythmes, tes propres fichiers audio et des stations de radio internet, qui nécessitent une connexion. Les deux fonctions sont désactivées par défaut et leur état est mémorisé. Désactiver Sound coupe aussi le son de la piste de concentration. Le menu du profil et **This device** proposent la même bascule.

Un curseur sous la bascule Sound règle la matière sonore. Vers la forme ronde **Bouba**, les sons deviennent des gouttes douces, des bulles et un peu de basse. Vers l'étoile pointue **Kiki**, ils deviennent des clics secs, des grattements et des sons métalliques. Le milieu conserve les carillons et les notes de Lolly. Si les sons à une extrémité te sont difficiles à supporter, déplace le curseur vers l'autre. Le curseur fonctionne quand Sound est désactivé, et le relâcher joue un court extrait.

::: details Les stations générées
Les stations générées composent leur musique pendant qu'elles jouent, sans échantillons ni voix enregistrées. Chaque morceau a ses propres instruments, son groove et son déroulement.

- **Lolly Sings** est une famille de stations. La station Lolly Sings d'origine est lumineuse et mélodique : tonalités majeures, mélodie principale dans chaque morceau et couleurs bossa, shuffle et chiptune. Chaque genre a aussi sa propre station, de Sugar et K-pop à Country, Jazz, Metal et D&B.
- Les **stations Lofi** (Warm, Late night et Rainy) proposent des rythmes lo-fi sans fin.

Sur une station générée, suivant et précédent passent d'un morceau à l'autre. Chaque morceau provient d'une graine, donc il se joue de la même façon où que tu le partages ou l'enregistres (voir [Musique générée](/info/generated-music.html)). Sous les commandes de lecture, **Mood** passe d'une station Lofi à l'autre, **Drums** retire la batterie et **Texture** va d'un son net à celui d'un disque poussiéreux. Une rangée de boutons à icônes suit. Survole un bouton ou appuie longuement dessus pour voir son nom :

- La note de musique, **Open in the music generator**, ouvre le morceau à `#/music`, où tu peux changer ses instruments section par section.
- Le lien, **Share this tune or moment**, propose un lien qui joue le même morceau, ou un autre qui démarre aussi à l'endroit où tu es et montre le visualiseur avec ton préréglage et tes couleurs actuels.
- Le dossier, **Save to library**, conserve le morceau dans tes ressources.
- L'éclair, **Light visualiser**, est une bascule décrite ci-dessous.

Un morceau enregistré apparaît dans le groupe de sa station, par tonalité et tempo. Choisir le morceau enregistré rejoue le même morceau, en boucle comme toute piste ou en passant au suivant en mode de lecture successive. Seuls la station et le numéro du morceau sont stockés, quelques octets, et la musique est recomposée pendant la lecture. Tu peux renommer ou supprimer un morceau enregistré dans tes ressources, et l'utiliser comme fond musical d'une vidéo. Lolly Demo et Lolly Start sont chacun fournis avec six morceaux enregistrés.

Le visualiseur reçoit chaque piste à un niveau constant, donc une piste douce fait autant bouger l'image qu'une piste forte, quel que soit le volume. Chaque genre de Lolly Sings, ainsi qu'un morceau enregistré issu de l'un d'eux, propose **Light visualiser** : de simples barres de niveau qui laissent à la musique le temps de calcul dont elle a besoin. Light visualiser est activé au départ sur les écrans tactiles et sur les appareils à quatre cœurs ou moins ou à 4 Go de mémoire ou moins.
:::

Tu peux utiliser l'interface au clavier. Les contrôles personnalisés portent des libellés pour les lecteurs d'écran. L'aperçu en direct de chaque outil est une seule image dont le libellé décrit ce qu'elle montre.

### Stockage

La jauge de stockage montre chaque octet conservé par cette installation, par catégorie, en regard de ce que rapporte le navigateur.

![La jauge de stockage, qui répartit les sessions enregistrées, les images et le cache en regard de ce que rapporte réellement le navigateur](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sous la jauge :

- **Move to another device** contient **Export my data**, **Import data…** et **Export my data & render everything**. [Déplacer ton travail vers un autre appareil](/info/find-your-work.html#move-your-work-to-another-device) les explique pas à pas.
- **Clear cache** supprime les fichiers de catalogue téléchargés, qui sont à nouveau téléchargés au besoin.
- **Remove automatic checkpoints older than 30 days** libère de l'espace dans History et conserve les versions enregistrées et nommées.
- **Clear all my data** supprime tout ce que Lolly conserve dans ce navigateur, après que tu as saisi un mot pour confirmer. [Si tu effaces les données de ton navigateur](/info/find-your-work.html#if-you-clear-your-browser-data) liste ce qui disparaît.

### Disponible hors ligne

Lolly ne met en cache que les écrans que tu as visités. **Available offline** télécharge les parties dont tu auras besoin, avec une seule barre de progression, et elles continuent de fonctionner sans connexion.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (chaque vue, éditeur et police, y compris les écrans que tu n'as jamais ouverts), le **Catalogue** (en entier, ou **Choose by tag**) et **Guides & docs** (cette documentation dans ta langue, captures d'écran comprises).
- <!--i:cpu--> **AI models** - chaque modèle exécuté sur l'appareil sur sa propre ligne avec sa taille : voix de synthèse, modèles d'agrandissement, suppression d'arrière-plan, reconnaissance de texte, analyse approfondie de Lolly Verify, attestation durable, modèle de reformulation, modèle de correspondance Ask, détecteur de texte IA et voix chantées. Un modèle de plus de 50 MB porte la mention **large download**.
- <!--i:wrench--> **Tools** - chaque outil se télécharge séparément, ou **Download all** les télécharge tous. Une coche signifie qu'il est prêt hors ligne.

**Download everything**, en haut, télécharge l'application, la partie du catalogue que tu as choisie, les guides et tous les outils. Coche **Include all the AI models** pour ajouter les modèles, ou télécharge un modèle depuis sa propre ligne. Les voix chantées ne se téléchargent que depuis leur propre ligne. La politique d'une organisation peut désactiver les téléchargements d'IA, et les lignes l'indiquent alors.

Les téléchargements reprennent là où ils se sont arrêtés si tu annules ou perds la connexion. Une fois la connexion rétablie, ils se mettent à jour et ne récupèrent que ce qu'une version a changé. Si le navigateur n'a pas accordé le stockage persistant, **Protect downloads** demande cette autorisation. Sans elle, le navigateur peut supprimer les téléchargements quand il veut récupérer l'espace.

### Instance Lolly

**Lolly instance** indique d'où cette installation tire ses outils et son catalogue : l'adresse d'une instance, ou *Bundled with this app* quand tout est inclus dans la version distribuée.

- **Design-system source** indique d'où vient le design system fourni.
- **Instance console** ouvre les pages d'administration d'un déploiement, s'il en propose.
- **Change** dirige l'application de bureau vers une autre instance. Un navigateur ne peut pas charger d'outils et de ressources depuis d'autres origines, donc sur le web la section propose **Open a workspace** à la place.
- **Leave** supprime le design system, les outils et le catalogue de l'instance. Ton propre travail reste. Voir [Utiliser Lolly dans ton organisation](/info/organisation.html#leaving).
- Quand tu es connecté à une organisation, **Sign out** termine cette session et **Sign out everywhere** termine tes sessions sur tous les appareils, celui-ci compris.

<!--i:eti-monitor-->
## Cet appareil

- <!--i:monitor--> **This Machine** - écran, entrées, graphismes, mémoire, codecs, système de stockage et plus, lus en direct depuis cette session. Rien n'est stocké ni envoyé. Sur un grand écran, ce panneau s'ouvre tout seul et l'onglet utilise deux colonnes.
- <!--i:neurobeat--> **Sound** - les sons de l'interface et les boucles de concentration Neurospicy. Sound est la seule bascule de cet onglet qui écrit quoi que ce soit.
- <!--i:database--> **Storage** - une vue du compteur en lecture seule. Efface ou transfère tes données dans [Préférences](#storage).

<!--i:eti-palette-->
## Design system

Le design system actif, présenté pour être consulté. Quand ce navigateur contient au moins deux design systems, une bande de couvertures en haut les liste. Choisis-en un pour l'activer. **Undo**, dans le message qui suit, remet le précédent.

![L'onglet Design system dans Lolly Demo : une bande de couvertures pour changer de système, puis la couverture avec son logo, son nom, sa note et les compteurs qui ouvrent chaque page](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

L'onglet s'ouvre sur une couverture aux couleurs du système, avec son logo, son nom dans sa police de titrage et la note écrite par son auteur. Une ligne de compteurs sur la couverture donne accès à chaque page :

- <!--i:palette--> **Colour** - les couleurs de surface, de texte, primaire et secondaire des aspects clair et sombre, chaque couleur nommée sous forme de pastille avec son nom et son code hexadécimal, une bande pour chaque gamme de teintes et pour le spectre des graphiques, puis les rôles des couleurs dans une section repliable. Sélectionne une valeur pour copier le code hexadécimal.
- <!--i:font--> **Type** - Headings, Text, Emphasis et Code, chacun dans sa propre police.
- <!--i:photos--> **Logos** - chaque fichier de logo sur le fond pour lequel il a été conçu.
- <!--i:layers--> **Colourways** - la paire claire et sombre de chaque colourway, quand le système en a plusieurs.
- <!--i:sliders--> **Tokens** - rayon, espacement, effets et dégradés.
- <!--i:document--> **Print & CMYK** - les couleurs fixées à une encre précise et les conditions d'impression qu'un PDF CMYK peut déclarer.

Le changement de système est la seule modification que cet onglet permet. Modifie un design system dans [Lolly Design System Setup](/info/brand-studio.html) à l'adresse `#/start`, vers laquelle la couverture renvoie. Un système en lecture seule l'indique sur sa couverture. Les systèmes locaux que tu crées restent modifiables. `/b` et `/brand` sont des liens courts vers cet onglet.

<!--i:eti-grid-->
## Capacités

Chaque partie de la plateforme a sa carte, dans douze groupes : Expériences, Plateformes & environnements d'exécution, Accessibilité & langues, Formats d'export, Formats d'import, Production imprimée, Automatisation & IA, Déterminisme & reproductibilité, Marque & design system, Confidentialité & propriété des données, Sécurité & contrôle d'accès et Architecture (pour les développeurs). Chaque groupe se replie et affiche son nombre de cartes. Une carte ouvre une boîte de dialogue avec les fonctionnalités de cette capacité et, pour environ la moitié des cartes, la capture d'écran utilisée dans cette documentation.

Le champ de recherche au-dessus des groupes filtre les cartes pendant la saisie et ouvre les groupes qui contiennent une correspondance. Le champ indique combien de capacités il parcourt. Une recherche sans résultat l'indique en toutes lettres.

Cet onglet décrit ce que Lolly sait faire, en accord avec ces guides. Il ne sonde pas la machine que tu utilises ; **This device** s'en charge.

<!--i:eti-gauge-->
## Activité & statistiques

D'abord la version distribuée : le nombre d'outils chargés, les formats d'export, les environnements où la plateforme fonctionne et les ressources de marque du catalogue. Un panneau **Catalogue** détaille ce que cette version contient.

Puis ton propre travail : **Your activity** compte ce que tu as créé sur cet appareil. **Recent creations** et **Latest exports** sont des piles que tu peux faire défiler par glissement et qui apparaissent dès qu'elles contiennent quelque chose. Les deux ouvrent un élément tel qu'il était. Ces compteurs restent sur l'appareil. Une instance Lolly Work facultative conserve ses propres [données de télémétrie et enregistrements d'audit de l'organisation](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Liens profonds

Chaque onglet et section de Settings a son propre lien à ajouter aux favoris ou à coller. [Lolly Search](/info/search.html) construit ses résultats **Settings** à partir du même registre que Settings, donc renommer une section ne casse jamais un résultat de recherche.

::: details Toutes les formes de lien

- **Un onglet :** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Une section de Preferences :** `#/settings?focus=<section-id>`, par exemple `#/settings?focus=offline-section`.
- **Une section précise :** son identifiant comme indicateur sans valeur, par exemple `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` ou `#/settings?cap-formats`. Les anciens liens `#/settings?dash-lock` et `#/settings?dash-palette-wheel` ouvrent la couverture et la page Colour.
- **Une section par mot-clé :** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (la page Colour) ou `#/settings?tokens`. Deux sections peuvent partager un mot-clé : `print` appartient à la fois à la référence d'impression de l'onglet de marque et au groupe Production imprimée, et la première dans l'ordre de la page l'emporte. Utilise l'identifiant pour en choisir une.

Un lien profond active l'onglet qui contient la cible et ouvre tout groupe replié dans lequel elle se trouve. Il fait ensuite défiler la page jusqu'à la cible une fois la mise en page des sections précédentes terminée. Les anciennes adresses `#/platform` et `#/capabilities` s'ouvrent dans Settings en conservant leurs indicateurs de lien profond.
:::

---

**À lire aussi :** [Profils](/info/profile.html) pour tes informations et les contextes dans lesquels tu crées. [Lolly Design System Setup](/info/brand-studio.html) pour modifier ce que l'onglet Design system affiche. [Retrouver et récupérer ton travail](/info/find-your-work.html) pour le stockage, les sauvegardes et les changements d'appareil.
