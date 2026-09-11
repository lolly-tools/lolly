# FAQ

Questions fréquentes affichées dans l'accordéon de la page d'accueil `/info`.

**Maintenance :** chaque titre `##` ci-dessous est une question ; tout ce qui se trouve en dessous
(jusqu'au `##` suivant) est la réponse. Les réponses utilisent le même markdown léger que
le reste du site - sépare les paragraphes par une ligne vide. Ajoute, supprime ou
réordonne les questions ici, puis relance `npm run build:info` (ou `npm run dev:web`).
Tout ce qui précède le premier `##` (ce titre et ces notes) est ignoré par le build.

## Que se passe-t-il quand j'active l'option sur la page /profile ?

Quand tu utilises Lolly pour la première fois, tout ce que tu saisis, où que ce soit, reste entièrement privé jusqu'à ce que tu décides toi-même de faire sortir cette information via un média ou un lien de partage (si tu es en ligne).

Si tu actives l'option, les informations de profil que tu choisis sont scellées dans ce que tu produis et t'identifient comme source. Rien n'est inclus sans que tu l'aies sélectionné.

Lolly produit un grand volume de contenu. Nous appliquons une minimisation stricte des données pour prévenir le risque.

## Lolly a-t-il été "vibe coded" ?

Lolly a été développé avec du code assisté par IA, de la découverte assistée par IA et, à de nombreux endroits, du contenu assisté par IA, en utilisant un mélange de modèles et de fournisseurs, y compris ceux d'entreprises de pointe du cloud public.

À la date de rédaction, Lolly ne contient aucune vulnérabilité de sécurité connue dans sa chaîne d'approvisionnement, et s'engage à des pratiques de réponse rapide en matière de sécurité dès que des CVE apparaissent.

Un humain a créé l'architecture, a façonné le code avec intention et a dirigé artistiquement l'expérience.

Plus important encore, Lolly se tient sur les épaules de décennies d'innovation open source, portées par de vrais experts du monde entier.

Un build-gate déterministe existe dans le code de Lolly pour garder le code et la documentation cohérents pour le lecteur moyen et "désencrasser" l'expérience. Cela peut rendre difficile une énumération synthétique propriétaire de l'origine. Ce n'est pas intentionnel.

**Déclaration sur l'IA générative :**

- **Code écrit par un LLM :** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (cette liste peut s'allonger)
- **Découverte par LLM :** Gemini 3.1, Fable
- **Documentation :** Sonnet 5
- **Bibliothèques open source :** leurs auteurs respectifs, indiqués dans la SBOM, les commentaires et les en-têtes de fichiers

Cette liste n'inclut pas les modèles intégrés directement dans Lolly.

**Contribution humaine:**

- **Architecture :** Andy Fitzsimon
- **Direction artistique :** Andy Fitzsimon
- **Code écrit par un humain :** Andy Fitzsimon
- **Idéation, relecture et retours :** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la communauté Penpot (liste non exhaustive)

## Que sont les feature flags ?

Les feature flags activent ou désactivent des parties de Lolly. D'habitude, c'est un administrateur qui les contrôle - avec Lolly, c'est toi.

![Chaque feature flag est un interrupteur qui t'appartient, placé dans ton propre profil plutôt que dans la console d'un administrateur](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Comment obtenir les applications mobile ou bureau ?

N'importe qui peut distribuer ses propres applications, et les outils comme la configuration de ces applications varient largement selon le public visé. Il n'existe donc pas d'application unique, sauf celle que tu as faite toi-même ou que quelqu'un de pertinent te donne.

## Pourquoi le nom « Lolly Tools » ?

**Lolly** parce que la liberté a un goût sucré, et parce qu'en Australie, en Nouvelle-Zélande et au Royaume-Uni, une « lolly » est un bonbon.

**Tools** parce qu'un outil reste immobile tant que tu ne le prends pas en main. Il ne tourne pas quand tu ne t'en sers pas, et il ne t'observe pas quand tu t'en sers.

## À quels obstacles s'attendre en adoptant Lolly ?

Lolly s'insère partout où tu génères déjà des fichiers - la CLI utilise le même moteur
que l'application, donc un pipeline lancé à 2 h du matin ne peut pas diverger de ce qu'une
personne prévisualise dans un navigateur. Le frein à l'adoption est rarement technique ; il est organisationnel. Attends-toi à ceci :

**Il faut composer un catalogue de marque organisé.** Lolly est une plateforme, pas un
lot fini de tes gabarits. Pour un *déploiement gouverné*, quelqu'un définit le catalogue
d'assets partagé (logos, palettes, polices sous forme d'ID permanents) et écrit le manifeste +
le template de chaque type de sortie. Les individus n'ont pas à attendre pour autant - dans
l'application ouverte, chacun peut importer ses propres fichiers dans le catalogue et créer des outils dans
Design dès le premier jour.

**Aucun git requis pour contribuer.** Les designers font leurs propres outils et gabarits
dans l'application, puis les partagent avec leurs pairs ou les soumettent à la personne qui gère le
déploiement pour une inclusion par défaut.

**C'est volontairement étroit - présente-le ainsi.** Lolly n'est pas fait pour du contenu sur mesure
ou héroïque. C'est *bien* ton DAM personnel - alimenté et décuplé par ton design
system, tes outils et ton catalogue - et il a *bien* une toile libre (Design), mais
même là, les couleurs, la typographie et les assets se conforment aux globals de design actifs, si bien que
la composition libre reste dans le système. Comparé à Figma ou Canva, il
paraîtra limité. Jugé pour ce qu'il est - de la génération d'assets industrialisée, récurrente et à très
grande échelle - rien ne rivalise. Le mauvais cadrage est le contretemps le plus fréquent.

**La conduite du changement côté production.** Les processus existants fonctionnent aujourd'hui, même si
le résultat n'est pas conforme à la marque. Les rebrancher sur le moteur suppose de retester, de réapprendre,
et « on sait déjà fabriquer des fichiers » devient l'excuse pour ne pas migrer. Commence par convertir
une sortie de qualité production très visible et par montrer l'avant/après côte à côte.

Lolly tire tout vers le haut.


## Qu'est-ce qui distingue les utilitaires des outils ?

**Réponse simple →** Les utilitaires n'ont pas toujours besoin d'un rendu et peuvent donc recevoir une UX différente. 

**Vraie réponse →** Si les utilitaires sont hébergeables dans Lolly Tools, c'est pour ajouter une « couche de commodité » de défense supplémentaire qui décourage l'exfiltration de données. 

Pourquoi ? Parce qu'on sait que, chaque jour, des gens prennent **du contenu confidentiel qu'ils ont déjà** et le confient à un
site web quelconque pour une petite opération mécanique :

- « **Compresser ce PDF** » → envoie un contrat / une fiche de paie / un dossier de conseil d'administration à des entités inconnues.
- « **convertir un HEIC en JPG** » → envoie des photos personnelles (avec EXIF GPS) chez un hébergeur financé par la pub
- « **recadrer / redimensionner cette image** » → envoie une capture produit ou un asset non publié
- « **formater ce JSON** » / « décoder ce JWT » → colle des réponses d'API, des jetons, des secrets dans un formateur
- « **fusionner ces PDF** » → envoie **deux documents qui ne devraient jamais partager un serveur**

Ces sites et leur immense longue traîne de clones ne sont **pas dignes de confiance par défaut** : rétention inconnue, juridictions inconnues, sous-traitants inconnus et un modèle économique pub/affiliation qui a tout intérêt à garder ce que tu lui donnes. L'opération est triviale ; le **coût, c'est le contenu.** 

On gagne la bataille de la gouvernance par une commodité et un service excellents. 

![La vue Utilities rassemble les tâches mécaniques qu'on confie d'habitude à un site web quelconque, exécutées ici dans Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Lolly peut-il modifier et rendre mes fichiers Figma, Penpot, Illustrator ou InDesign ?

Oui. Ouvre **Design** et clique sur **Import a design** (importer un design) : il accepte un **.fig** natif de Figma (Save local copy), un export Penpot **.penpot**, un **.ai** ou un **.pdf** d'Illustrator, un **.idml** d'InDesign (File → Export → InDesign Markup) ou **n'importe quel SVG** (la porte large - presque toutes les applications de design en exportent). Aucun compte, aucun plugin et aucune licence d'application de design ne sont nécessaires.

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Les calques arrivent sous forme de blocs modifiables sur la toile libre : le texte reste ressaisissable, les formes restent des formes, les images rejoignent ta propre bibliothèque d'images, et la typographie comme les couleurs se conforment aux globals de marque. Enregistre-la et la mise en page devient un gabarit réutilisable, adressable par URL, que n'importe qui disposant de Lolly peut remplir à nouveau - et tu peux y mêler des outils vivants (un QR code, un graphique) qui se rendent à nouveau au chargement. À partir de là, elle se rend comme tout le reste dans Lolly - SVG, PDF, PNG et les autres, reproductibles depuis leur URL. Voir [Import a design](/info/design-import.html).

## Puis-je partager mon travail sous forme de fichier plutôt que de lien ?

Oui. Quand un lien ne peut pas tout transporter (tes propres photos, un texte long), la boîte de dialogue Share dit exactement ce qui serait perdu et propose à la place un fichier **.lolly** : un seul fichier contenant le design, les images qu'il utilise et, si tu le souhaites, l'outil lui-même. Tu décides de ce qui voyage - ton nom et tes coordonnées n'y figurent que si ton profil l'autorise, les visuels sous licence sont retenus sauf si tu les inclus, et la personne qui ouvre un fichier porteur d'un outil se voit demander si elle lui fait confiance avant qu'il puisse s'exécuter. Voir [Partager ton travail](/info/using.html#sharing-your-work).

## Deux personnes peuvent-elles travailler sur le même design sans internet ?

Oui. Une personne partage une invitation (un lien, un QR code ou un code court), l'autre l'accepte, et les deux appareils tiennent la même session en direct - présence, anneaux de focus et tout le reste. Ça marche sur n'importe quel réseau partagé, y compris un partage de connexion téléphonique au fond d'un sous-sol, parce qu'il n'y a aucun serveur au milieu. Voir [Travailler ensemble](/info/collaborate.html).

## Où sont passés les outils aux couleurs de SUSE ?

Ils vivent déjà dans un dépôt séparé et privé. Un clone public ne récupère pas du tout le brand pack SUSE, donc un build public tourne avec le profil neutre `lolly-start` - les outils communautaires indépendants de toute marque, plus une marque vierge que tu remplis avec la tienne. SUSE exploite sa propre instance pour protéger ses marques déposées.

## Pourquoi est-ce gratuit ? Où est le piège ?

**Nous avons construit Lolly pour nous.** SUSE avait besoin de milliers de fichiers conformes à sa marque, chacun portant son nom scellé à l'intérieur, produits sans rien confier à des services extérieurs. Nous avons donc construit un outil qui fait tout cela sur l'appareil, et nous l'avons publié en open source, comme tout ce que nous faisons. Nous continuons à le maintenir parce que nous l'utilisons tous les jours. **Il n'y a aucune obligation :** tout ici fonctionne avec ou sans nous.

Cette ligne est tracée dans la licence, pas dans une promesse : tout ce qui tourne en local est gratuit, pour toujours. Une version publiée est sous une licence qui interdit de la reprendre, et aucun accord de contributeur ne pourrait relicencier le travail de qui que ce soit. Voir [positionnement](/info/positioning.html) pour l'énoncé complet.

## Quelle part SUSE garde-t-elle privée ? (autrement dit : quand nous retire-t-on le tapis sous les pieds ?)

Le moteur, les shells, les schémas et les outils indépendants de toute marque sont open source ; les marques déposées de SUSE et ses outils de marque sont la partie qui reste privée, et elle est déjà séparée. L'instance publique sur [lolly.tools](https://lolly.tools) tourne avec la marque vierge.

La frontière est structurelle plutôt que promise. Chaque version publiée est open source et ne peut pas être dépubliée, aucun accord de contributeur ne pourrait relicencier le travail de qui que ce soit, et la seule chose retenue est la marque déposée. Quand une autre entreprise a fermé les sources de son Linux d'entreprise en 2023, SUSE a cofondé [OpenELA](https://openela.org) pour garder ce code ouvert - c'est la posture dont ce projet hérite.

En toute transparence : SUSE développe *bel et bien* des outils internes pour intégrer Lolly à ses systèmes informatiques - cela concerne l'installation interne de SUSE, pas un développement public contre privé. Lolly vise aussi à être construit via [Open Build Service](https://openbuildservice.org/), avec des artefacts de chaîne d'approvisionnement sécurisés livrés par la [SUSE Application Collection](https://apps.rancher.io/applications).

## Quel parfum a ce logo Lolly ?

Certains disent citron vert, d'autres menthe et parfois pomme ; Lolly apporte le sucré, c'est toi qui fais le parfum !
