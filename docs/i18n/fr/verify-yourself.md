# Vérifie-le toi-même

Les pages de confidentialité et de sécurité de Lolly avancent des affirmations : pas d'analytics, pas de suivi, les fichiers ne quittent jamais l'appareil, un seul cookie dans tout le système. Cette page est différente : elle ne te demande pas de croire tout cela. C'est une liste de procédures, chacune avec la commande ou le chemin de clics exact et le résultat que tu obtiendras. Chaque affirmation ici est réfutable en quelques minutes, la plupart sans rien installer.

Si une vérification de cette page ne produit pas le résultat indiqué, c'est soit un bug, soit une promesse rompue. [Signale-le](#if-a-check-fails) dans les deux cas, et nous le traiterons avec la gravité que mérite une promesse rompue.

## Vois-le fonctionner, en dix secondes

Avant les procédures, le résultat concret. Ouvre [`/verify`](/#/verify) et dépose un fichier dessus - pas de téléversement, pas de compte, pas d'attente pour un serveur. Voici sa vérification de l'[orage du Queensland généré](/info/ai-stance.html) tiré de notre page de position sur l'IA : une image Gemini que Lolly a ouverte, redimensionnée et exportée. Chaque badge ci-dessous a été calculé sur l'appareil, à partir des octets mêmes du fichier.

![Verify sur un écran largeur téléphone - l'image de l'orage, un verdict vert Made with Lolly et les badges credential-intact et bytes-unchanged empilés en dessous](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Le verdict n'est pas un seul badge mais une petite pile de badges, chacun un fait indépendant :

- <!--i:lock--> **Made with Lolly** - le credential est intact *et* enregistre un export Lolly.
- <!--i:seal--> **Le credential est intact** - le manifeste C2PA signé s'analyse correctement et sa propre signature de claim se vérifie.
- <!--i:hash--> **Les octets n'ont pas changé** - le hash du fichier correspond toujours à ce qui a été signé. Modifie un seul pixel et ce badge bascule.
- <!--i:sparkle--> **GEN AI** - une machine a produit ces pixels, et le fichier le dit. Lolly relit cette assertion au lieu de la masquer.

Et tout l'historique voyage avec le fichier. Neuf étapes survivent ici - cinq enregistrées par Google lors de la génération et du filigranage de l'image, puis quatre enregistrées par Lolly à l'ouverture, au marquage et à la conversion de la copie sur cette page - relues directement dans les octets, sur ton appareil, et rendues sous forme de chronologie. C'est la même image, vérifiée de la même façon, que la chronologie C2PA sur la [page de position sur l'IA](/info/ai-stance.html).

![L'historique des modifications que Verify relit dans l'image de l'orage - cinq étapes enregistrées par Google, puis quatre par Lolly, se terminant par le WebP sur cette page](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Rien de tout cela n'est la garantie de confiance, cela dit - c'est la démo. Le reste de cette page est la garantie de confiance : chaque badge ci-dessus est reproductible, et voici comment reproduire les garanties qui les sous-tendent.

## Dans ton navigateur, sans outil

**1. Observe le réseau.** Ouvre [lolly.tools](https://lolly.tools), ouvre les DevTools de ton navigateur (F12), passe à l'onglet **Network** et utilise un outil - saisis une URL dans [QR Code](/t/qr-code), change des couleurs, exporte un PNG. Chaque requête reste sur `lolly.tools` : l'app shell, les fichiers propres à l'outil, les ressources du catalogue. Aucun hôte d'analytics, aucun beacon CDN, aucun service de polices, aucun point de « rapport d'erreurs ». Ce que tu tapes dans un outil n'apparaît dans **aucune requête** - le rendu est local.

Les exceptions honnêtes - chacune opt-in, initiée par l'utilisateur et visible dans ce même onglet Network au moment où elle se produit : ajouter une **Google Font** dans l'éditeur de marque va chercher cette famille chez Google, après une boîte de dialogue de consentement qui te le dit exactement, une fois, avant la première requête ; cliquer sur un **préréglage de profil presse ICC** va chercher ce profil dans le registre public de l'ICC sur color.org ; lancer la **radio** intégrée optionnelle diffuse depuis la station ; saisir un lieu dans **Meeting Planner** interroge le service de géocodage d'open-meteo pour ses coordonnées et son fuseau horaire, une fois par ville (les réponses sont enregistrées sur ton appareil), et le champ de saisie porte cette information à l'endroit même où tu tapes ; et **URL Screenshot** charge nécessairement l'URL que tu as saisie - c'est son rôle, et tu le vois se produire. Un outil qui déclare une capacité réseau ne peut interroger que les hôtes autorisés par son manifeste, et ce mécanisme est fail-closed ; aucun outil livré actuellement n'en déclare une, donc la Content-Security-Policy imposée par le navigateur est la barrière qui maintient réellement la liste ci-dessus à ses hôtes. La [politique de confidentialité](/info/privacy.html) tient le tableau canonique de tout cela ; sa règle constante est qu'un accès réseau absent de ce tableau ne se produit pas.

**2. Débranche.** Charge l'app et ouvre un ou deux outils, puis passe hors ligne - mode avion, ou DevTools → Network → Offline. Recharge. La galerie et chaque outil que tu as ouvert continuent de fonctionner, y compris le rendu et l'export dans les formats que tu as utilisés - les fichiers d'un outil et l'encodeur d'un format sont mis en cache la première fois que tu les utilises, donc exerce un outil une fois en ligne avant de le tester hors ligne. C'est la vérification la plus solide de cette page : un logiciel qui « appelle la maison » ne survit pas à la coupure du fil.

**3. Compte les cookies.** DevTools → **Application** (Firefox : **Storage**) → Cookies → `https://lolly.tools`. La liste est vide - l'app ne pose aucun cookie. Ou colle `document.cookie` dans la console : tu obtiens `""`. (Le seul cookie de tout le système, `lolly_ca_state`, vit au maximum dix minutes pendant une connexion d'identité optionnelle - supprimé dès que la connexion aboutit - est cantonné à `/api/ca` et est `HttpOnly` : la [politique de confidentialité](/info/privacy.html) le décrit précisément.)

**4. Lis ton propre stockage.** Même panneau Application : tout ce que Lolly conserve est inspectable devant toi - une vingtaine de clés `localStorage` en clair (thème, langue, largeur de la barre latérale, réglages de son et d'affichage, plus une copie en cache de l'index public du catalogue d'outils), et tes propres documents dans IndexedDB. Chaque valeur est une chaîne ou un JSON lisible - rien n'est obfusqué, rien n'est encodé pour en décourager la lecture. **Profil → Effacer toutes mes données** efface tout ; effacer les données du site dans le navigateur fait de même, car il n'existe aucune copie côté serveur pour y survivre.

**5. Vérifie que le contact de signalement existe.** [`/.well-known/security.txt`](/.well-known/security.txt) répond avec un bloc de contact [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), pas une page HTML.

## Depuis un terminal

**6. Le point de terminaison de rendu ne répond qu'avec des données publiques.** L'unique fonctionnalité serveur qui place des saisies utilisateur dans une URL - les rendus par lien direct - est active ici, et la [politique de confidentialité](/info/privacy.html) précise ce que cela signifie pour les entrées que tu places dans un lien :

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Le commutateur est propre à chaque déploiement (`LOLLY_DISABLE_RENDER_GET=1`) : sur une instance qui le définit, la même sonde renvoie `404` - cette différence montre que le drapeau fonctionne, ce n'est pas une incohérence.

**7. La surface serveur est énumérable.** [Server Surface](/info/server-surface.html) liste chaque route côté serveur qui existe, avec la règle constante qu'un point de terminaison absent de cette page ne fait pas partie de Lolly. Fais un `curl` dessus ; il n'y a rien d'autre à trouver.

## Dans le code source

Tout ce qui précède pourrait encore être du théâtre si le code déployé différait du code public. Alors vérifie le code - le déploiement se construit à partir du [dépôt public](https://github.com/lolly-tools/lolly) :

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Aucun traqueur, aucun SDK d'analytics, nulle part.** Cherche dans le code livré - le moteur, chaque shell (y compris l'extension navigateur, les surcharges du pont Tauri et le service worker), les fonctions serveur et les packs d'outils - les suspects habituels :

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Aucun résolveur DNS tiers.** La vérification SEAL de Verify n'achemine jamais les résolutions via un fournisseur DNS-over-HTTPS - l'app web n'a tout simplement aucun résolveur :

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Le service de certificats ne conserve rien.** L'AC d'identité n'a aucun journal d'émission - ni ton e-mail, ni un horodatage, ni un webhook. L'absence est vérifiable par grep :

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Imposé par les tests, pas par des promesses

Les trois vérifications de code ci-dessus ne sont pas un audit ponctuel - elles sont ancrées dans la suite de tests, pour qu'elles ne puissent pas se dégrader en silence. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) fait échouer la build si :

- un SDK d'analytics ou de traçage apparaît n'importe où dans le code source livré qu'il scanne - app, moteur, serveur, extension et code des packs d'outils sans exception,
- un résolveur DNS-over-HTTPS tiers apparaît dans ce code source,
- le journal d'émission de l'AC réapparaît - dans le code source **ou** dans le bundle serveur généré,
- la politique de confidentialité perd ses mentions légales obligatoires (responsable nommé, base juridique, droit de réclamation).

Exécute-les toi-même dans le clone (Node 22.18+ ; `pnpm install` n'est pas nécessaire pour ce fichier) :

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite complète (`pnpm install && pnpm test`) en exécute plusieurs milliers de plus, y compris les tests cryptographiques adverses décrits dans [Sécurité et vérification](/info/security.html).

## Ce que tu ne peux pas vérifier de l'extérieur - dit sans détour

Une page comme celle-ci gagne la confiance en nommant ses propres limites :

- **Journaux d'accès de l'hébergeur.** Tout serveur qui répond à une requête peut journaliser cette requête - IP, chemin, horodatage. Tu ne peux pas vérifier ce qu'un hébergeur conserve ou non, et nous non plus au-delà du comportement documenté de notre fournisseur. C'est exactement pour cela que l'architecture garde ton contenu entièrement hors du réseau : ce qui ne quitte jamais ton appareil ne peut être journalisé par personne.
- **Que le déploiement exécute bien ce code.** Tu peux vérifier que le code source est propre et que le comportement déployé y correspond (les vérifications ci-dessus couvrent les deux bouts), mais l'attestation au niveau binaire d'un déploiement web n'est pas quelque chose que la plateforme web offre. Les mesures d'atténuation sont le dépôt public, les tests imposés et la vérification hors ligne - un déploiement altéré qui « appelle la maison » échoue immédiatement aux vérifications 1 et 2.
- **Les hooks d'outils ne sont pas isolés par défaut.** La logique optionnelle d'un outil s'exécute revue, dans le realm propre de la page ; chaque outil sur lolly.tools est de première partie et revu avant d'être livré. L'isolation par Worker est désormais livrée en opt-in par outil - un outil dont le manifeste définit `isolate: true` exécute ses hooks hors thread principal - donc ce que tu ne peux pas vérifier de l'extérieur se réduit, mais le chemin par défaut reste in-realm et la revue reste le contrôle. C'est énoncé, pas caché - voir la section [limites de conception](/info/security.html), qui l'a toujours dit.

## Si une vérification échoue

Un écart entre cette page et le comportement observé est un signalement de sécurité, et nous préférons sincèrement en entendre parler : [fitzy+security@suse.com](mailto:fitzy+security@suse.com), le bouton **Report a vulnerability** sur n'importe quel [dépôt lolly-tools](https://github.com/lolly-tools) ou le contact dans [`/.well-known/security.txt`](/.well-known/security.txt). La divulgation coordonnée et le crédit au rapporteur sont la politique constante - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) en donne les détails.
