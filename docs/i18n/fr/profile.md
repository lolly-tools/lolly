# Profils

Renseigne une fois ton nom, tes coordonnées et ta photo de portrait, et chaque outil conçu pour les utiliser les remplit automatiquement, comme une signature d'e-mail, un badge ou une fiche d'intervenant. Cet ensemble d'informations est ton **profil**, et il reste sur ton appareil.

Ton profil contient aussi les sessions enregistrées, les images importées et ton compteur d'activité local. Gère-le sous **Settings → Preferences**. Les outils ne lisent que les champs qu'ils ont été conçus pour préremplir. L'utilisation autonome ne demande aucun compte. Sync, le partage et les services d'organisation facultatifs ont chacun leurs propres flux de données.

<!--i:eti-user-check-->
## Ce que contient un profil

| Partie | Description |
|---|---|
| **Name** | Prénom et nom. |
| **Contact** | E-mail et téléphone. |
| **Location** | Ville et pays. |
| **Headshot** | Une photo facultative, recadrée en carré et conservée comme image locale, pour des outils comme les signatures d'e-mail, les cartes de citation et les organigrammes. |
| **Use my details to create** | Une bascule à activer volontairement, qui affiche **Using my details** une fois activée. Elle détermine si tes informations figurent comme crédit d'auteur dans les fichiers exportés et lors des exécutions de Lolly Batch ; voir [Comment les outils utilisent ton profil](#how-tools-use-your-profile). |
| **Preferences** | Ton thème, ton colourway dans chaque design system, tes réglages d'accessibilité et les parties de l'application que tu as activées dans **Feature flags**. |
| **Your work** | Les sessions enregistrées avec leurs vignettes, organisées dans [Lolly Projects](/info/find-your-work.html), tes images importées et tes statistiques d'activité locales. |

Rien de tout cela n'est obligatoire, et un profil vide fonctionne.

