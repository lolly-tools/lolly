# Politique de confidentialité

*Dernière mise à jour : 11 août 2026*

> **La version courte.** Les documents, images, vidéos et fichiers que tu crées dans Lolly restent
> sur ton appareil. Il n'y a pas de comptes pour un usage ordinaire, pas de cookies venant de l'app
> elle-même et pas d'analytique ni de traceurs nulle part dans le code - pas « on n'utilise pas
> les données », vraiment absent du code source. Il existe une liste courte et complète
> d'exceptions où le logiciel parle à un réseau, et chacune
> d'elles est décrite ci-dessous en détail : ce qui sort, vers qui et quand. La seule
> exception qui touche à quelque chose de personnel est une connexion que tu dois démarrer
> explicitement. Si ce n'est pas dans ce document, ça n'arrive pas.

## Ce que couvre cette politique

Lolly est un logiciel open source - un moteur, plusieurs coques applicatives (web,
bureau, mobile, CLI) et une extension de navigateur - que n'importe qui peut exécuter.
Cette politique comporte deux parties :

- <!--i:code--> **Le logiciel lui-même** : ce qu'il fait et ne fait pas avec tes données, où qu'il
  s'exécute. C'est une propriété du code, donc c'est vrai pour tout déploiement de
  Lolly, le nôtre ou celui de n'importe qui d'autre.
- <!--i:server--> **lolly.tools**, le déploiement de référence exploité par SUSE : les choix
  spécifiques faits pour l'exécution de ses éléments côté serveur optionnels (ce qui
  est journalisé, pendant combien de temps, par qui).

Si tu utilises une instance Lolly auto-hébergée ou d'entreprise, le comportement du
logiciel décrit ci-dessous s'applique toujours, mais l'*opérateur* de cette instance -
et non SUSE - est responsable de tout ce qui est côté serveur : son point de rendu, son
serveur MCP, son autorité de certification Content Credentials, s'il en exploite une.
Demande-leur leur propre politique. Voir [Adoption & gouvernance](/info/adoption-governance.html)
pour ce qu'implique l'exploitation de Lolly.

## L'application : ce qui reste sur ton appareil

Les coques web, bureau et mobile de Lolly exécutent l'intégralité du moteur de rendu
côté client. Ouvrir un outil, remplir des champs, prévisualiser et exporter se passent
tous sur ton appareil - aucun serveur n'intervient, et l'application fonctionne hors
ligne une fois chargée.

**L'application ne dépose aucun cookie.** Pour fonctionner, elle conserve une petite
quantité de données **uniquement sur ton appareil**, jamais transmises :

- <!--i:sliders--> **Préférences d'interface** - thème, langue, réglages sonores, dimensionnement
  barre latérale/zoom, choix de tri et d'affichage, conseils d'accueil déjà vus - dans
  `localStorage`, pour qu'elles soient disponibles avant que l'application ait fini de
  démarrer.
- <!--i:download--> **Un cache hors ligne du catalogue d'outils et des aperçus d'assets**, pour que
  la galerie fonctionne sans connexion.
- <!--i:hash--> **Compteurs d'usage locaux** pour les statistiques de ta carte de profil (nombre
  d'exports, quels outils) - un petit blob borné dans `localStorage`, jamais lu par
  nous, jamais envoyé nulle part.
- <!--i:folder--> **Tes propres documents, sessions enregistrées, assets et polices
  téléversés** - stockés dans IndexedDB sur ton appareil, jamais téléversés, jamais lus
  par personne d'autre que toi.

