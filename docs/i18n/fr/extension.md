# Extension de navigateur

Une page web ne peut pas lire les pixels d'un autre site, donc l'application web Lolly a besoin d'aide pour capturer une page. Dans un navigateur basé sur Chromium (Chrome, Edge, Brave, Arc ou Opera, à partir de Chrome 111), l'extension gratuite **Lolly URL Screenshot** apporte cette aide, avec la même capture que celle de l'application de bureau. Une fois installée :

- **[URL Screenshot](/t/url-shot)** enregistre dans un fichier la page que tu as composée ;
- une adresse web collée dans un emplacement d'image peut devenir une capture de cette page, avec **Screenshot this page** ;
- la source **Website** dans [Design System Setup](/info/brand-studio.html) peut lire une page pour démarrer un design system.

Tu approuves chaque requête, et l'application de bureau fait les mêmes tâches sans l'extension.

## Avant d'installer

Tant que l'extension n'est pas installée, **URL Screenshot** s'ouvre quand même, donc tu peux composer une capture. Une note en haut des contrôles de l'outil dit ce qui manque.

![La note de l'outil URL Screenshot proposant l'extension, affichée quand la capture vers fichier n'a pas d'hôte pour s'exécuter](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Chaque contrôle fonctionne en attendant : l'URL cible, la profondeur de défilement, le délai de stabilisation, les marges de rognage et la recoloration. Seule la capture elle-même a besoin de l'extension.

![Les contrôles de URL Screenshot avec une URL cible, une profondeur de défilement, un délai de stabilisation et des marges de recadrage, tous utilisables avant même que l'extension existe](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installation

**Depuis le Chrome Web Store :** bientôt disponible. Une fois l'extension publiée, tu l'installes en un clic.

**Charge-la toi-même (développeurs).** L'extension se trouve dans le dépôt à `shells/chrome-extension/`. Ce dossier est le build de production, qui ne fonctionne qu'avec Lolly sur `https://lolly.tools`.

1. Ouvre `chrome://extensions`.
2. Active **Developer mode** (en haut à droite).
3. Clique sur **Load unpacked** et choisis le dossier `shells/chrome-extension/`.
4. Recharge l'onglet Lolly. La détection a lieu au chargement de la page, donc l'invite « Get the extension » disparaît. **URL Screenshot** (sous Utilities) peut alors enregistrer des captures dans un fichier et devient disponible en mode Batch.

Pour un serveur de développement local, lance `pnpm run pack:chrome-extension:dev` et charge `dist/chrome-extension-dev` à la place. Ce paquet accepte aussi `http://localhost:5173` et porte **Development** dans son nom.

## Ce qui se passe quand Lolly demande

![L'onglet Lolly demande une page et tu appuies sur Approve once dans la fenêtre d'approbation de l'extension. Un onglet d'arrière-plan s'ouvre, lit la page et se ferme. Puis l'onglet Lolly reçoit le résultat.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly demande.** Un petit script dit à Lolly que l'extension est présente, donc une capture ou une lecture de page peut démarrer sans autre configuration.
2. **Tu approuves.** L'extension ouvre sa propre fenêtre **Approve page request**. Elle montre le site demandeur, s'il veut une capture d'écran ou le contenu de la page, et l'adresse de la page. Rien n'est lu tant que tu n'appuies pas sur **Approve once**. **Cancel**, ou la fermeture de la fenêtre, met fin à la requête.
3. **Chrome demande une fois par site.** La première fois que tu approuves une requête pour un site, Chrome demande aussi si l'extension peut accéder à ce site. Chrome conserve cet accès une fois que tu l'autorises, mais chaque requête suivante exige quand même son propre **Approve once**.
4. **La page est lue dans un onglet d'arrière-plan.** L'extension ouvre la page cible dans un onglet d'arrière-plan, la capture via le DevTools Protocol (le même `Page.captureScreenshot` que celui de l'application de bureau), ferme l'onglet et remet le résultat à l'onglet Lolly qui l'a demandé.

Une approbation couvre une requête et expire au bout de 30 secondes. Une seule requête peut attendre ou s'exécuter à la fois, et une requête approuvée s'arrête au bout de 55 secondes. Si la page Lolly se ferme ou change, ou si la page cible passe sur un autre site, la requête est annulée.

La capture s'exécute dans ton navigateur, sur ton réseau, donc `localhost` et les sites internes fonctionnent. La page se charge avec ta session de navigateur, donc une page où tu es connecté peut afficher des informations privées dans le résultat. La capture n'est pas envoyée : le seul trafic réseau est ton propre navigateur qui charge la page demandée.

Pendant qu'une capture s'exécute, tu peux voir brièvement une bannière *"…started debugging this browser"* sur l'onglet temporaire. C'est le DevTools Protocol à l'œuvre, et la bannière disparaît quand la capture est terminée.

## Lire un site pour Design System Setup

La source **Website** dans Design System Setup démarre un design system à partir d'un site que tu as déjà. Dans un navigateur Chromium, l'extension lit la page. Dans l'application de bureau, l'application récupère elle-même la page. Dans un navigateur sans extension, la tuile Website n'est pas proposée.

- **Une adresse, une page.** Après ton approbation, l'extension ouvre la page dans le même type d'onglet d'arrière-plan, lit le balisage rendu, le texte des feuilles de style et une poignée d'images d'icônes et de logos, puis ferme l'onglet. Elle ne suit pas les liens et n'explore pas.
- **Les feuilles de style hébergées ailleurs** (un CDN ou un service de polices) sont aussi récupérées, car les couleurs et la typographie de la page s'y trouvent. Les requêtes inter-origines partent sans tes cookies ; les requêtes de même origine les utilisent, comme la page elle-même le ferait.
- **Tout est plafonné**, avec une limite sur le nombre de feuilles de style et d'images et sur les octets, donc une page hostile ou à moitié cassée renvoie un matériel partiel au lieu de se bloquer.
- **L'analyse se fait sur ton appareil.** Les octets retournent directement à l'onglet Lolly qui les a demandés, qui les transforme en couleurs, typographie et logos.

Coller une adresse ne fait que remplir le champ. Rien n'est lu tant que tu ne lances pas la lecture et n'appuies pas sur **Approve once**.

## Permissions

Le `manifest.json` de l'extension déclare quatre permissions, plus un accès aux sites qu'elle demande un site à la fois. Il définit `minimum_chrome_version: 111`, et la version actuelle est 0.4.0.

| Permission | À quoi elle sert | Quand elle est accordée |
|---|---|---|
| `debugger` | Pilote l'onglet d'arrière-plan via le DevTools Protocol, qui prend la capture. | À l'installation |
| `tabs` | Ouvre l'onglet d'arrière-plan temporaire et le ferme ensuite, et vérifie que ni la page Lolly ni la page cible n'ont bougé depuis ton approbation. | À l'installation |
| `scripting` | Exécute le lecteur d'une page dans le site que tu as nommé, pour la source Website. | À l'installation |
| `storage` | Note l'identifiant d'un onglet qu'elle a ouvert, dans le stockage de session uniquement, pour que l'onglet se ferme quand même si le navigateur suspend l'extension en pleine lecture. Effacé au démarrage suivant ; rien sur toi n'est stocké. | À l'installation |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Accès aux sites, non accordé à l'installation. Quand tu appuies sur **Approve once**, l'extension demande à Chrome l'accès au seul site de cette requête. | La première fois que tu approuves une requête pour ce site, après que Chrome te l'a demandé |

L'extension ne lit que la seule page que tu approuves. Elle ne lit ni n'envoie tes données de navigation, et rien n'est envoyé.

## Dépannage

- **Tu vois encore « Get the extension » ?** Recharge l'onglet Lolly.
- **Rien ne se passe sur ce site ?** L'extension ne fonctionne que sur `https://lolly.tools`, plus `http://localhost:5173` dans le paquet de développement. Une autre origine, comme une copie auto-hébergée de Lolly, exige son propre build de l'extension qui liste cette origine à la fois dans `manifest.json` et dans `policy.js`. Modifier le manifeste seul ne suffit pas.
- **Une capture échoue ?** Vérifie que l'URL est accessible et commence par `http://` ou `https://`. Certaines pages bloquent la capture automatisée. Si tu as appuyé sur **Cancel**, fermé la fenêtre d'approbation ou attendu plus de 30 secondes, relance la capture.
