# Extension de navigateur

L'extension **Lolly URL Screenshot** permet à l'appli web de capturer n'importe quelle page web depuis ton navigateur. Sans elle, capturer une URL nécessite l'appli de bureau - une page de navigateur ne peut pas lire les pixels d'un autre site par elle-même. L'extension le peut, en utilisant la même capture que l'appli de bureau.

Elle fait deux autres travaux de la même façon. Une adresse web collée dans un emplacement d'image peut devenir une capture de cette page (**Capturer cette page**), et l'extension peut lire une seule page que tu nommes pour que Brand Studio puisse extraire une marque d'un site web en direct. Chaque demande attend ton approbation dans l'extension.

Elle fonctionne sur les navigateurs basés sur Chromium : **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 ou plus récent.

Tant qu'elle n'est pas installée, **URL Screenshot** s'ouvre quand même pour que tu puisses composer une capture, et une note en haut des contrôles de l'outil indique ce qui manque.

![La note de l'outil URL Screenshot proposant l'extension, affichée quand la capture vers fichier n'a pas d'hôte pour s'exécuter](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Chaque contrôle est actif pendant l'attente : l'URL cible, la profondeur de défilement, le délai de stabilisation, les marges de recadrage et la recoloration. Seule la capture elle-même a besoin d'un hôte.

![Les contrôles de URL Screenshot avec une URL cible, une profondeur de défilement, un délai de stabilisation et des marges de recadrage, tous utilisables avant même que l'extension existe](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installation

### Depuis le Chrome Web Store

*Bientôt disponible.* Une fois publiée, tu l'installeras en un clic, puis tu rechargeras Lolly.

### La charger toi-même (développeurs)

L'extension se trouve dans le dépôt à `shells/chrome-extension/`. Ce dossier est la build de production, qui fonctionne uniquement avec Lolly sur `https://lolly.tools`.

1. Ouvre `chrome://extensions`.
2. Active le **Mode développeur** (en haut à droite).
3. Clique sur **Charger l'extension non empaquetée** et choisis le dossier `shells/chrome-extension/`.
4. Recharge Lolly - **URL Screenshot** fonctionne désormais dans le navigateur.

Pour un serveur de développement local, lance `pnpm run pack:chrome-extension:dev` et charge `dist/chrome-extension-dev` à la place. Ce paquet accepte aussi `http://localhost:5173` et porte **Development** dans son nom.

## Comment ça marche

- Un petit script indique à Lolly que l'extension est présente, si bien que **URL Screenshot** peut enregistrer des captures sans autre configuration.
- Tu approuves chaque demande. Quand Lolly en fait une, l'extension ouvre sa propre fenêtre **Approve page request**, qui indique le site demandeur, s'il veut une capture d'écran ou le contenu de la page, et l'adresse de la page. Rien n'est lu tant que tu n'as pas cliqué sur **Approve once**. **Cancel**, ou la fermeture de la fenêtre, met fin à la demande.
- La première fois que tu approuves une demande pour un site, Chrome te demande aussi si l'extension peut accéder à ce site. Chrome conserve cet accès une fois que tu l'as autorisé, mais chaque demande suivante exige quand même son propre **Approve once**.
- Une approbation couvre une seule demande et expire au bout de 30 secondes. Une seule demande peut attendre ou s'exécuter à la fois, et une demande approuvée s'arrête après 55 secondes. Si la page Lolly se ferme ou change, ou si la page cible passe à un autre site, la demande est annulée.
- Après ton approbation, l'extension ouvre la page cible dans un onglet en arrière-plan, la capture via le DevTools Protocol (le même `Page.captureScreenshot` que l'appli de bureau utilise), puis ferme l'onglet et renvoie l'image à l'onglet Lolly qui l'a demandée.
- Elle s'exécute entièrement dans ton navigateur, sur ton réseau - ce qui permet de capturer `localhost` ou un site interne. La page se charge avec ta session de navigateur, donc une page où tu es connecté peut afficher des informations privées dans le résultat. La capture elle-même n'est jamais téléversée nulle part ; le seul trafic réseau est ton propre navigateur chargeant la page que tu as demandé à capturer.

Pendant qu'une capture s'exécute, tu peux brièvement voir une bannière *"…started debugging this browser"* sur l'onglet temporaire. C'est le DevTools Protocol à l'œuvre ; elle disparaît d'elle-même une fois la capture terminée.

## Lire un site pour Brand Studio

La source **Website** de Brand Studio permet de démarrer une marque à partir d'un site que tu as déjà. Sur Chromium, c'est l'extension qui le lit ; sur l'appli de bureau, une récupération native fait le même travail, et sur un navigateur ordinaire sans extension, la tuile n'est même pas proposée.

Ce qui se passe quand tu l'actives :

- Une adresse, une page. Après ton approbation, l'extension l'ouvre dans le même type d'onglet en arrière-plan, lit le balisage rendu, le texte des feuilles de style et une poignée d'images d'icônes et de logos, puis ferme l'onglet. Elle ne suit pas les liens et ne fait pas de crawl.
- Les feuilles de style hébergées ailleurs (un CDN, un service de polices) sont récupérées aussi, car les couleurs et la typographie de la page y résident. Les requêtes cross-origin partent sans tes cookies ; celles de même origine les utilisent, exactement comme la page elle-même le ferait.
- Tout est plafonné - un nombre borné de feuilles, d'images et d'octets - pour qu'une page hostile ou à moitié cassée renvoie du matériel partiel plutôt que de bloquer.
- Les octets reviennent directement à l'onglet Lolly qui a fait la demande. L'analyse en couleurs, typographie et logos se fait sur ton appareil ; rien n'est téléversé.

Coller une adresse ne fait que remplir le champ. Rien n'est lu tant que tu n'as pas lancé la lecture et cliqué sur **Approve once**.

## Après l'installation

Recharge l'onglet Lolly. L'invite "Get the extension" disparaît, **URL Screenshot** (sous Utilitaires) peut enregistrer des captures dans un fichier, et l'outil devient disponible en mode Batch.

## Permissions

Son `manifest.json` déclare quatre permissions, plus un accès aux sites qu'elle demande un site à la fois :

- `debugger` - piloter l'onglet en arrière-plan via le DevTools Protocol. C'est ce qui prend la capture d'écran.
- `tabs` - ouvrir l'onglet temporaire en arrière-plan et le refermer ensuite, et vérifier que ni la page Lolly ni la page cible n'a bougé depuis que tu as approuvé la demande.
- `scripting` - exécuter le lecteur mono-page à l'intérieur du site que tu as désigné, pour la source Website de Brand Studio.
- `storage` - noter l'id d'un onglet qu'elle a ouvert, uniquement en stockage de session, pour que l'onglet soit quand même fermé si le navigateur suspend l'extension en cours de lecture. Effacé au prochain démarrage ; rien te concernant n'est stocké.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - accès aux sites, qui n'est pas accordé à l'installation. Quand tu cliques sur **Approve once**, l'extension demande à Chrome l'accès au seul site de cette demande, et Chrome te le demande la première fois pour chaque site.

Elle ne lit que la seule page que tu approuves, et elle ne lit ni ne transmet tes données de navigation - rien n'est téléversé nulle part.

Le manifeste fixe aussi `minimum_chrome_version: 111`. La version actuelle est 0.4.0.

## Dépannage

- **Tu vois toujours "Get the extension" ?** Recharge l'onglet Lolly - la détection se fait au chargement de la page.
- **Rien ne se passe sur ce site ?** L'extension ne fonctionne que sur `https://lolly.tools`, plus `http://localhost:5173` dans le paquet de développement. Une autre origine, comme une copie de Lolly auto-hébergée, demande une build distincte de l'extension qui liste cette origine à la fois dans `manifest.json` et dans `policy.js`. Modifier le manifeste seul ne fonctionne plus.
- **Une capture échoue ?** Vérifie que l'URL est accessible et commence par `http://` ou `https://`. Certaines pages bloquent activement la capture automatisée. Si tu as cliqué sur **Cancel**, fermé la fenêtre d'approbation ou attendu plus de 30 secondes, relance la capture.
