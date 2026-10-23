# Profils

Définis une fois ton nom, tes coordonnées et ta photo, et chaque outil conçu pour les utiliser les remplit pour toi : une signature d'e-mail, un badge, une carte d'intervenant. Ce petit enregistrement est ton **profil**, et il vit sur ton appareil.

Ton profil contient aussi ce que tu accumules en travaillant : sessions enregistrées, images importées et ton décompte d'activité local. Tu le gères sous **Settings → Preferences** ; les outils ne lisent jamais que les champs qu'ils ont été conçus pour préremplir. L'usage autonome n'a besoin d'aucun compte, et Sync facultatif, le partage et les services d'organisation ont chacun leurs propres flux de données, décrits plus bas.

## Ce qu'il y a dans un profil

| Partie | Ce que c'est |
|---|---|
| **Name** | Prénom et nom. |
| **Contact** | E-mail et téléphone. |
| **Location** | Ville et pays. |
| **Headshot** | Une photo facultative, recadrée en carré et conservée comme image locale, pour des outils comme les signatures d'e-mail, les cartes de citation et les organigrammes. |
| **Use my details to create** | Un interrupteur facultatif (il affiche **Using my details** une fois activé). Il décide si tes informations voyagent comme crédit d'auteur dans les fichiers exportés et dans les lots de Batch. Il n'affecte pas le préremplissage ; voir [How tools use your profile](#how-tools-use-your-profile). |
| **Preferences** | Ton thème, tes réglages d'accessibilité et les parties de l'application que tu as activées dans **Feature flags**. |
| **Your work** | Les sessions enregistrées avec leurs vignettes, organisées dans [Projects](/info/find-your-work.html), tes images importées et tes statistiques d'activité locales. |

Rien de tout cela n'est obligatoire. Un profil vide fonctionne ; ne remplis que ce qui t'évite de taper.

![Settings sur l'onglet Preferences : le rail des réglages, et Your details avec l'interrupteur Use my details to create et les champs de nom, de contact et de lieu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) cartographie tout le reste sous Preferences, de l'apparence et des emoji au stockage et aux téléchargements hors ligne.

## Toi, une équipe ou un rôle

Le mot « profil » suggère une personne figée. Dans Lolly, c'est plus proche d'un contexte de création : qui tu es pendant que tu fais cette chose. Il peut prendre trois formes, et Lolly traite chacune de la même façon.

::: cols
## En ton nom

Le défaut. Ton nom, ton e-mail, ta photo. Définis-le une fois et ta signature, ton badge et ton bloc de conférence se remplissent tout seuls.

## En tant qu'équipe

Le nom partagé d'une équipe, une boîte de groupe comme `events@…`, un service et la marque de l'équipe. Une personne la configure et l'exporte, et tous les autres chargent le même profil, donc les fichiers de l'équipe portent des informations cohérentes. Une borne partagée ou un portable de démonstration peut faire tourner un profil d'équipe.

## En tant que rôle

Un responsable d'événement veut, trois jours par an, la boîte de l'événement et la sous-marque de l'événement sur les badges et la signalétique, puis retrouver son identité habituelle. Garde ce rôle comme fichier de profil enregistré, charge-le pour l'événement et mets-le de côté ensuite.
:::

![Le contrôle de photo de profil, vide jusqu'à ce que tu importes une photo qui reste ensuite sur cet appareil](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Les profils dans une organisation qui utilise Lolly Work
Quand tu te connectes à [Lolly d'une organisation](/info/organisation.html), Lolly Work peut fournir des champs de profil vérifiés depuis son fournisseur d'identité et fixer des champs ou des préférences selon la politique de l'organisation. Un champ géré est étiqueté dans l'application.

Cette connexion contrôle aussi l'accès aux projets et ressources partagés. Un fichier de profil d'équipe reste un fichier local : il n'accorde pas l'appartenance à l'organisation et ne remplace pas un compte de travail. **Use my details to create** contrôle le crédit dans tes exports, pas la connexion de l'organisation ni ses enregistrements d'audit. Voir [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

## En garder plusieurs, en utiliser un

Une installation n'a qu'un profil actif à la fois, et il n'y a pas de sélecteur dans l'application. À la place, chaque profil est un fichier portable, le même fichier de sauvegarde que tu utiliserais pour passer sur un nouvel appareil. Pour entrer dans un autre contexte :

::: timeline
- <!--i:download--> **Export my data** sous **Settings → Storage → Move to another device** enregistre le profil actuel dans un seul `.zip`.
- <!--i:trash--> **Clear all my data** vide cette installation.
- <!--i:upload--> **Import data…** charge le fichier de profil du contexte dans lequel tu entres.
:::

Importer sans vider d'abord **fusionne** à la place. Les sessions et images importées sont ajoutées ; quand les deux copies existent, la plus récemment enregistrée est conservée. Les dossiers, favoris et modèles sont ajoutés à côté des tiens, et tes propres informations restent, sauf les champs vides, qui prennent les valeurs du fichier. Cela convient pour intégrer les sessions d'une équipe à ta propre configuration, mais pas pour une rupture nette entre rôles.

Pour deux contextes à la fois, utilise un profil de navigateur distinct, un compte utilisateur distinct ou une seconde copie installée de l'application web : chacun porte son propre profil Lolly indépendant.

![Les deux boutons qui déplacent toute une installation : Export my data écrit un zip, Import data le relit](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Garde un fichier par contexte et nomme chacun pour ce qu'il est, comme `LollyTools-events-2026.zip` et `LollyTools-me.zip`. Le fichier est le profil.

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) couvre ce que contient le fichier, ce qui reste en arrière et les autres moyens de déplacer, y compris Sync.

## Comment les outils utilisent ton profil

**Préremplissage.** L'auteur d'un outil marque une entrée comme tirée de ton profil (`bindToProfile: "firstname"`, `"email"`, `"headshot"` et ainsi de suite). Quand l'outil s'ouvre, cette entrée se remplit depuis ton profil, et tu peux la remplacer pour une session sans changer le profil, sauf si une politique d'organisation verrouille l'entrée. Le préremplissage est un confort local et a lieu que **Use my details** soit activé ou non.

**Crédit.** Quand tu exportes, tes informations peuvent voyager comme crédit d'auteur dans les métadonnées du fichier (PNG, PDF, SVG et plus), pour qu'un fichier terminé puisse dire qui a fait le travail. **Use my details to create** régit cela, ainsi que l'auteur dans les lots de Batch. Désactivé, l'export dit quand même qu'il a été fait avec Lolly, et ne porte aucune mention personnelle d'auteur ni de contact.

Pour les auteurs d'outils : voir [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) et [`host.profile`](/info/host-api.html#host-profile).

![L'unique interrupteur Use my details to create, marqué facultatif et désactivé tant que tu ne l'actives pas](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, design system et capacités

Trois éléments se côtoient dans Settings et se confondent facilement :

- <!--i:people--> **Profile** - toi, ton équipe ou le rôle dans lequel tu es : nom, coordonnées, photo et travail enregistré. Personnel, conservé sur l'appareil et portable sous forme de fichier.
- <!--i:palette--> **Design system** - la marque : couleurs, polices et réglages avec lesquels chaque outil effectue son rendu. Partagé et cohérent plutôt que personnel ; voir [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - ce que l'application sait faire : les fonctions et outils qui te sont disponibles.

Un profil change de qui vient un fichier ; le design system change l'aspect du fichier ; les capacités sont ce que tu peux créer.

Le mot a trois autres sens dans Lolly. Un **profil de contenu** est un réglage de build qui choisit les outils et le catalogue qu'un déploiement embarque ; le [Glossary](/info/glossary.html) définit le terme. Le paramètre de lien `profile` choisit un profil colorimétrique pour un export, comme une condition d'impression CMJN ; voir [Reserved URL parameters](/info/url-parameters.html#print). Une **identité vérifiée** est le certificat de signature facultatif qui relie ton e-mail à tes exports signés, distinct de ces informations, même si **Use my details to create** régit si l'un ou l'autre est incorporé ; voir [Content Credentials](/info/content-credentials-identity.html).

![La carte d'identité vérifiée, largeur téléphone : le sélecteur de durée de vie du certificat et l'étape d'enrôlement en dessous - le profil d'identité, distinct de tes coordonnées personnelles](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Confidentialité

Ton profil personnel est stocké localement. Tes informations peuvent voyager dans une sauvegarde ou une copie Sync, dans le contenu que tu partages ou exportes et lors de l'inscription facultative aux Content Credentials. Sur une instance Lolly Work, la connexion, le travail partagé, la politique de télémétrie et les enregistrements d'audit sont distincts de ce profil local. **Settings → Preferences → Clear all my data** efface cet appareil ; cela n'efface pas les copies détenues par ton fournisseur de stockage ou ton organisation. Voir la [Privacy Policy](/info/privacy.html).