![Settings dans l'onglet Preferences : la barre latérale des réglages et Your details avec la bascule Use my details to create et les champs de nom, de contact et de lieu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Réglages de Lolly](/info/dashboard.html) décrit le reste de Preferences, de l'apparence et des emoji au stockage et aux téléchargements hors ligne.

<!--i:eti-users-->
## Toi, une équipe ou un rôle

Dans Lolly, un profil représente qui tu es pendant que tu crées quelque chose : toi-même, une équipe ou un rôle. Lolly gère les trois de la même façon.

::: cols
## En ton nom

Par défaut : ton nom, ton e-mail et ta photo de portrait. Ta signature, ton badge et ta composition pour une conférence se remplissent à partir de ces informations.

## Au nom d'une équipe

Le nom partagé d'une équipe, une boîte de réception de groupe comme `events@…`, un service et le logo de l'équipe. Une personne configure le profil et exporte un fichier. Toutes les autres chargent le même profil, donc les fichiers de l'équipe portent les mêmes informations. Une borne partagée ou un ordinateur portable de démonstration peut utiliser un profil d'équipe.

## Dans un rôle

Une personne responsable d'événement a besoin de la boîte de réception et de la sous-marque de l'événement sur les badges et la signalétique trois jours par an, puis de retrouver son identité habituelle. Conserve le rôle dans un fichier de profil enregistré, charge le fichier pour l'événement et mets-le de côté ensuite.
:::

![Le contrôle de photo de portrait, vide jusqu'à ce que tu importes une photo qui reste ensuite sur cet appareil](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Les profils dans une organisation qui utilise Lolly Work
Quand tu te connectes au [Lolly d'une organisation](/info/organisation.html), Lolly Work peut fournir des champs de profil vérifiés depuis son fournisseur d'identité et imposer des champs ou des préférences selon la politique de l'organisation. Un champ géré est signalé dans l'application.

Cette connexion contrôle aussi l'accès aux projets et aux ressources partagés. Un fichier de profil d'équipe est un fichier local. Il ne donne pas le statut de membre de l'organisation et ne remplace pas un compte professionnel. **Use my details to create** contrôle le crédit dans tes exports, pas la connexion ni les enregistrements d'audit de l'organisation. Voir [Confidentialité](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## En garder plusieurs, en utiliser un

Une installation a un seul profil actif à la fois, sans sélecteur de profil dans l'application. Chaque profil est un fichier portable, le même fichier de sauvegarde qui déplace ton travail vers un nouvel appareil. Pour changer de contexte :

::: timeline
- <!--i:download--> **Export my data** sous **Settings → Storage → Move to another device** enregistre le profil actuel dans un seul `.zip`.
- <!--i:trash--> **Clear all my data** vide cette installation.
- <!--i:upload--> **Import data…** charge le fichier de profil du contexte dans lequel tu passes.
:::

::: note Importer sans effacer d'abord entraîne une fusion
Les sessions et les images importées sont ajoutées. Quand les deux copies existent, la plus récemment enregistrée est conservée. Les dossiers, favoris et modèles sont ajoutés à côté des tiens. Tes propres informations restent, sauf les champs vides, qui prennent les valeurs du fichier. Une fusion convient pour intégrer les sessions d'une équipe à ton environnement, mais pas pour séparer nettement les rôles.
:::

Pour deux contextes à la fois, utilise un profil de navigateur, un compte utilisateur ou une copie installée de l'application web distincts. Chacun a son propre profil Lolly.

![Les deux boutons qui déplacent toute une installation : Export my data écrit un zip, Import data le relit](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Garde un fichier par contexte
Nomme chaque fichier selon ce qu'il contient, comme `LollyTools-events-2026.zip` et `LollyTools-me.zip`. Le fichier est le profil.
:::

[Déplacer ton travail vers un autre appareil](/info/find-your-work.html#move-your-work-to-another-device) décrit ce que contient le fichier, ce qui reste sur place et les autres moyens de déplacement, dont Sync.

<!--i:eti-pen-->
## Comment les outils utilisent ton profil

**Préremplissage.** L'auteur d'un outil indique qu'une entrée puise dans ton profil (`bindToProfile: "firstname"`, `"email"`, `"headshot"` et ainsi de suite). Quand l'outil s'ouvre, cette entrée se remplit à partir de ton profil. Tu peux remplacer la valeur pour une session sans changer le profil, sauf si une politique d'organisation verrouille l'entrée. Le préremplissage est local et se fait que **Use my details** soit activé ou non.

**Crédit.** Quand tu exportes, tes informations peuvent figurer comme crédit d'auteur dans les métadonnées du fichier (PNG, PDF, SVG et d'autres). **Use my details to create** contrôle ce crédit et l'auteur lors des exécutions de Lolly Batch. Quand la bascule est désactivée, l'export indique toujours qu'il a été créé avec Lolly, mais ne porte aucune mention personnelle d'auteur ni de coordonnées.

Auteurs d'outils : voir [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) et [`host.profile`](/info/host-api.html#host-profile).

![L'unique bascule Use my details to create, signalée comme facultative et désactivée jusqu'à ce que tu l'actives](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profil, design system et capacités

Trois éléments voisins dans Settings sont faciles à confondre :

- <!--i:people--> **Profile** - toi, ton équipe ou le rôle que tu occupes : nom, coordonnées, photo de portrait et travail enregistré. Personnel, conservé sur l'appareil et portable sous forme de fichier.
- <!--i:palette--> **Design system** - la marque : couleurs, polices et réglages utilisés pour le rendu de chaque outil. Partagé, pas personnel ; voir [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - ce que l'application peut faire : les fonctionnalités et les outils à ta disposition.

Le mot a trois autres sens dans Lolly. Un **profil de contenu** est un réglage de compilation qui choisit les outils et le catalogue inclus dans un déploiement ; le [glossaire](/info/glossary.html) définit le terme. Le paramètre de lien `profile` choisit un profil colorimétrique pour un export, comme une condition d'impression CMYK ; voir [Paramètres d'URL réservés](/info/url-parameters.html#print). Une **identité vérifiée** est le certificat de signature facultatif qui relie ton e-mail à tes exports signés. Elle est distincte de ces informations, mais **Use my details to create** décide si l'une ou les autres sont incorporées ; voir [Content Credentials](/info/content-credentials-identity.html).

![La carte Verified identity à la largeur d'un téléphone : le sélecteur de durée de validité du certificat et l'étape d'inscription en dessous - le profil d'identité, distinct de tes informations personnelles](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Confidentialité

Ton profil personnel est stocké localement. Tes informations peuvent être transmises dans une sauvegarde ou une copie Sync, dans le contenu que tu partages ou exportes et lors de l'inscription facultative à Content Credentials. Sur une instance Lolly Work, la connexion, le travail partagé, la politique de télémétrie et les enregistrements d'audit sont distincts de ce profil local. **Settings → Preferences → Clear all my data** efface les données de cet appareil ; cela n'efface pas les copies détenues par ton fournisseur de stockage ou ton organisation. Voir la [politique de confidentialité](/info/privacy.html).
