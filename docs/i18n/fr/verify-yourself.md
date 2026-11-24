# Vérifie par toi-même

Chaque promesse sur ce site peut être vérifiée, sans compte. La plupart des vérifications ne demandent qu'un navigateur ; les autres demandent un terminal et une copie du code source. Si une vérification ci-dessous ne donne pas le résultat affiché, c'est un bug ou une promesse non tenue, et nous voulons le savoir : voir [Si une vérification échoue](#if-a-check-fails).

Ces vérifications couvrent Lolly seul. Si ton organisation utilise Lolly Work, il ajoute l'authentification, le contenu partagé, la télémétrie configurée et les enregistrements d'audit ; vérifie-les à l'aide de [Surface serveur](/info/server-surface.html) et de la [section de la politique de confidentialité consacrée aux organisations](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Vois-le fonctionner en dix secondes

Ouvre [`/verify`](/#/verify) et dépose un fichier sur la page. Il n'y a ni envoi en ligne, ni compte, ni attente d'un serveur. Ici, l'outil vérifie [l'orage généré du Queensland](/info/ai-stance.html) présenté dans Notre position sur l'IA : une image générée par Gemini, que Lolly a ouverte, marquée et convertie. Chaque badge a été déterminé sur l'appareil, à partir des octets du fichier.

![Lolly Verify sur un écran de la largeur d'un téléphone - l'image de l'orage, un verdict vert Made with Lolly et les badges de justificatif intact et d'octets inchangés empilés dessous](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Le verdict est un petit ensemble de badges, chacun représentant un fait indépendant :

- <!--i:lock--> **Made with Lolly** : le justificatif est intact *et* enregistre un export Lolly.
- <!--i:seal--> **The credential is intact** : le manifeste C2PA signé peut être analysé et la signature de sa propre déclaration est valide.
- <!--i:hash--> **The bytes have not changed** : l'empreinte du fichier correspond toujours à ce qui a été signé. Modifie un pixel et ce badge change.
- <!--i:sparkle--> **GEN AI** : une machine a créé ces pixels, et le fichier le dit. Lolly relit cette déclaration au lieu de cacher ce fait.

Tout l'historique voyage avec le fichier. Neuf étapes subsistent ici : cinq enregistrées par Google lors de la génération et du filigranage de l'image, puis quatre enregistrées par Lolly lors de l'ouverture, du marquage et de la conversion de la copie sur cette page. Lolly Verify les lit directement dans les octets et les représente sous forme de timeline.

![L'historique des modifications que Lolly Verify relit dans l'image de l'orage - cinq étapes enregistrées par Google, puis quatre par Lolly, jusqu'au WebP de cette page](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Les vérifications ci-dessous sont les garanties qui sous-tendent cette démo, et chacune est reproductible. [Content Credentials](/info/content-credentials-identity.html) explique chaque verdict.

<!--i:eti-globe-->
## Dans ton navigateur, sans outil supplémentaire

::: timeline
- <!--i:globe--> **1. Observe le réseau.** Ouvre [lolly.tools](https://lolly.tools), ouvre les DevTools de ton navigateur (F12), passe à **Network** et utilise un outil : saisis une adresse web dans [Lolly QR Code](/t/qr-code), change les couleurs, exporte un PNG. Chaque requête va vers `lolly.tools` : l'interface hôte de l'application, les fichiers propres à l'outil et les ressources du catalogue. Il n'y a ni hôte d'analytique, ni balise de CDN, ni service de polices, ni point de terminaison de signalement d'erreurs. Ce que tu saisis dans un outil n'apparaît dans **absolument aucune requête**, car le rendu est local.
- <!--i:eyeoff--> **2. Coupe la connexion.** Charge l'application et ouvre un ou deux outils, puis passe hors ligne (mode avion, ou DevTools → Network → Offline) et recharge. La galerie et chaque outil que tu as ouvert continuent de fonctionner, y compris le rendu et l'export dans les formats que tu as utilisés. Les fichiers d'un outil et l'encodeur d'un format sont mis en cache à leur première utilisation, donc utilise un outil une fois en ligne avant de le tester hors ligne. C'est la vérification la plus probante de cette page : un logiciel qui communique avec son serveur ne survit pas à une coupure de connexion.
- <!--i:check--> **3. Compte les cookies.** DevTools → **Application** (Firefox : **Storage**) → Cookies → `https://lolly.tools`. La liste est vide : l'application ne dépose aucun cookie. Colle `document.cookie` dans la console et tu obtiens `""`. L'inscription facultative auprès de la CA dépose un cookie `HttpOnly` de courte durée, `lolly_ca_state`, limité à `/api/ca`, que `document.cookie` ne peut pas afficher. Une instance Lolly Work utilise ses propres cookies d'authentification ; compare-les à [Confidentialité](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Lis ton propre stockage.** Dans le même panneau, tout ce que Lolly conserve est devant toi : environ deux douzaines de clés `localStorage` en clair (thème, langue, largeur de la barre latérale, réglages du son et de l'affichage et copie en cache de l'index public du catalogue d'outils) et tes propres documents dans IndexedDB. Chaque valeur est une chaîne lisible ou du JSON, sans aucune obfuscation. Effacer les données du site supprime ces enregistrements locaux, mais pas une sauvegarde Sync ni les enregistrements stockés par une instance Lolly Work. **Settings → Storage → Clear all my data** fait la même chose depuis l'application, et tu peux voir les stockages et les caches se vider.
- <!--i:lock--> **5. Vérifie que le contact de divulgation existe.** [`/.well-known/security.txt`](/.well-known/security.txt) répond avec un bloc de contact [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), pas une page HTML.
:::

::: details Ce que tu peux aussi voir dans l'onglet Network
Certaines fonctionnalités n'accèdent au réseau que lorsque tu les utilises, et chacune est visible dans le même onglet :

- ajouter une **Google Font** dans Lolly Design System Setup récupère cette seule famille depuis Google, après une boîte de dialogue de consentement qui l'indique, une seule fois, avant la première récupération ;
- cliquer sur un **préréglage de profil de presse ICC** récupère ce profil depuis le registre public de l'ICC sur color.org ;
- écouter la **radio** intégrée facultative reçoit le flux de la station ;
- saisir un lieu dans **Meeting Planner** recherche cet endroit auprès du service de géocodage d'open-meteo pour obtenir ses coordonnées et son fuseau horaire, une fois par ville (les réponses sont enregistrées sur ton appareil), et le champ l'indique là où tu saisis le texte ;
- **Lolly URL Screenshot** charge l'adresse que tu as saisie, et tu peux le voir se faire.

Un outil qui déclare une capacité réseau ne peut récupérer des données qu'auprès des hôtes autorisés par son manifeste, et ce contrôle bloque l'accès en cas d'échec. Aucun outil distribué aujourd'hui n'en déclare, donc la Content-Security-Policy imposée par le navigateur limite la liste ci-dessus à ses hôtes. La [politique de confidentialité](/info/privacy.html) contient le tableau de référence de tous ces échanges, y compris le trafic des instances gérées, comme les actualisations des politiques et les rapports activés.
:::

<!--i:eti-code-->
## Depuis un terminal

**6. Le point de terminaison de rendu ne répond qu'avec des données publiques.** La seule fonctionnalité serveur qui place les entrées saisies dans une URL, les rendus par lien direct, est active ici. La [politique de confidentialité](/info/privacy.html) précise ce que cela signifie pour les entrées que tu mets dans un lien.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Chaque déploiement choisit (`LOLLY_DISABLE_RENDER_GET=1`) : sur une instance qui définit cette variable, la même sonde renvoie `404`. Cette différence montre que le réglage fonctionne, pas une incohérence.

**7. Vérifie les services activés par ton déploiement.** [Surface serveur](/info/server-surface.html) liste les services facultatifs et renvoie vers leurs références détaillées. Pour Lolly Work, inclus ses API authentifiées, sa connexion de collaboration, son stockage et ses fournisseurs configurés. Une sonde du site public lolly.tools ne teste pas une instance privée d'organisation.

Si tu exploites ta propre instance, [Déploiement de la livraison](/info/deploy-delivery.html) contient les vérifications de mise en production : l'intégrité des modèles, la sonde en périphérie et sa liste d'échantillons, les rendus d'affichage, la passerelle de téléchargement privée et le catalogue signé dans un navigateur.


<!--i:eti-search-->
## Dans le code source

Tout ce qui précède pourrait encore n'être qu'une façade si le code déployé différait du code public. Vérifie donc le code. Le déploiement est construit à partir du [dépôt public](https://github.com/lolly-tools/lolly) :

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Aucun traceur ni SDK d'analytique, nulle part.** Recherche les suspects habituels dans le code distribué (le moteur, chaque interface hôte, y compris l'extension de navigateur, les surcharges du pont Tauri et le service worker, les fonctions serveur et les packs d'outils) :

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Cette analyse recherche les SDK de suivi tiers. Elle ne démontre pas l'absence de rapports d'utilisation propres à Lolly : Lolly Work prend en charge la télémétrie de l'organisation et un journal d'audit distinct, avec leurs propres politiques et tests.

**9. Aucun résolveur DNS tiers.** La vérification SEAL de Lolly Verify n'envoie jamais de requête via un fournisseur DNS-over-HTTPS, car l'application n'a pas de résolveur :

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Le service de certificats ne conserve aucun journal d'émission.** La CA d'identité ne conserve ni journal de ce qu'elle a émis ni inventaire des identités : aucune ligne stdout, aucun webhook, aucun stockage de certificats. Tu peux rechercher cette absence :

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

La CA conserve bien un état de travail de courte durée : les compartiments de limitation de débit stockent des clés hachées d'IP et d'e-mail pendant leur fenêtre, et le stockage d'admission d'un déploiement géré conserve un identifiant dérivé avec une clé et une empreinte de requête pendant dix minutes au plus. [Ingénierie des Content Credentials](/info/content-credentials-engineering.html#protocol) donne les détails.

<!--i:eti-flask-->
## Garanti par des tests

Les vérifications du code source ci-dessus ne sont pas un audit ponctuel : elles sont inscrites dans la suite de tests, donc elles ne peuvent pas se dégrader silencieusement. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) vérifie une liste de noms de traceurs plus longue que l'analyse ci-dessus et fait échouer la compilation si :

- un SDK d'analytique ou de suivi apparaît où que ce soit dans le code source distribué qu'il analyse, dans l'application, le moteur, le serveur, l'extension ou les packs d'outils ;
- un résolveur DNS-over-HTTPS tiers apparaît dans ce code source ;
- le journal d'émission de la CA réapparaît, dans le code source **ou** le bundle serveur généré ;
- la politique de confidentialité perd ses mentions légalement obligatoires (responsable du traitement nommé, base juridique, droit de réclamation).

Exécute-les toi-même dans le clone (Node 22.18 ou ultérieur ; ce fichier ne demande pas de `pnpm install`) :

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite complète (`pnpm install && pnpm test`) en exécute plusieurs milliers d'autres, dont les tests cryptographiques adversariaux décrits dans [Sécurité & vérification](/info/security.html).

<!--i:eti-eye-off-->
## Ce que tu ne peux pas vérifier de l'extérieur

- **Journaux d'accès de l'hébergement.** Tout serveur peut journaliser les requêtes auxquelles il répond : adresse IP, chemin et heure. Une sonde externe ne peut pas établir combien de temps les journaux sont conservés. L'opérateur contrôle la journalisation, la rotation et les exports, et doit divulguer ces choix. Le rendu local garde les modifications ordinaires sur ton appareil ; le rendu serveur facultatif et les services d'espace de travail partagé ont les flux de données distincts décrits par la politique de confidentialité.
- **Le fait que le déploiement exécute ce code.** Tu peux vérifier que le code source est sain et que le comportement déployé correspond au code source, et les vérifications ci-dessus font les deux. La plateforme web ne propose pas d'attestation au niveau binaire d'un déploiement web. Les mesures d'atténuation sont le dépôt public, les tests obligatoires et la vérification hors ligne : un déploiement altéré qui communique avec son serveur échoue immédiatement aux vérifications 1 et 2.
- **Hooks des outils.** La logique facultative d'un outil intégré est revue plutôt qu'isolée dans un bac à sable : elle s'exécute dans la page sauf si l'outil choisit un Worker. Chaque outil sur lolly.tools est développé en interne et revu avant sa publication. Le [Modèle de menace](/info/threat-model.html#trust-boundaries) précise où les hooks s'exécutent et ce qui les limite.

<!--i:eti-warning-->
## Si une vérification échoue

Une différence entre cette page et ce que tu observes est un signalement de sécurité. Envoie-le par les canaux privés indiqués dans [Sécurité & vérification](/info/security.html#reporting-a-vulnerability). Nous pratiquons la divulgation coordonnée et créditons les personnes qui font les signalements.
