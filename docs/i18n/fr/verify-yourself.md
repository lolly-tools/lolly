# Vérifie-le toi-même

Chaque promesse de ce site peut être vérifiée, sans compte. La plupart des vérifications n'exigent qu'un navigateur ; les autres demandent un terminal et une copie du code source. Si une vérification ci-dessous ne donne pas le résultat indiqué, c'est un bug ou une promesse rompue, et nous voulons le savoir : voir [If a check fails](#if-a-check-fails).

Commence par la plus rapide : dépose un fichier sur Verify. Puis va plus loin : surveille le réseau pendant que tu utilises un outil, débranche et continue de travailler, compte les cookies et lis le code source.

Ces vérifications couvrent Lolly seul. Si ton organisation fait tourner Lolly Work, il ajoute la connexion, le contenu partagé, la télémétrie configurée et les enregistrements d'audit ; vérifie-les par rapport à [Server Surface](/info/server-surface.html) et à la [section organisation de la politique de confidentialité](/info/privacy.html#organisation-services-with-lolly-work).

## Vois-le fonctionner, en dix secondes

Ouvre [`/verify`](/#/verify) et dépose un fichier sur la page. Il n'y a ni envoi, ni compte, ni attente d'un serveur. Ici, elle vérifie la [tempête du Queensland générée](/info/ai-stance.html) de Our AI Stance : une image que Gemini a générée, que Lolly a ouverte, marquée et convertie. Chaque badge a été calculé sur l'appareil, à partir des octets propres du fichier.

![Verify sur un écran largeur téléphone - l'image de l'orage, un verdict vert Made with Lolly et les badges credential-intact et bytes-unchanged empilés en dessous](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Le verdict est un petit tas de badges, chacun un fait indépendant :

- <!--i:lock--> **Made with Lolly** : le credential est intact *et* consigne un export Lolly.
- <!--i:seal--> **The credential is intact** : le manifeste C2PA signé s'analyse et sa propre signature de déclaration se vérifie.
- <!--i:hash--> **The bytes have not changed** : le hachage du fichier correspond toujours à ce qui a été signé. Modifie un pixel et ce badge bascule.
- <!--i:sparkle--> **GEN AI** : une machine a produit ces pixels, et le fichier le dit. Lolly relit cette déclaration au lieu de cacher le fait.

Tout l'historique voyage avec le fichier. Neuf étapes survivent ici : cinq que Google a consignées en générant et en filigranant l'image, puis quatre que Lolly a consignées en ouvrant, marquant et convertissant la copie sur cette page. Verify les lit directement dans les octets et les dessine sous forme de timeline.

![L'historique des modifications que Verify relit dans l'image de l'orage - cinq étapes enregistrées par Google, puis quatre par Lolly, se terminant par le WebP sur cette page](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Voilà la démo. Les vérifications ci-dessous sont les garanties qui la sous-tendent, et chacune est reproductible. [Content Credentials](/info/content-credentials-identity.html) explique chaque verdict.

## Dans ton navigateur, sans outil

::: timeline
- <!--i:globe--> **1. Surveille le réseau.** Ouvre [lolly.tools](https://lolly.tools), ouvre les DevTools de ton navigateur (F12), passe sur **Network** et utilise un outil : saisis une adresse web dans [QR Code](/t/qr-code), change des couleurs, exporte un PNG. Chaque requête reste sur `lolly.tools` : le shell de l'application, les fichiers propres de l'outil et les ressources du catalogue. Il n'y a ni hôte d'analytique, ni balise de CDN, ni service de polices, ni point de remontée d'erreurs. Ce que tu saisis dans un outil n'apparaît dans **aucune requête**, car le rendu est local.
- <!--i:eyeoff--> **2. Débranche.** Charge l'application et ouvre un ou deux outils, puis passe hors ligne (mode avion, ou DevTools → Network → Offline) et recharge. La galerie et chaque outil que tu as ouvert continuent de fonctionner, y compris le rendu et l'export dans les formats que tu as utilisés. Les fichiers d'un outil et l'encodeur d'un format sont mis en cache la première fois que tu les utilises, donc utilise un outil une fois en ligne avant de le tester hors ligne. C'est la vérification unique la plus forte de cette page : un logiciel qui téléphone chez lui ne survit pas à la coupure de son cordon.
- <!--i:check--> **3. Compte les cookies.** DevTools → **Application** (Firefox : **Storage**) → Cookies → `https://lolly.tools`. La liste est vide : l'application ne dépose aucun cookie. Colle `document.cookie` dans la console et tu obtiens `""`. L'inscription facultative à la CA dépose un cookie `HttpOnly` de courte durée, `lolly_ca_state`, limité à `/api/ca`, que `document.cookie` ne peut pas montrer. Une instance Lolly Work utilise ses propres cookies de connexion ; compare-les avec [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Lis ton propre stockage.** Dans le même panneau, tout ce que Lolly conserve est devant toi : une vingtaine de clés `localStorage` simples (thème, langue, largeur de la barre latérale, réglages de son et d'affichage, et une copie en cache de l'index public du catalogue d'outils) et tes propres documents dans IndexedDB. Chaque valeur est une chaîne ou du JSON lisible, sans rien d'obscurci. Effacer les données du site supprime ces enregistrements locaux, mais pas une sauvegarde Sync ni les enregistrements détenus par une instance Lolly Work. **Settings → Storage → Clear all my data** fait de même depuis l'application, et tu peux regarder les stockages et caches se vider.
- <!--i:lock--> **5. Vérifie que le contact de divulgation existe.** [`/.well-known/security.txt`](/.well-known/security.txt) répond par un bloc de contact [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), pas par une page HTML.
:::

::: details Ce que tu peux voir d'autre dans l'onglet Network
Certaines fonctions n'atteignent le réseau que lorsque tu les utilises, et chacune est visible dans le même onglet :

- ajouter une **Google Font** dans Design System Setup récupère cette seule famille auprès de Google, après une boîte de dialogue de consentement qui le dit, une fois, avant la première récupération ;
- cliquer sur un **préréglage de profil d'impression ICC** récupère ce profil depuis le registre public de l'ICC sur color.org ;
- jouer la **radio** intégrée facultative diffuse un flux depuis la station ;
- saisir un lieu dans **Meeting Planner** recherche ce lieu auprès du service de géocodage d'open-meteo pour ses coordonnées et son fuseau horaire, une fois par ville (les réponses sont enregistrées sur ton appareil), et le champ le dit là où tu tapes ;
- **URL Screenshot** charge l'adresse que tu as saisie, car c'est sa fonction, et tu le vois se produire.

Un outil qui déclare une capacité réseau ne peut récupérer que depuis les hôtes que son manifeste autorise, et cette vérification échoue par sécurité. Aucun outil livré aujourd'hui n'en déclare, donc c'est la Content-Security-Policy appliquée par le navigateur qui limite la liste ci-dessus à ses hôtes. La [politique de confidentialité](/info/privacy.html) tient le tableau canonique de tout cela, y compris le trafic d'instance gérée comme les actualisations de politique et les rapports activés.
:::

## Depuis un terminal

**6. Le point de rendu ne répond qu'avec des données publiques.** La seule fonction serveur qui place des entrées saisies dans une URL, les rendus par lien direct, est active ici. La [politique de confidentialité](/info/privacy.html) dit ce que cela signifie pour les entrées que tu mets dans un lien.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Chaque déploiement choisit (`LOLLY_DISABLE_RENDER_GET=1`) : sur une instance qui le définit, la même sonde renvoie `404`. Cette différence est le réglage qui fonctionne, pas une incohérence.

**7. Vérifie les services que ton déploiement active.** [Server Surface](/info/server-surface.html) liste les services facultatifs et renvoie vers leurs références détaillées. Pour Lolly Work, inclus ses API authentifiées, sa connexion de collaboration, son stockage et les fournisseurs configurés. Une sonde du lolly.tools public ne teste pas une instance privée d'organisation.

Si tu fais tourner ta propre instance, [Delivery deployment](/info/deploy-delivery.html) contient les vérifications de publication pour elle : intégrité des modèles, sonde de périphérie et sa liste d'échantillons, rendus d'affichage, passerelle de téléchargement privée et catalogue signé dans un navigateur.


## Dans le code source

Tout ce qui précède pourrait encore être du théâtre si le code déployé différait du code public. Vérifie donc le code. Le déploiement se construit à partir du [dépôt public](https://github.com/lolly-tools/lolly) :

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Aucun traceur et aucun SDK d'analytique, nulle part.** Cherche dans le code livré (le moteur, chaque shell dont l'extension de navigateur, les surcharges du pont Tauri et le service worker, les fonctions serveur et les packs d'outils) les suspects habituels :

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Cette recherche vise les SDK de suivi tiers. Elle ne montre pas l'absence de rapports d'usage propres : Lolly Work prend en charge la télémétrie d'organisation et un journal d'audit distinct, avec leur propre politique et leurs propres tests.

**9. Aucun résolveur DNS tiers.** La vérification SEAL de Verify n'envoie jamais de recherche via un fournisseur DNS-over-HTTPS, car l'application n'a pas de résolveur :

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Le service de certificats ne tient aucun journal d'émission.** La CA d'identité ne tient aucun journal de ce qu'elle a émis ni d'inventaire d'identités : pas de ligne stdout, pas de webhook, pas de magasin de certificats. Cette absence peut se rechercher :

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

La CA conserve bien un état de travail de courte durée : les compartiments de limitation de débit contiennent des clés hachées d'IP et d'e-mail pendant leur fenêtre, et le magasin d'admission d'un déploiement géré conserve un identifiant à clé et une empreinte de requête pendant dix minutes au plus. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) donne le détail.

## Appliqué par des tests

Les vérifications de source ci-dessus ne sont pas un audit ponctuel : elles sont épinglées dans la suite de tests, donc elles ne peuvent pas pourrir en silence. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) vérifie une liste de noms de traceurs plus longue que la recherche ci-dessus et fait échouer le build si :

- un SDK d'analytique ou de suivi apparaît n'importe où dans le code livré qu'il analyse, dans le code de l'application, du moteur, du serveur, de l'extension et des packs d'outils ;
- un résolveur DNS-over-HTTPS tiers apparaît dans ce code ;
- le journal d'émission de la CA revient, dans le code source **ou** dans le bundle serveur généré ;
- la politique de confidentialité perd ses mentions légalement requises (responsable du traitement nommé, base juridique, droit de déposer plainte).

Lance-les toi-même dans le clone (Node 22.18 ou plus récent ; ce fichier n'a pas besoin de `pnpm install`) :

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite complète (`pnpm install && pnpm test`) en exécute plusieurs milliers de plus, y compris les tests cryptographiques adverses décrits dans [Sécurité et vérification](/info/security.html).

## Ce que tu ne peux pas vérifier de l'extérieur

- **Les journaux d'accès de l'hébergement.** Tout serveur qui répond à une requête peut la journaliser : adresse IP, chemin et heure. Une sonde extérieure ne peut pas établir combien de temps les journaux sont conservés. L'opérateur contrôle la journalisation, la rotation et les exports, et doit communiquer ces choix. Le rendu local garde les modifications ordinaires sur ton appareil ; le rendu serveur facultatif et les services d'espace de travail partagé ont les flux de données distincts que décrit la politique de confidentialité.
- **Que le déploiement exécute ce code.** Tu peux vérifier que le code source est propre et que le comportement déployé lui correspond, et les vérifications ci-dessus font les deux. L'attestation au niveau binaire d'un déploiement web n'est pas offerte par la plateforme web. Les atténuations sont le dépôt public, les tests appliqués et la vérification hors ligne : un déploiement altéré qui téléphone chez lui échoue d'un coup aux vérifications 1 et 2.
- **Les hooks d'outils.** La logique facultative d'un outil intégré est relue plutôt qu'isolée : elle s'exécute dans la page sauf si l'outil choisit un Worker. Chaque outil sur lolly.tools est de première partie et relu avant publication. Le [Threat Model](/info/threat-model.html#trust-boundaries) expose où les hooks s'exécutent et ce qui les limite.

## Si une vérification échoue

Un écart entre cette page et ce que tu observes est un signalement de sécurité. Envoie-le par les canaux privés de [Security & Verification](/info/security.html#reporting-a-vulnerability). Nous pratiquons la divulgation coordonnée et créditons ceux qui signalent.
