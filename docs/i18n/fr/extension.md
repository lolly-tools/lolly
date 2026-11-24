# Extension de navigateur

Une page web ne peut pas lire les pixels d'un autre site web. Dans un navigateur basé sur Chromium (Chrome, Edge, Brave, Arc ou Opera, à partir de Chrome 111), l'extension gratuite **Lolly URL Screenshot** permet à l'application web Lolly de capturer une page avec la même méthode que l'application de bureau. Une fois l'extension installée :

- **[Lolly URL Screenshot](/t/url-shot)** enregistre la page que tu as composée sous forme de fichier ;
- une adresse web collée dans un emplacement d'image peut devenir une capture de cette page, avec **Screenshot this page** ;
- la source **Website** dans [Lolly Design System Setup](/info/brand-studio.html) peut lire une page pour démarrer un design system.

Tu approuves chaque requête, et l'application de bureau effectue les mêmes tâches sans l'extension.

<!--i:eti-checklist-->
## Avant l'installation

Sans l'extension, **Lolly URL Screenshot** s'ouvre quand même et tu peux composer une capture. Une note en haut des contrôles de l'outil indique ce qui manque.

![La note de l'outil URL Screenshot qui propose l'extension, affichée quand la capture vers un fichier n'a aucun hôte sur lequel s'exécuter](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Tous les contrôles fonctionnent sans l'extension : l'URL cible, la profondeur de défilement, le délai de stabilisation, les marges de rognage et la recoloration. Seule la capture demande l'extension.

![Les contrôles de Lolly URL Screenshot avec une URL cible, une profondeur de défilement, un délai de stabilisation et des marges de rognage, tous utilisables avant même l'installation de l'extension](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Installer

**Depuis le Chrome Web Store :** bientôt disponible. Une fois publiée, l'extension s'installe en un clic.

**La charger toi-même (développeurs).** Le code source de l'extension se trouve dans le dépôt, sous `shells/chrome-extension/`. L'étape de packaging construit le paquet de production à partir de ce dossier. Ce paquet fonctionne uniquement avec Lolly à l'adresse `https://lolly.tools`.

1. Exécute `pnpm run pack:chrome-extension`. Cette commande construit le paquet dans `dist/chrome-extension/`.
2. Ouvre `chrome://extensions`.
3. Active **Developer mode** (en haut à droite).
4. Clique sur **Load unpacked** et choisis le dossier `dist/chrome-extension/`.
5. Recharge l'onglet Lolly. Lolly détecte l'extension au chargement de la page, et l'invite « Get the extension » disparaît. **Lolly URL Screenshot** (sous Utilities) peut alors enregistrer des captures dans un fichier et fonctionne en mode Lolly Batch.

::: details Pour un serveur de développement local ou le dossier source
Pour un serveur de développement local, exécute `pnpm run pack:chrome-extension:dev` et charge plutôt `dist/chrome-extension-dev`. Ce paquet accepte aussi `http://localhost:5173` et porte **Development** dans son nom.

Charger directement le dossier `shells/chrome-extension/` fonctionne aussi pour les captures PNG. Ce dossier n'inclut pas le parcours de page, que l'étape de packaging intègre. Un SVG issu de ce dossier contient une capture d'écran, pas des formes.
:::

<!--i:eti-user-check-->
## Ce qui se passe quand Lolly fait une demande

![L'onglet Lolly demande une page et tu appuies sur Approve once dans la fenêtre d'approbation de l'extension. Un onglet en arrière-plan s'ouvre, lit la page et se ferme. L'onglet Lolly reçoit alors le résultat.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly fait une demande.** Un petit script indique à Lolly que l'extension est présente, donc une capture ou une lecture de page peut démarrer sans autre configuration.
2. **Tu approuves.** L'extension ouvre sa propre fenêtre **Approve page request**. Elle affiche le site demandeur, s'il souhaite une capture d'écran ou le contenu de la page, et l'adresse de la page. Rien n'est lu tant que tu n'appuies pas sur **Approve once**. **Cancel**, ou la fermeture de la fenêtre, met fin à la requête.
3. **Chrome demande une fois par site.** La première fois que tu approuves une requête pour un site, Chrome demande aussi si l'extension peut accéder à ce site. Chrome conserve cet accès une fois que tu l'autorises, mais chaque requête suivante demande toujours son propre **Approve once**.
4. **La page est lue dans un onglet en arrière-plan.** L'extension ouvre la page cible dans un onglet en arrière-plan, la capture via le DevTools Protocol (le même `Page.captureScreenshot` que l'application de bureau), ferme l'onglet et renvoie le résultat à l'onglet Lolly demandeur.

::: details Comment fonctionne une capture SVG
Pour un **SVG**, l'extension parcourt la page au lieu de prendre une image de l'écran. Un script fourni avec l'extension lit la mise en page dans l'onglet en arrière-plan et transforme la page en formes et en texte vectorisé. Le fichier reste net à toute taille et chaque partie reste modifiable. Les images de la page restent des images. Tout ce que la page dessine avec un canevas, une vidéo ou un effet que SVG ne peut pas exprimer est copié depuis une capture d'écran du même instant. Lolly vérifie le résultat par rapport à cette capture. Quand les deux diffèrent trop, le SVG contient la capture à la place.

Pour vectoriser le texte dans la police propre à la page, l'extension transmet à Lolly les fichiers de polices que la page a chargés. Chrome ne conserve pas les octets d'une police à un endroit où une extension peut les lire, donc l'extension redemande chaque police à la page. Ton navigateur répond généralement depuis son cache, et la politique de sécurité propre à la page s'applique toujours à cette requête.
:::

Une approbation couvre une requête et expire au bout de 30 secondes. Une seule requête peut être en attente ou en cours à la fois, et une requête approuvée s'arrête au bout de 55 secondes. Si la page Lolly se ferme ou change, ou si la page cible passe à un autre site, la requête est annulée.

::: warning Les captures utilisent ta session de navigateur
La page se charge avec ta session de navigateur, donc une page à laquelle tu es connecté peut montrer des informations privées dans le résultat.
:::

La capture s'exécute dans ton navigateur sur ton réseau, donc `localhost` et les sites internes fonctionnent. La capture n'est pas envoyée en ligne. Le seul trafic réseau correspond au chargement par ton navigateur de la page demandée et, pour un SVG, des fichiers de polices de cette page une seconde fois.

Pendant une capture, tu peux brièvement voir une bannière *« …started debugging this browser »* sur l'onglet temporaire. La bannière vient du DevTools Protocol et disparaît une fois la capture terminée.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Lire un site pour Lolly Design System Setup

La source **Website** dans Lolly Design System Setup démarre un design system à partir d'un site que tu as déjà. Dans un navigateur Chromium, l'extension lit la page. Dans l'application de bureau, l'application récupère elle-même la page. Dans un navigateur sans extension, la tuile Website n'est pas proposée.

- **Une adresse, une page.** Après ton approbation, l'extension ouvre la page dans le même type d'onglet en arrière-plan, lit le balisage rendu, le texte des feuilles de style et quelques images d'icônes et de logos, puis ferme l'onglet. L'extension ne suit pas les liens et n'explore pas le site.
- **Les feuilles de style hébergées ailleurs** (un CDN ou un service de polices) sont aussi récupérées, car elles contiennent les couleurs et la typographie de la page. Les requêtes vers une autre origine partent sans tes cookies. Les requêtes de même origine utilisent tes cookies, comme le ferait la page.
- **Tout est plafonné**, avec une limite sur le nombre de feuilles de style et d'images et sur le volume en octets, donc une page hostile ou partiellement défaillante renvoie des éléments partiels au lieu de bloquer.
- **L'analyse se fait sur ton appareil.** Les octets reviennent directement à l'onglet Lolly demandeur, qui les transforme en couleurs, typographie et logos.

Coller une adresse ne fait que remplir le champ. Rien n'est lu tant que tu ne démarres pas la lecture et n'appuies pas sur **Approve once**.

<!--i:eti-lock-->
## Permissions

Le fichier `manifest.json` de l'extension déclare quatre permissions, plus l'accès aux sites qu'elle demande un site à la fois. Il définit `minimum_chrome_version: 111`, et la version actuelle est 0.5.0.

| Permission | À quoi elle sert | Quand elle est accordée |
|---|---|---|
| `debugger` | Pilote l'onglet en arrière-plan via le DevTools Protocol, qui prend la capture d'écran et, pour un SVG, exécute le parcours de page. | À l'installation |
| `tabs` | Ouvre l'onglet temporaire en arrière-plan et le ferme ensuite, et vérifie que ni la page Lolly ni la page cible n'ont changé d'adresse depuis ton approbation. | À l'installation |
| `scripting` | Exécute le lecteur d'une seule page dans le site que tu as indiqué, pour la source Website. | À l'installation |
| `storage` | Note l'identifiant d'un onglet qu'elle a ouvert, uniquement dans le stockage de session, pour que l'onglet se ferme quand même si le navigateur suspend l'extension en pleine lecture. Effacé au démarrage suivant ; rien n'est stocké à ton sujet. | À l'installation |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Accès au site, non accordé à l'installation. Quand tu appuies sur **Approve once**, l'extension demande à Chrome l'accès au seul site de cette requête. | La première fois que tu approuves une requête pour ce site, après que Chrome te l'a demandé |

L'extension ne lit que la page que tu approuves. Elle ne lit ni n'envoie tes données de navigation.

<!--i:eti-help-->
## Dépannage

- **Tu vois encore « Get the extension » ?** Recharge l'onglet Lolly.
- **Rien ne se passe sur ce site ?** L'extension fonctionne uniquement sur `https://lolly.tools`, plus `http://localhost:5173` dans le paquet de développement. Une autre origine, comme une copie auto-hébergée de Lolly, demande sa propre version compilée de l'extension qui liste cette origine à la fois dans `manifest.json` et `policy.js`. Modifier le manifeste seul ne suffit pas.
- **Une capture échoue ?** Vérifie que l'URL est accessible et commence par `http://` ou `https://`. Certaines pages bloquent la capture automatisée. Si tu as appuyé sur **Cancel**, fermé la fenêtre d'approbation ou attendu plus de 30 secondes, relance la capture.