Rien de tout cela n'est partagé, vendu ni utilisé pour t'identifier ou te suivre. Il n'y a
rien à quoi consentir, parce qu'aucune collecte n'a lieu - seulement cet avis, pour que tu
saches ce qui est conservé et où. Effacer le stockage du site dans ton navigateur supprime
tout cela à tout moment, tout comme **Paramètres → Stockage → Effacer toutes mes données**,
qui désactive aussi Sync au passage. (Selon la directive ePrivacy Art. 5(3), un stockage
strictement nécessaire au service que tu as demandé ne nécessite pas de consentement -
seulement de la transparence, ce que sont à la fois ce document et l'avis affiché dans
l'application.)

![La section stockage de la page profil sur un écran largeur téléphone : chaque catégorie de données sur l'appareil nommée, avec le bouton Clear all my data juste à côté](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Ta propre sauvegarde de ces données - le pack `lolly-backup` produit par
**Exporter mes données** - est un fichier que tu conserves et contrôles.
Il ne touche jamais nos serveurs à moins que tu ne choisisses toi-même de
l'envoyer quelque part. Voir [Transfert de données](/info/data-transfer.html).

## Utilitaires sur l'appareil

Certains outils - **Strip Hidden Data**, **Compress PDF** et d'autres portant le badge
**"Runs on your device"** - opèrent sur un fichier que tu fournis. Le fichier est lu en
mémoire dans ton navigateur, transformé localement et proposé en retour au
téléchargement. Il n'est jamais téléversé, parce qu'il n'y a aucun serveur dans le
circuit vers lequel le téléverser. Ces utilitaires fonctionnent hors ligne, et leur
résultat ne porte aucun filigrane ni métadonnée de notre part - le but de la plupart
d'entre eux est de retirer & protéger des données, pas d'ajouter un risque.

![Le badge que portent ces outils : Runs on your device - rien n'est téléversé](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

Prepare for sharing conserve les entrées de travail, les découvertes privées et les tables de remplacement en
mémoire, sans les ajouter automatiquement à l'historique, aux liens, aux sauvegardes ou à la synchronisation.
L'inspection et le remplacement n'envoient pas le contenu des fichiers à un serveur et ne valident pas
d'identifiants en ligne. Les utilisateurs choisissent de copier, télécharger, envoyer ou explicitement
enregistrer un résultat dans leur bibliothèque ; un résultat enregistré suit ensuite les réglages habituels de
sauvegarde et de synchronisation de la bibliothèque. Les fichiers de recette omettent les contenus précédents
et les tables littérales. Les rapports de synthèse contiennent des comptages, des identifiants de portée et des
empreintes de fichiers. La CLI peut aussi enregistrer un fichier de relecture privé contenant les valeurs
d'origine, uniquement sur demande explicite avec `--review-file` . Effacer ou quitter une vue de préparation
dans le navigateur libère son état de travail ; ce n'est pas une promesse d'effacement forensique de la mémoire du navigateur ou du système.

## Quand l'application communique avec un réseau, en détail

Le tableau ci-dessous est la liste complète de tout ce que l'application récupère ou
envoie sur un réseau. Si ce n'est pas ici, l'application ne le fait pas.

| Quoi | Ce qui quitte réellement ton appareil | Quand (l'action qui le déclenche) | Si un opérateur le bloque |
|---|---|---|---|
| Synchronisation du catalogue d'outils | Rien de personnel - une requête vers l'index public des outils et des ressources propres à Lolly, vers l'origine propre de l'application | Au démarrage, puis mis en cache hors ligne | L'application fonctionne avec son ensemble d'outils mis en cache. Elle cesse seulement de découvrir de nouveaux outils |
| Un outil qui a besoin de données en direct | Ce que cet outil précis demande, vers l'hôte nommé dans sa propre description. Aujourd'hui, il s'agit uniquement de la recherche de ville dans l'outil Meeting Planner, qui demande à `geocoding-api.open-meteo.com` de transformer un nom de ville en coordonnées et en fuseau horaire - aucun compte, aucune clé et aucun identifiant au-delà de la requête elle-même. Le champ de saisie le précise à l'endroit même où tu tapes, et chaque réponse est enregistrée sur ton appareil afin qu'une ville ne soit recherchée qu'une seule fois | Seulement pendant l'utilisation de cet outil, et seulement une fois que tu saisis un lieu | Cette recherche échoue. Tu peux toujours saisir des coordonnées à la main, et rien d'autre n'est affecté |
| Google Fonts | Le nom de la famille de police choisie et ton adresse IP, vers les serveurs de polices de Google (`fonts.googleapis.com` pour la feuille de style, `fonts.gstatic.com` pour le fichier de police) | Seulement si tu ajoutes une police Google dans l'éditeur de marque, **et seulement après que tu l'acceptes dans une boîte de dialogue qui dit exactement cela** - une récupération unique par famille, qui vit ensuite sur ton appareil et est utilisée hors ligne | Le sélecteur Google Fonts échoue en mode fermé. Importe plutôt un fichier de police |
| Envoyer vers Google Drive | Le seul fichier que tu as choisi d'envoyer, vers l'API Drive de Google (`www.googleapis.com`), après une connexion Google que tu effectues dans la propre fenêtre pop-up de Google. L'accès de Lolly se limite aux fichiers qu'elle a créés (le scope `drive.file` - elle ne peut jamais lire le reste de ton Drive), et le jeton de connexion est conservé en mémoire pour la session, jamais stocké | Seulement quand tu appuies sur "Send to Google Drive" sur un export EMF, et seulement sur les versions où l'opérateur a configuré un identifiant client Google - sans cela, le bouton n'existe pas | Le bouton n'apparaît jamais. Télécharge le fichier et importe-le toi-même dans Drive |
| Envoyer vers Dropbox | Le seul fichier que tu as choisi d'envoyer, vers l'API Dropbox (`api.dropboxapi.com` pour la connexion et les métadonnées, `content.dropboxapi.com` pour le fichier lui-même), après une connexion Dropbox que tu effectues dans la propre fenêtre de Dropbox. L'accès de Lolly se limite au dossier de l'application (elle ne peut voir que `Apps/` et son propre dossier à cet endroit - jamais le reste de ton Dropbox), le lien "Open" qu'elle t'affiche est un lien privé de courte durée (aucun partage public n'est créé), et un jeton de rafraîchissement n'est stocké que si tu coches "stay connected" | Seulement quand tu appuies sur "Send to Dropbox" sur un fichier, et seulement sur les versions où l'opérateur a configuré un identifiant client Dropbox - sans cela, le bouton n'existe pas | Le bouton n'apparaît jamais. Télécharge le fichier et importe-le toi-même dans Dropbox |
| Envoyer vers OneDrive | Le seul fichier que tu as choisi d'envoyer, vers les services d'identité et Graph de Microsoft (`login.microsoftonline.com` pour la connexion, `graph.microsoft.com` pour l'envoi ; un fichier volumineux est envoyé par blocs vers une adresse d'envoi appartenant à Microsoft sur `api.onedrive.com`, `*.up.1drv.com` ou `*.sharepoint.com`), après une connexion Microsoft que tu effectues dans la propre fenêtre de Microsoft. L'accès de Lolly se limite à son propre dossier sous `Apps/` (elle ne peut jamais lire le reste de ton OneDrive), plus ton nom d'affichage pour l'étiquette du compte, et un jeton de rafraîchissement n'est stocké que si tu coches "stay connected" | Seulement quand tu appuies sur "Send to OneDrive" sur un fichier, et seulement sur les versions où l'opérateur a configuré un identifiant client Microsoft - sans cela, le bouton n'existe pas | Le bouton n'apparaît jamais. Télécharge le fichier et importe-le toi-même dans OneDrive |
| Envoyer vers LinkedIn | Le seul fichier que tu as choisi d'envoyer, plus son nom comme texte de la publication, vers LinkedIn (`www.linkedin.com` pour la connexion, `api.linkedin.com` pour l'envoi et la publication), après une connexion LinkedIn que tu effectues dans ton propre navigateur. La publication part sur ton propre fil, en tant que publication publique sous ton nom. Lolly peut publier en ton nom et lire ton nom pour l'étiquette du compte, rien d'autre sur ton LinkedIn, et la connexion n'est conservée sur cet appareil que si tu coches "stay connected" - les jetons de LinkedIn durent 60 jours et ne peuvent pas être renouvelés silencieusement, donc ils expirent d'eux-mêmes | Seulement quand tu appuies sur "Send to LinkedIn" sur un fichier, uniquement dans les applications de bureau, et seulement sur les versions où une application LinkedIn est configurée - sans cela, le bouton n'existe pas | Rien à bloquer dans l'application web : cela n'existe que dans les **applications de bureau**, donc ces deux hôtes sont volontairement ABSENTS de la Content-Security-Policy de l'application web ci-dessous. Dans les applications de bureau, supprime l'application LinkedIn configurée et le bouton n'apparaît plus |
| Envoyer vers Penpot | Ton jeton d'accès personnel Penpot (que tu colles dans l'application) et l'archive `.penpot` du design que tu as choisi d'envoyer, vers l'API de Penpot (`design.penpot.app`) via une petite passerelle sur l'origine propre de l'application (`/api/penpot`), parce que l'API de Penpot ne répond pas directement à un navigateur. La passerelle transmet et oublie ; les applications de bureau parlent directement à Penpot | Seulement quand tu appuies sur "Send to Penpot" dans l'outil Design et que tu confirmes un projet | La passerelle renvoie une erreur et l'envoi échoue en mode fermé. Exporte le fichier `.penpot` et importe-le toi-même dans Penpot |
| Envoyer vers Bluesky | La seule image que tu as choisi d'envoyer, son nom comme texte de publication et texte alternatif, ainsi que ton identifiant et un mot de passe d'application (Bluesky → Settings → App passwords, jamais le mot de passe de ton compte), vers le serveur Bluesky que tu nommes (`bsky.social` sauf si tu t'auto-héberges). Le mot de passe d'application est stocké uniquement sur cet appareil, jamais dans une sauvegarde, et Disconnect l'efface | Seulement quand tu appuies sur "Send to Bluesky" sur une image, après avoir connecté le compte dans ton profil, uniquement dans les **applications de bureau** | Rien à bloquer dans l'application web : sa politique ci-dessous ne liste aucun hôte Bluesky, ce passage n'y existe donc pas. Dans les applications de bureau, supprime la connexion et le bouton n'apparaît plus |
| Envoyer vers Discord | Le seul fichier que tu as choisi d'envoyer, en pièce jointe, vers l'adresse webhook du canal que tu as collée (`discord.com`). Une adresse webhook permet à quiconque la détient de publier dans ce canal, elle est donc stockée uniquement sur cet appareil, jamais dans une sauvegarde, et Disconnect l'efface | Seulement quand tu appuies sur "Send to Discord" sur un fichier, uniquement dans les **applications de bureau** | Rien à bloquer dans l'application web : sa politique ci-dessous ne nomme pas `discord.com`, ce passage n'y existe donc pas. Dans les applications de bureau, supprime le webhook et le bouton n'apparaît plus |
| Envoyer vers Mastodon | Le seul fichier que tu as choisi d'envoyer et son nom comme texte de publication, vers le serveur Mastodon (ou compatible) que tu nommes, après une connexion que tu effectues dans la propre fenêtre de ce serveur. Se connecter enregistre une petite application propre à l'appareil sur ce serveur ; la connexion n'est conservée sur cet appareil que si tu coches "stay connected" | Seulement quand tu appuies sur "Send to Mastodon" sur un fichier. Tu choisis le serveur, il n'est donc pas dans la politique ci-dessous | Le serveur que tu nommes doit autoriser les appels du navigateur ; sinon, utilise les applications de bureau. Disconnect retire le bouton |
| Envoyer vers Nextcloud / WebDAV | Le seul fichier que tu as choisi d'envoyer, vers ton propre serveur, via une requête PUT authentifiée avec l'adresse du serveur, le nom d'utilisateur et le mot de passe d'application que tu as saisis (Nextcloud → Settings → Security → Devices & sessions ; jamais le mot de passe de ton compte). Stocké uniquement sur cet appareil, jamais dans une sauvegarde, effacé par Disconnect | Seulement quand tu appuies sur "Send to Nextcloud" sur un fichier. Tu choisis le serveur, il n'est donc pas dans la politique ci-dessous | Ton serveur doit autoriser les appels du navigateur depuis l'origine de l'application ; sinon, utilise les applications de bureau |
| Envoyer vers un stockage compatible S3 | Le seul fichier que tu as choisi d'envoyer, vers ton propre bucket (AWS S3, MinIO, R2, B2, Garage - n'importe quel point de terminaison SigV4), signé sur ton appareil avec la paire de clés que tu as saisie. Les clés sont stockées uniquement sur cet appareil, jamais dans une sauvegarde, effacées par Disconnect | Seulement quand tu appuies sur "Send to S3" sur un fichier. Tu choisis le point de terminaison, il n'est donc pas dans la politique ci-dessous | Les règles CORS de ton bucket doivent autoriser l'origine de l'application ; sinon, utilise les applications de bureau |
| Synchroniser tous tes appareils | Une copie de ce que tu as fait sur cet appareil - sessions et projets enregistrés, tes systèmes de design avec leurs polices et logos, images téléversées, ton profil et tes préférences - sous forme d'un seul fichier, vers le seul espace de stockage que tu as choisi : le dossier de l'application Lolly dans ton Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), les fichiers créés par Lolly dans ton Google Drive (`www.googleapis.com`), le dossier de l'application Lolly dans ton OneDrive (`graph.microsoft.com`, les fichiers plus volumineux étant envoyés vers `api.onedrive.com`, `*.up.1drv.com` ou `*.sharepoint.com`, et les téléchargements provenant des adresses Microsoft `*.files.1drv.com`, `my.microsoftpersonalcontent.com` ou `*.sharepoint.com`), ou ton propre serveur Nextcloud / WebDAV ou bucket S3. Ce même espace de stockage conserve aussi jusqu'à sept copies quotidiennes et une copie antérieure à ta dernière application. **Rien ne va vers Lolly :** aucun serveur Lolly, relais ou serveur Lolly Work ne se trouve sur le chemin, et les applications n'ont besoin d'aucun site Lolly pour cela, pas même pour se connecter. La copie n'est chiffrée sur ton appareil au préalable que si tu définis une phrase secrète. Les connexions, les clés, les mots de passe d'application, la phrase secrète et les réglages de synchronisation restent sur l'appareil et ne sont jamais dans la copie. Sur le web, une connexion Google Drive mémorisée ne conserve que le nom de ton compte (et ton propre identifiant client, si tu en as fourni un) ; la connexion Google elle-même ne dure qu'une visite. Dans l'application Android, la connexion Google Drive passe par les services Google Play du téléphone, exploités par Google | Seulement après avoir activé "Sync across my devices" ou appuyé sur "Sync now" : un envoi peu après chaque modification et quand tu quittes l'application, ainsi qu'une vérification d'une copie plus récente au démarrage de l'application | La synchronisation échoue et indique pourquoi ; ton travail reste sur l'appareil. Exporte plutôt tes données dans un fichier et transfère-les toi-même |
| Profils d'impression ICC | Rien de personnel - une requête pour un profil de condition d'impression standard, vers le registre public de l'ICC (`registry.color.org`, `www.color.org`) | Seulement si tu cliques sur un préréglage ICC dans le gestionnaire de profils d'impression - une récupération unique par profil, qui vit ensuite sur ton appareil | Les préréglages ICC échouent. Fournis plutôt ton propre profil `.icc` |
| Radio Internet | Rien de personnel - une requête de playlist et un flux audio, vers la station (`api.somafm.com` et le serveur icecast qu'elle nomme, `*.somafm.com`) | Seulement pendant que tu joues la radio intégrée optionnelle dans le lecteur de son | La radio échoue. Toutes les autres fonctions sonores fonctionnent toujours |
| Une URL que tu demandes à un outil de capturer | Une requête vers l'adresse web exacte que tu tapes, depuis l'outil de capture d'écran d'URL. Quelle que soit cette adresse. Cet hôte n'est pas dans la politique ci-dessous, car tu le choisis au moment de l'utilisation | Seulement quand tu saisis une URL dans cet outil et que tu lances la capture | Un opérateur ne peut pas autoriser ceci par hôte. Pour le supprimer, supprime l'outil |
| Ajouter une image depuis une URL | Une requête vers l'adresse exacte de l'image que tu colles dans "Add from URL" (dans le sélecteur d'assets ou dans Éléments). La politique propre de l'application web interdit au navigateur de récupérer directement un autre site, donc la requête est faite pour toi par une petite passerelle sur l'origine propre de l'application (`/api/fetch-image`), qui récupère l'image côté serveur et ne renvoie que les octets - elle ne stocke rien et oublie l'adresse. Elle refuse tout ce qui n'est pas une adresse d'image publique (une adresse privée ou interne est bloquée). Les applications de bureau récupèrent l'adresse directement. Un lien Lolly que tu colles n'est pas récupéré du tout - il est rendu sur ton appareil. L'hôte n'est pas dans la politique ci-dessous, parce que tu le choisis au moment de l'utilisation | Seulement quand tu colles une URL dans "Add from URL" et que tu confirmes | L'opérateur désactive la passerelle (`LOLLY_DISABLE_IMAGE_PROXY=1`) ; seuls les liens Lolly, les images `data:` et les images de même origine peuvent alors être ajoutés dans l'application web. Les applications de bureau ne sont pas affectées |
| Vérification de signature SEAL | **Rien.** L'application web n'a aucun résolveur DNS - voir ci-dessous | Jamais | Rien à bloquer |
| Modèles d'IA embarqués | Rien de personnel - un téléchargement unique de fichier de modèle depuis l'hôte de modèles de Lolly (`lolli.li`), mis en cache ensuite sur ton appareil ; aucun compte, aucun identifiant, seulement la requête et ton IP | Seulement quand tu utilises une fonction qui a besoin d'un modèle (l'analyse approfondie de Verify, l'agrandissement d'image, la voix, et autres) | Cette fonction attend le téléchargement ; tout le reste fonctionne toujours |
| Instance distante | Ce que renvoie l'instance que tu nommes, via la même synchronisation de catalogue décrite ci-dessus - plus une étiquette de version sur les requêtes qui lui sont adressées (type de shell et version du moteur, la même information que porte un user agent), afin que son opérateur puisse voir quelles versions de Lolly sont en circulation. Sur une instance gérée, pendant que tu es connecté, cette étiquette porte aussi un identifiant d'installation propre à l'appareil, afin que la liste d'appareils de l'opérateur puisse distinguer cette installation. Elle ne circule que sur des requêtes que ton propre usage déclenche déjà - il n'y a ni minuteur ni appel spontané - et quitter l'instance supprime l'identifiant, si bien qu'un appareil qui se reconnecte plus tard en présente un nouveau. Tu choisis l'hôte au moment de l'utilisation, il n'est donc pas dans la politique ci-dessous | Seulement si tu pointes explicitement le shell vers un autre déploiement de Lolly | Le changement d'instance échoue. Ton instance locale n'est pas affectée |

Chaque hôte fixe de ce tableau constitue aussi la liste d'autorisation complète de la
Content-Security-Policy de l'application, que le navigateur fait respecter. Cette liste n'est
donc pas seulement une description de ce que fait le code aujourd'hui, elle est la limite à
laquelle le navigateur tient l'application : un futur changement qui tenterait de contacter un
autre hôte serait bloqué, et non silencieusement autorisé. Une ligne est l'exception délibérée,
et sa propre cellule le précise : Send to LinkedIn n'existe que dans les applications de bureau,
si bien que la politique de l'application web ne nomme aucun de ses deux hôtes - l'application
web ne pourrait pas les atteindre même si son code l'essayait. Deux autres lignes, Bluesky et
Discord, sont réservées au bureau de la même façon, et leurs hôtes sont absents de la politique
web pour la même raison. Cinq lignes n'ont pas d'hôte fixe, parce que tu choisis l'adresse au
moment de l'utilisation : une URL que tu demandes à un outil de capturer, une instance distante
vers laquelle tu pointes le shell, et ton propre serveur Mastodon, serveur WebDAV ou bucket S3
(les deux derniers aussi comme espace de synchronisation). Aucune de ces lignes n'est dans la
politique, et chacune ne se produit que quand tu tapes une adresse et que tu agis dessus. La
ligne Penpot atteint Penpot via l'origine propre de l'application, elle est donc couverte par
`'self'` . Un déploiement qui ne veut aucune des fonctions optionnelles (une instance
d'entreprise avec ses propres polices, par exemple) retire ces hôtes de sa politique, et les fonctions échouent en mode fermé plutôt que de contacter l'extérieur.

À part deux types de lignes, rien de tout cela n'envoie tes documents, projets,
sessions ou fichiers téléversés nulle part : ils existent pour apporter des choses
*vers* ton appareil (outils, polices, modèles). Les deux types sont les lignes
Envoyer, qui envoient le seul fichier que tu as choisi, et la ligne de
synchronisation, qui envoie une copie de ton travail vers le stockage que tu as
choisi et vers aucun serveur Lolly. Toute autre exception est nommée explicitement dans les sections ci-dessous.

**Une note sur ce que nous avons retiré.** Verify peut vérifier des signatures SEAL, un
système où la clé de signature d'un fichier est publiée dans le DNS. Les navigateurs ne
peuvent pas faire de requêtes DNS, donc toute implémentation web doit faire passer la
recherche par un résolveur DNS-over-HTTPS tiers - ce qui montrerait à cet opérateur le
domaine vérifié plus ton adresse IP. Nous utilisions celui de Cloudflare. **Nous ne le
faisons plus, et il n'y a pas de remplacement** : l'application web ne fournit
désormais aucun résolveur, donc la vérification SEAL ici ne fait aucune requête réseau.
Les fichiers dont l'enregistrement SEAL porte sa clé en ligne se vérifient toujours
entièrement hors ligne. Les fichiers dont la clé vit dans le DNS signalent "no key
resolver" à la place, et tu peux les vérifier dans l'application de bureau ou en ligne
de commande, qui résolvent le DNS nativement via ta propre machine sans tiers
impliqué.

![L'écran Verify : une zone de dépôt et rien d'autre - le fichier est vérifié là où il se trouve déjà, sans téléversement et sans compte](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Tu peux le confirmer toi-même : des vérifications greppables pour cette affirmation et
toutes les autres de cette page, avec les commandes exactes et le résultat attendu, se
trouvent sur [Verify It Yourself](/info/verify-yourself.html).

## URL de rendu en hotlink

> **Actif sur lolly.tools.** Chaque URL
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` est vraiment
> rendue, et les entrées voyagent dans cette URL. La section ci-dessous
> explique ce que cela signifie pour toi, et un opérateur peut désactiver la fonctionnalité sur sa propre instance.

L'application elle-même reste entièrement sur ton appareil. Séparément, un opérateur
peut activer les **URL de rendu en hotlink** - `/tool/<tool-id>.<ext>?<inputs>` - pour
qu'un lien Lolly partagé puisse apparaître comme une image vivante dans un README, un
wiki ou un tableau de bord. Récupérer l'une d'elles demande au serveur de rendre des
**données publiques d'outil et de catalogue** avec les entrées inscrites dans l'URL.

- <!--i:usercheck--> **Pas de comptes, pas de cookies, pas d'état.** Le point d'accès est anonyme, et rien
  n'est lu sur ton appareil. Tes documents, sessions et imports ne quittent jamais ton
  navigateur - ils ne peuvent absolument pas apparaître dans ces liens.
- <!--i:document--> **Mais l'URL elle-même est enregistrée.** La chaîne de requête d'une URL fait partie de la ligne de
  requête, donc elle apparaît dans les journaux d'accès habituels de la plateforme d'hébergement, tout comme
  n'importe quel chemin demandé. Si les entrées d'un lien contiennent le nom ou l'email de quelqu'un -
  un badge nominatif, une signature email - **ce texte se retrouve dans ces journaux**, et aucune
  formulation de politique n'y change quoi que ce soit. Une URL de rendu en hotlink n'est donc pas l'endroit pour des informations personnelles :
  ne lui donne que ce que tu mettrais sur une page publique.
- <!--i:globe--> **Les entrées sont de toute façon publiques par construction** - elles sont ce que l'auteur ou l'autrice
  du lien a tapé dans l'URL, lisible par quiconque le lien atteint. Ne mets pas de
  secrets dans un lien partagé. Lolly propose le chiffrement de liens pour le contenu sensible.
- <!--i:eyeoff--> Les réponses sont **mises en cache et limitées en débit** comme n'importe quelle image publique, et marquées
  `noindex` pour que les moteurs de recherche n'indexent pas tes rendus.

Tu auto-héberges Lolly et tu ne veux pas d'une surface de rendu publique ?
Définis `LOLLY_DISABLE_RENDER_GET=1` et chacune de ces URL renvoie une erreur 404.

## Le serveur MCP (optionnel, pour les agents IA)

Lolly peut aussi être atteint par un agent IA via le Model Context Protocol - un point
d'accès exploité par un opérateur (lolly.tools en exploite un ; n'importe qui peut
auto-héberger le sien, y compris entièrement isolé du réseau). Il partage la posture sans
compte du chemin de rendu, plus quatre outils qui manipulent nécessairement des octets de fichiers :

- <!--i:cpu--> **`lolly_transform`** (exécute un utilitaire sur l'appareil côté serveur, pour le
  compte de l'agent appelant), **`lolly_verify`** (vérifie les Content Credentials) et
  **`lolly_redact`** (masque des régions d'une image ou d'un PDF) acceptent tous les
  octets d'un fichier de la part de l'appelant. Ils sont traités **en processus, en
  mémoire**, et le résultat est renvoyé dans ce même appel - le fichier n'est jamais
  écrit sur disque et jamais conservé une fois la requête terminée.
- <!--i:cpu--> ** `lolly_rebrand` ** (rénove un ancien diaporama vers un système de design, à
travers ses étapes `plan` , `compile` et `inspect` ) accepte les octets d'un diaporama de la
même façon, et les traite **en mémoire, pour cet appel uniquement** - rien n'est écrit sur
disque ni conservé une fois la réponse envoyée. Sa première étape, `capabilities` , indique en
mots où iraient tes octets avant que tu n'en envoies : sur un serveur local auto-hébergé, le
diaporama ne quitte jamais cette machine ; sur un serveur hébergé, appeler `lolly_rebrand` y
envoie le diaporama, dans les limites de taille et de nombre de diapositives que donne cette même étape.
- <!--i:checklist--> Tous les autres outils - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - fonctionnent uniquement à partir de paramètres (texte,
  nombres, couleurs, URL, identifiants d'assets de catalogue), les mêmes entrées que
  prend une URL de rendu en hotlink.
- <!--i:lock--> L'accès se fait soit par un jeton partagé que l'opérateur délivre aux clients
  auxquels il fait confiance, soit par OAuth 2.1 sans état : des jetons signés de
  courte durée vérifiés contre un secret partagé, rien de stocké côté serveur et le
  jeton lui-même n'est jamais écrit dans un journal ni dans une URL de rendu.

## Identité Content Credentials (une connexion que tu dois lancer toi-même)

Lolly peut sceller un **Content Credential** cryptographique dans tes exports pour que n'importe qui puisse vérifier, hors ligne, qu'un fichier n'a pas été modifié depuis sa sortie de Lolly. Cela, c'est **activé par défaut et entièrement local** - la clé de signature est générée sur ton appareil et la signature elle-même se fait hors ligne. Sans inscription, cette clé est jetable :
une nouvelle paire de clés est générée pour chaque export et abandonnée avec lui. Une fois que tu t'inscris, la
clé devient durable et est générée **non extractible** - même le code de Lolly
lui-même ne peut pas la lire, seulement lui demander de signer. Dans les deux cas elle ne quitte jamais ton
appareil. Cette section couvre la seule étape *optionnelle* en plus de cela :
inscrire une identité vérifiée, pour que tes exports affichent "Verified - signed by
\<your email\>" au lieu d'une clé anonyme. **Si tu ignores l'inscription, rien dans
cette section ne te concerne, et aucune donnée personnelle ne quitte jamais ton appareil.**

![La carte d'identité vérifiée sur la page profil, largeur téléphone : le sélecteur de durée de vie du certificat et l'étape d'inscription en dessous, dormante jusqu'à ce que tu la lances toi-même](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Si tu t'inscris, voici exactement ce qui se passe :

1. **Tu choisis une méthode de connexion** - GitHub, Google, SUSE (id.suse.com) ou un
   lien envoyé par e-mail. Pour les trois fournisseurs OIDC, tu es redirigé vers la
   propre page de connexion de ce fournisseur, régie par sa propre politique de
   confidentialité, pas la nôtre. Le service de certificats de Lolly ne reçoit en
   retour qu'une adresse e-mail vérifiée et le nom du fournisseur. Pour le lien par
   e-mail, l'adresse que tu saisis est transmise à **Resend**, une API d'e-mail
   transactionnel, uniquement pour délivrer ce lien-là.
2. **Un cookie de courte durée protège la redirection.** C'est le seul cookie que
   pose l'ensemble du système Lolly : `lolly_ca_state`, `HttpOnly`, limité à `/api/ca`,
   expirant en dix minutes. Il porte une valeur aléatoire, pas un identifiant de
   suivi, et n'existe que pour empêcher que la redirection OAuth soit falsifiée. Il
   est effacé dès que la connexion est terminée.
3. **Ton adresse IP est utilisée, brièvement, pour prévenir les abus** des points d'accès de connexion (pour qu'un script ne puisse pas spammer une boîte de réception
ou épuiser le quota d'e-mails). Lolly la hache avant de créer un bucket de contrôle des abus de courte durée ; l'adresse brute n'est jamais envoyée à ce stockage. Le
bucket expire au bout d'environ une minute et n'est pas utilisé à des fins de suivi. Les journaux d'accès d'hébergement ordinaires sont distincts et décrits ci-dessous.
4. **Le service de certificats émet un certificat de courte durée** (7, 30, 90 ou 365
   jours, à ton choix, plafonné par la politique de l'opérateur) liant ton e-mail
   vérifié à la moitié publique de la paire de clés générée sur ton appareil. La
   moitié privée ne quitte jamais ton navigateur.
5. **Rien concernant l'émission n'est enregistré.** Le service de certificats ne
   conserve aucun journal d'émission : ni ton e-mail, ni le fournisseur, ni un numéro
   de série, ni un horodatage. Pas de base de données, pas de ligne de journal, pas
   de webhook. Ton adresse e-mail n'existe dans la requête que le temps d'être écrite
   dans le certificat que ton propre appareil reçoit, puis elle a entièrement disparu
   de notre côté.
6. **Après cela, la signature redevient hors ligne** pendant toute la durée de vie du
   certificat. Exporter un fichier ne contacte jamais le service de certificats -
   seule l'inscription l'a fait.

**Le compromis, dit clairement.** Une version antérieure de ce service journalisait
chaque émission, pour qu'un certificat mal émis ou compromis puisse être tracé. Nous
l'avons retiré, parce que ce journal était le seul endroit dans tout Lolly où des
données personnelles finissaient sur un serveur, et nous préférons ne pas les détenir
plutôt que de les détenir avec soin. Ce que nous perdons, c'est la traçabilité côté
serveur : si un certificat est utilisé abusivement, nous ne pouvons pas retrouver qui
l'a obtenu. Les certificats sont de courte durée par conception - 7 à 365 jours, à ton
choix, plafonnés par l'opérateur - et expirent d'eux-mêmes, ce qui est la protection sur
laquelle nous comptons à la place. Les auto-hébergeurs dont les propres obligations
exigent un journal d'audit peuvent en ajouter un, et deviennent alors responsables de
ce traitement en le faisant.

## L'extension de navigateur

L'extension de navigateur **Lolly URL Screenshot** ne collecte, ne stocke ni ne
transmet aucune donnée personnelle. Pas d'analytics, pas de suivi, pas de serveur
distant.

**Ce qu'elle fait.** Quand tu demandes à l'application web Lolly de capturer une URL,
l'extension ouvre cette page dans un onglet d'arrière-plan temporaire, la capture dans
ton navigateur via le DevTools Protocol, renvoie l'image à l'application et ferme
l'onglet. Tout se passe localement, sur ton propre appareil et réseau.

**Données.**

- <!--i:shieldcheck--> **Nous ne collectons rien.** L'extension n'a aucun serveur et ne fait aucune
  requête réseau qui lui soit propre.
- <!--i:photos--> **Les images capturées** vont directement vers l'application Lolly dans le
  même navigateur - jamais téléversées par l'extension.
- <!--i:link--> **Les URL que tu captures** ne servent qu'à charger cette page-là pour cette
  capture d'écran-là. Elles ne sont ni journalisées ni partagées.

**Permissions.**

- <!--i:wrench--> **`debugger`** - pour capturer la page rendue via le DevTools Protocol (le même
  mécanisme qu'utilise l'application de bureau Lolly).
- <!--i:monitor--> **`tabs`** - pour ouvrir et fermer l'onglet temporaire dans lequel la page se
  charge.
- <!--i:globe--> **Accès aux hôtes (`<all_urls>`)** - parce que la page que tu choisis de
  capturer peut être sur n'importe quel site. Chrome affiche cela à l'installation
  comme un avertissement de permission large. L'extension ne visite jamais que
  l'URL que tu lui donnes.

Rien de tout cela n'est utilisé pour lire, surveiller ou transmettre ta navigation
au-delà de cette unique capture demandée.

## Journaux d'infrastructure

Comme tout site web, les serveurs derrière lolly.tools - et derrière tout déploiement de
Lolly - génèrent des journaux d'accès de serveur web standard dès qu'une requête les
atteint : adresse IP, chemin demandé, horodatage, agent utilisateur. C'est un
comportement d'hébergement de base, pas quelque chose que Lolly ajoute en plus, et cela
ne contient jamais le contenu de tes documents, parce que ceux-ci n'atteignent jamais un
serveur au départ. La seule exception délibérée est un fichier que tu remets
explicitement à un appel MCP `lolly_transform` , `lolly_verify` , `lolly_redact` ou
`lolly_rebrand` , qui est traité en mémoire et jamais écrit sur disque ou dans un journal, comme décrit ci-dessus.

**Le propre code de Lolly n'écrit rien dans ces journaux.** Le serveur MCP ne contient
aucune instruction de journalisation. Le service de certificats émet exactement deux
lignes, toutes deux en cas d'échec et toutes deux délibérément dépouillées : un code de
statut d'échec d'envoi sans adresse de destinataire, et un message d'erreur sans trace
de pile ni URL (une trace de pile pourrait contenir un jeton d'inscription). Tout le
reste du journal appartient à la plateforme d'hébergement, pas à nous.

Pour lolly.tools, l'hébergement est assuré par Vercel et la rétention des journaux
d'accès suit les paramètres par défaut propres à Vercel pour notre offre. Nous ne
configurons aucun drain de journaux, aucun export de journaux à long terme et aucun
produit d'analytics ou de supervision en plus. Nous ne conservons nous-mêmes aucune
copie de ces journaux, ce qui signifie aussi que nous n'avons aucun moyen de les
rechercher pour toi - voir [Tes droits](#your-rights).

## Bases légales, conservation et destinataires

Presque rien ici n'a besoin de base légale, car presque rien n'est traité. Par
souci d'exhaustivité, la liste complète :

| Traitement | Base légale (RGPD Art. 6) | Conservé pendant |
|---|---|---|
| Tout ce qui se trouve sur ton appareil (documents, préférences, cache, compteurs) | **Ce n'est pas du tout notre traitement** - cela ne nous parvient jamais. Le stockage sur ton appareil est strictement nécessaire au service que tu as demandé (ePrivacy Art. 5(3)), il ne nécessite donc aucun consentement | Jusqu'à ce que tu le supprimes |
| Ton adresse e-mail pendant l'inscription à Content Credentials | **Art. 6(1)(b)**, exécution d'un service que tu as explicitement demandé | Non conservée. Présente en mémoire uniquement le temps de la requête |
| Une clé de bucket dérivée à sens unique de ton adresse IP sur les points de connexion, pour la limitation de débit | **Art. 6(1)(f)**, notre intérêt légitime à prévenir les abus d'un service gratuit et du quota d'e-mails d'un tiers. Nous estimons que cela passe un test de mise en balance car l'adresse brute n'est jamais envoyée au limiteur, le bucket ne sert qu'au contrôle des abus et il expire automatiquement | Environ 1 minute dans le stockage de contrôle des abus ; non conservée ensuite |
| Journaux d'accès d'hébergement (IP, chemin, horodatage, agent utilisateur) | **Art. 6(1)(f)**, notre intérêt légitime pour la sécurité du service, la prévention des abus et le diagnostic des pannes | Valeur par défaut de la plateforme Vercel pour notre offre. Nous n'ajoutons aucun export ni collecte supplémentaire |

**Destinataires.** Les catégories de destinataires sont : notre hébergeur (Vercel Inc.) ;
notre fournisseur de stockage de contrôle des abus, qui ne reçoit que des clés de bucket
dérivées à sens unique et de courte durée, jamais l'adresse IP brute ; et - uniquement si tu
utilises l'option de connexion par e-mail - un fournisseur d'e-mails transactionnels
(Resend). Si tu te connectes avec GitHub, Google ou SUSE (id.suse.com), tu interagis
directement avec ce fournisseur sous sa propre politique de confidentialité. Il nous
communique une adresse e-mail vérifiée et rien d'autre. Nous ne partageons de données
personnelles avec personne d'autre, et nous ne vendons pas de données, ne diffusons pas de publicité et ne profilons pas les utilisateurs.

**Transferts hors de l'EEE.** Vercel et Resend sont des entreprises américaines. Le calcul des
fonctions pour lolly.tools est fixé sur la région de Francfort ( `fra1` ) de Vercel, si bien que
le traitement a lieu dans l'UE, mais en tant que fournisseurs ayant leur siège aux États-Unis,
ils peuvent tout de même accéder aux données en tant que sous-traitants depuis les États-Unis.
Ces transferts reposent sur les clauses contractuelles types de la Commission européenne et/ou
le cadre EU-US Data Privacy Framework, tel que défini dans l'accord de traitement des données de
chaque fournisseur. Comme les données personnelles atteignant ces fournisseurs sont si limitées
- une adresse e-mail transmise pour envoyer un seul message, des journaux d'accès ordinaires, et
un bucket de contrôle des abus dérivé de courte durée - l'exposition est proportionnellement faible.

**Prise de décision automatisée.** Aucune. Il n'y a ni profilage ni décision
automatisée produisant des effets juridiques ou similaires significatifs (Art.
22).

## Confidentialité des enfants

Lolly ne collecte sciemment aucune information personnelle auprès de qui que ce
soit, quel que soit son âge, dans le cadre normal de l'utilisation de
l'application - il n'y a rien à collecter. Le seul endroit où des informations
personnelles (une adresse e-mail) sont jamais recueillies est l'inscription à
Content Credentials, décrite ci-dessus, qui ne s'adresse pas et n'est pas
destinée aux enfants.

## Tes droits

Comme presque tout ce que Lolly touche n'est stocké que sur ton propre appareil, la
plupart de ce que le droit de la protection des données appelle « tes droits » - accès,
correction, suppression, portabilité - sont des choses que tu peux déjà faire toi-même,
instantanément, sans demander à personne : tes données résident dans le stockage de ton
navigateur, sous une forme que tu peux inspecter, exporter (**Exporter mes données**,
ci-dessus) ou supprimer (en effaçant le stockage du site dans ton navigateur, comme ci-dessus).

Formellement, en vertu des articles 15 à 22 du RGPD, tu as le droit
d'**accéder** à tes données personnelles, de les **rectifier**, de les
**effacer**, d'en **restreindre** ou de t'**opposer** au traitement (y compris
de t'opposer à tout ce que nous fondons sur des intérêts légitimes), à la
**portabilité des données** et - lorsque le traitement repose sur le
consentement - de **retirer ce consentement à tout moment**, sans affecter la
licéité de ce qui s'est passé avant ce retrait.

Voici la position honnête sur leur exercice à notre égard. Comme nous ne tenons plus de
journal d'émission, **nous ne détenons aucune donnée personnelle te concernant que nous
puissions consulter, corriger, exporter ou supprimer.** Si tu nous écris pour demander ce
que nous détenons sur toi, la réponse honnête est « rien », et c'est ce que nous te dirons.
La seule catégorie qui existe est les journaux d'accès d'hébergement indexés par adresse
IP, détenus par notre hébergeur selon ses valeurs de conservation par défaut. Nous n'avons
aucun moyen de les rechercher ou de les supprimer sélectivement, et nous te le dirons
plutôt que de prétendre le contraire. Tout ce qui est réellement *à toi* se trouve sur ton
appareil, où tu peux déjà le lire, l'exporter et le détruire sans demander la permission de qui que ce soit.

**Tu as le droit de te plaindre.** Si tu penses que nous avons mal géré tes
données, tu peux déposer une plainte auprès d'une autorité de contrôle de la
protection des données - dans l'UE, l'autorité de ton pays de résidence, de ton
lieu de travail ou du lieu où tu estimes que l'infraction a eu lieu (Art. 77).
Notre autorité de contrôle chef de file est le *Bayerisches Landesamt für
Datenschutzaufsicht* (BayLDA) à Ansbach, en Allemagne. Tu n'as pas besoin de
nous contacter d'abord, même si nous aimerions avoir l'occasion de corriger le
problème.

Nous ne vendons pas de données. Nous n'en avons pas à vendre.

## Modifications de cette politique

La date en haut de page change à chaque fois que ce document change. Une
modification qui altère ce qui quitte ton appareil ou ce qui est conservé
obtient sa propre ligne ici, pas une modification silencieuse - si tu veux voir
ce qui a changé, demande (ci-dessous) ou compare avec la
[source publique](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Qui est responsable, et comment nous contacter

Le **responsable du traitement** pour lolly.tools est :

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Allemagne

SUSE a nommé un **délégué à la protection des données**, joignable à
[privacy@suse.com](mailto:privacy@suse.com). Utilise cette adresse pour toute
demande formelle relevant de « Tes droits » ci-dessus.

Pour tout ce qui concerne Lolly lui-même - son fonctionnement, pourquoi une
chose est ainsi ou une correction à apporter à ce document - contacte **Andy
Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Pour une instance de Lolly auto-hébergée ou d'entreprise, contacte plutôt son
exploitant : l'exploitant est le responsable de traitement pour son propre
déploiement. SUSE et le projet open source Lolly ne détiennent aucune donnée
pour les déploiements qu'ils n'exploitent pas.
