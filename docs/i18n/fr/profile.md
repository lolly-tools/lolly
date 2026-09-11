# Profils - qui tu es quand tu crées

Un **profil** est l'identité de travail sous laquelle Lolly crée. C'est le petit ensemble de détails qu'un outil peut aller chercher pour que tu n'aies pas à les retaper à chaque fois - ton nom, tes coordonnées, une photo de profil optionnelle, quelques préférences - plus tout ce que tu accumules en travaillant : sessions enregistrées, images importées et le compteur d'activité local.

Tout ce qui compose un profil vit **sur l'appareil**, dans la base de données locale du navigateur (IndexedDB pour la PWA web, le système de fichiers pour les apps Tauri). Il n'y a pas de compte et rien n'est envoyé en ligne. Tu le gères depuis **Profile** (en haut à droite de la galerie) ; les outils ne font jamais que le *lire*, et seulement les champs précis qu'ils ont été conçus pour pré-remplir.

> Un profil, c'est *toi* (ou quiconque crée ici). Il est distinct de la **Platform** - les couleurs, polices et réglages globaux de la marque - et des **Capabilities**, le catalogue de ce que l'application sait faire. Voir [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) à la fin.

## Ce qu'il y a dans un profil

| Élément | Ce que c'est |
|---|---|
| **Nom** | Prénom et nom. |
| **Contact** | E-mail et téléphone. |
| **Localisation** | Ville et pays. |
| **Photo de profil** | Une photo optionnelle, recadrée en carré et conservée comme image locale. Utilisée par des outils comme les signatures e-mail, les cartes de citation, les organigrammes et les mises en page dynamiques. |
| **Use my details to create** | Un simple interrupteur opt-in (il affiche **Using my details** une fois activé). Il détermine si tes coordonnées personnelles accompagnent les exports en tant que **provenance** - la ligne auteur/crédit intégrée aux fichiers exportés - et en tant qu'auteur sur les exécutions par lot **/pro**. (Il ne conditionne pas le pré-remplissage : voir [Comment les outils utilisent ton profil](#how-tools-use-your-profile).) |
| **Préférences** | Ton thème (Light, Dark ou Brand - le thème de marque peint l'application dans ta propre palette) et les parties de l'application que tu as activées via les **Feature flags**. |
| **Accessibilité** | Quatre interrupteurs de confort - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - conservés sur la fiche du profil, donc inclus dans un export de profil. Voir [Accessibilité](#accessibility). |
| **Ton travail** | Les sessions enregistrées (avec vignettes) - organisées en dossiers imbriqués dans **[Projects](/info/using.html)** - ta bibliothèque **My images** et les statistiques d'activité locales, tout cela lié à ce profil. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![L'écran Profile - nom, contact, une photo de profil optionnelle et tes préférences](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Rien de tout cela n'est obligatoire. Un profil vide est un profil tout à fait valable ; tu ne remplis que ce qui t'évite de retaper.

La page est longue, elle a donc son propre **rail de réglages** sur le côté - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - avec un champ **Search settings** au-dessus qui filtre la liste au fur et à mesure que tu tapes. Chaque section peut être liée directement via `#/profile?focus=<section-id>`, ce qui l'ouvre et la fait défiler jusqu'à l'écran (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, etc.), afin qu'un lien puisse pointer vers un réglage précis plutôt que vers le haut de la page.

![Trois cartes de thème, chacune prévisualisant sa propre typographie et ses couleurs, avec celle qui est active clairement signalée](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Un profil est un contexte, pas seulement une personne

Le mot « profil » suggère une personne fixe et unique, mais dans Lolly c'est en réalité un **contexte de création** - *qui tu es pendant que tu fabriques cette chose*. Ce contexte peut prendre trois formes différentes, et Lolly les traite toutes de la même façon.

### En tant qu'individu

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Le contrôle de photo de profil, vide jusqu'à ce que tu importes une photo qui reste ensuite sur cet appareil](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### En tant qu'équipe

Un profil n'a pas besoin de représenter une seule personne. Il peut représenter une **équipe ou une fonction au sein d'une organisation** : le nom partagé de l'équipe, une adresse de boîte mail de groupe (`events@…`), un département, la photo ou le logo de l'unité. Une personne le configure, l'exporte (voir plus bas) et le reste de l'équipe charge le même profil - ainsi tout ce que l'équipe produit porte des informations cohérentes sans que personne n'ait à les ressaisir. Un kiosque partagé ou un ordinateur portable de démonstration emprunté peuvent tourner sur un seul profil d'équipe sous lequel tout le monde crée.

### En tant que fonction - un rôle que tu endosses parfois

C'est le cas qui échappe au modèle rigide « une personne, un profil ». Tu es peut-être **responsable d'un événement trois jours par an** et quelqu'un de complètement différent le reste du temps. Ces trois jours-là, tu veux les détails de l'événement, la boîte mail de l'événement, peut-être une sous-marque événementielle pour remplir tes badges et ta signalétique ; les 362 autres jours, tu veux retrouver ton identité habituelle.

Dans Lolly, ce rôle n'est qu'**un autre profil que tu gardes sous la main** - un bundle enregistré (section suivante) que tu charges pour l'événement et que tu mets de côté ensuite. Le rôle est une casquette, pas un nouveau compte. Enfile-la quand tu en as besoin, retire-la une fois terminé.

## Une installation, un profil actif - plusieurs que tu peux garder

À tout moment, une installation n'a **qu'un seul profil actif** - les informations qu'un outil voit à l'instant présent. Il n'existe pas de sélecteur de profil dans l'application ; à la place, chaque profil est un **paquet portable** (un simple `.zip`, voir [ci-dessous](#moving-a-profile-to-a-new-device)). C'est volontairement le même mécanisme que pour changer d'appareil - un profil est un fichier que tu peux enregistrer, copier et charger.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Changement le plus propre :** **Profile → Storage → Clear all my data**, puis **Import** le paquet du contexte dans lequel tu entres. Tu crées désormais uniquement sous ce profil.
- <!--i:layers--> **Superposition :** importer *sans* d'abord effacer **fusionne** - le profil importé, les sessions et les images viennent s'ajouter à ce qui existe déjà, remplaçant tout ce qui porte le même nom et laissant le reste intact. Pratique pour récupérer les sessions enregistrées d'une équipe dans ta propre configuration ; pas ce qu'il faut si tu as besoin d'une séparation nette des rôles.
- <!--i:monitor--> **Côte à côte :** comme tout est propre à l'appareil, un profil de navigateur distinct, un compte utilisateur distinct ou une seconde installation PWA portent chacun leur propre profil Lolly indépendant. Fais tourner ton installation personnelle et l'installation du kiosque d'événement en même temps, sans avoir à basculer.

Donc si tu jongles vraiment entre plusieurs contextes (toi, ton équipe, la casquette de responsable événementiel), tu gardes plusieurs bundles et tu charges celui dont tu as besoin :

![Le compteur de stockage, détaillant sessions enregistrées, images et cache par rapport à ce que le navigateur indique réellement](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Garde un bundle par contexte et renomme les fichiers pour ce qu'ils sont (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Le fichier *est* le profil.

## Accessibilité

**Profile → Accessibility** regroupe quatre réglages de confort pour l'application *autour* de ton travail. Chacun est désactivé jusqu'à ce que tu l'actives, et aucun ne touche l'intérieur d'un canevas d'outil ou d'un export - une application plus apaisée ne doit pas déplacer un seul pixel du fichier que tu livres.

- <!--i:film--> **Reduce motion** - désactive les transitions, les glissements et les fioritures animées de l'application. Ton canevas d'outil et tout export animé continuent de bouger exactement comme prévu.
- <!--i:image--> **Hide colourful previews** - remplace les visuels d'aperçu de la galerie par des cartes calmes en icône et texte, et réduit la couleur et le contraste des vignettes de tes projets pour qu'elles restent reconnaissables sans crier. À l'intérieur d'un outil, tout s'affiche en pleine couleur.
- <!--i:sliders--> **High contrast** - renforce les bordures, le texte et les anneaux de focus de l'application. Tes couleurs de marque et tout ce qui se trouve sur le canevas restent exactement comme tu les as définis.
- <!--i:font--> **Large text** - agrandit la typographie de l'application : libellés, menus et texte des boutons. Les contrôles gardent leur taille, seuls les mots à l'intérieur grossissent, et la typographie de tes créations reste intacte, donc rien de ce que tu exportes ne se réorganise.

Ces réglages vivent sur la fiche du profil elle-même, c'est pourquoi ils voyagent dans un export de profil et atterrissent sur la prochaine installation aux côtés de ton nom et de tes sessions. (L'appareil conserve aussi un petit miroir local pour que le réglage s'applique avant le premier affichage ; ce miroir est propre à l'appareil et ne voyage pas.)

## Ton instance Lolly

**Profile → Lolly instance** indique d'où cette installation tire ses outils et son catalogue - l'adresse de l'instance, ou *Bundled with this app* quand tout est livré à l'intérieur du build. Quand un déploiement en propose une, un lien **Instance console** ouvre sa surface d'administration, et **Change** / **Disconnect** repointent l'installation ou la détachent.

Repointer vers une autre instance nécessite l'**application de bureau** : un navigateur empêche une page de charger des outils et des assets depuis une autre origine, donc sur le web, la section se contente d'indiquer où tu en es.

## Disponible hors connexion

Lolly met en cache au fur et à mesure, mais cette mise en cache progressive ne couvre que les endroits où tu es déjà passé. **Profile → Available offline** est fait pour le voyage que tu vois venir : une heure de wifi d'aéroport avant un vol qui n'en a pas. Télécharge les parties dont tu auras besoin, surveille une seule barre de progression, et tout ce que tu as pris continue de fonctionner une fois la connexion coupée.

Sept éléments, chacun avec sa taille indiquée avant que tu ne t'engages :

- <!--i:layout--> **L'application** - chaque vue, éditeur et police, y compris ceux que tu n'as pas encore ouverts. Sans cela, un écran jamais visité en ligne ne peut pas se charger hors connexion.
- <!--i:image--> **Catalogue** - les assets de marque au-delà de l'essentiel. Prends-le en entier, ou ouvre *Choose by tag* pour ne prendre que les tags que tu utilises.
- <!--i:book--> **Guides et docs** - ce site de documentation, dans ta langue, captures d'écran comprises.
- <!--i:cpu--> **Voix de synthèse vocale** - les modèles de voix derrière l'audio de Script et la narration. Téléchargés une fois, puis exécutés sur l'appareil.
- <!--i:zap--> **Modèles d'agrandissement** - les agrandisseurs d'image par IA : photo, illustration/anime et visage.
- <!--i:layers--> **Suppression d'arrière-plan** - les modèles de détourage sur l'appareil derrière *Remove background*.
- <!--i:shield--> **Analyse approfondie de Verify** - le scanner de filigrane sur l'appareil, pour vérifier les Content Credentials sans connexion.

Les quatre derniers sont marqués **téléchargement volumineux**, et ce sont délibérément des opt-in individuels : **Download everything** en haut télécharge l'application, le périmètre de catalogue choisi, la documentation et tous les outils en une seule fois, et rien d'autre. Les voix de synthèse vocale, les upscalers, la suppression d'arrière-plan et l'analyse approfondie ne se téléchargent chacun que lorsque tu demandes cette ligne par son nom - quelques centaines de mégaoctets cachés dans un seul bouton serait malhonnête.

Sous les blocs se trouve la liste par outil : chaque outil se télécharge individuellement (la coche signifie prêt hors ligne), ou **Download all** balaie l'ensemble. Les téléchargements sont reprenables - annule ou perds la connexion et la prochaine exécution reprend là où elle s'est arrêtée, en ne récupérant que ce qui manque - et ils se rafraîchissent automatiquement une fois de retour en ligne, en ne récupérant que ce qu'une nouvelle version a changé.

Si le navigateur n'a pas accordé de stockage persistant, la section le signale et propose **Protect downloads** (protéger les téléchargements), qui en fait la demande - la différence entre « téléchargé » et « téléchargé jusqu'à ce que le navigateur veuille récupérer l'espace ».

## Déplacer un profil vers un nouvel appareil

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Comme un profil est entièrement local, la seule façon de le faire arriver sur une installation vierge - un nouvel ordinateur portable, un navigateur fraîchement réinitialisé, la machine d'un collègue, une machine hors ligne - est de **transporter le fichier**. Aucune connexion ne le restaure pour toi, et c'est précisément le but : rien n'a jamais quitté ton appareil au départ.

- <!--i:download--> **Export my data** télécharge un fichier `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - nommé d'après le profil auquel il appartient, avec un numéro de séquence quotidien pour que les exports répétés ne se percutent pas (les parties du nom sont omises quand le profil ne les a pas). Il contient ton profil, chaque session enregistrée (avec sa vignette), tes images importées - tes tokens de marque et les polices installées voyagent avec en tant qu'assets utilisateur - et tes préférences (thème, mise en page, statistiques d'activité locales).
- <!--i:upload--> **Import data…** sur l'autre installation relit ce fichier et tu reprends exactement là où tu t'étais arrêté.
- <!--i:box--> **Export my data & render everything** écrit cette même sauvegarde *plus* un second zip qui rend chaque session enregistrée jusqu'à son fichier de sortie final, dans des dossiers qui reflètent tes Projects. Une archive hors ligne complète des sources et des résultats - et cela peut être volumineux et lent avec beaucoup de sessions.

![Les deux boutons qui déplacent toute une installation : Export my data écrit un zip, Import data le relit](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Le bundle est un simple zip autonome, donc il voyage par **n'importe quel** moyen - clé USB, AirDrop, un partage réseau, un e-mail à toi-même - et la cible peut être totalement hors ligne. Chaque partie est vérifiée par somme de contrôle, donc un fichier endommagé en transit est détecté à l'import plutôt que restauré à moitié cassé. L'import **fusionne** (un profil/une session/une image du même nom est écrasé ; tout le reste est conservé), donc il n'efface jamais une cible déjà en usage.

Ce qui ne voyage pas : le cache du catalogue (il se retélécharge tout seul sur le nouvel appareil) et les outils eux-mêmes (supposés déjà présents).

Pour la disposition exacte du bundle, la politique de version et les règles d'intégrité, voir **[Data Transfer](/info/data-transfer.html)** ; pour le parcours complet, **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Comment les outils utilisent ton profil

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Un outil ne fait jamais que *pré-remplir* les champs de profil qu'il a été explicitement conçu pour lier :

**L'opt-in (provenance).** Quand tu exportes un asset, tes coordonnées voyagent en option comme **provenance** - une ligne auteur/crédit intégrée dans les métadonnées du fichier (PNG, PDF, SVG, …) - pour qu'un asset fini puisse dire qui l'a créé. *C'est* ce que gouverne **Use my details to create** : laisse-le désactivé et l'export porte toujours l'attribution outil/plateforme "Made with Lolly", mais aucune ligne auteur/contact personnelle n'est intégrée. (Le même opt-in définit l'auteur sur les exécutions par lot **/pro**.) (Auteurs d'outils : voir [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) et [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Le seul interrupteur Use my details to create, situé à côté de Save Profile et désactivé jusqu'à ce que tu l'actives](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil vs Plateforme vs Capacités

Trois choses se côtoient dans l'interface et sont faciles à confondre :

- <!--i:people--> **Profile** - *toi* (ou ton équipe, ou le rôle que tu occupes) : nom, contact, photo, ton travail enregistré. Personnel, local à l'appareil, transportable sous forme de bundle.
- <!--i:palette--> **Platform** - la *marque* : couleurs, polices et paramètres globaux sur lesquels chaque outil s'appuie pour son rendu. Partagé et cohérent, pas personnel.
- <!--i:sliders--> **Capabilities** - *ce que l'application peut faire* : l'ensemble des fonctionnalités et les outils qui te sont accessibles.

Un profil change *de qui* vient un asset ; la plateforme change son *apparence* ; les capacités déterminent *ce que tu peux créer*.

### « Profil » a deux autres sens ailleurs - pas celui-ci

Le mot est surchargé de sens dans l'ensemble du projet. Aucun des deux n'est le profil personnel dont parle cette page :

- <!--i:box--> **Content profile** - une configuration au moment du build dans `profiles.json` qui lie un ensemble de packs d'outils à un catalogue de marque (par ex. `suse`, `lolly-start`). C'est ce qu'un opérateur choisit au déploiement, et c'est aussi ce que le **paramètre URL/CLI** `profile` sélectionne comme variante de *couleur* au moment de l'export (la condition d'impression ICC/CMYK - voir [URL Mode](/info/url-mode.html)). Les deux concernent le *build/la sortie*, pas *toi*. Voir [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - l'**identité Content Credentials vérifiée** optionnelle que tu peux enrôler (un certificat de courte durée qui lie ton e-mail à tes exports signés). C'est une identité de signature, distincte des champs nom/contact du profil personnel, bien que **Use my details to create** gouverne si l'un ou l'autre est intégré. Voir [Content Credentials Identity](/info/content-credentials-identity.html).

![La carte d'identité vérifiée, largeur téléphone : le sélecteur de durée de vie du certificat et l'étape d'enrôlement en dessous - le profil d'identité, distinct de tes coordonnées personnelles](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Confidentialité

En dehors de l'enrôlement d'identité optionnel ci-dessus (qui envoie l'e-mail que tu enrôles au service de certificat - voir [Server Surface](/info/server-surface.html)), un profil n'est jamais transmis, téléversé ni utilisé pour t'identifier ou te suivre - il n'y a rien à consentir, seulement cet avis pour que tu saches ce qui est conservé. Efface tout à tout moment avec **Profile → Clear all my data**. Voir la [Privacy Policy](/info/privacy.html).
