# Questions et réponses

Questions fréquentes, présentées sous forme d'accordéon sur `/info/start/faq.html`.

**Maintenance :** chaque titre `##` ci-dessous est une question ; tout ce qui se trouve en dessous
(jusqu'au `##` suivant) est la réponse. Les réponses utilisent le même markdown léger que
le reste du site - sépare les paragraphes par une ligne vide. Ajoute, supprime ou
réordonne les questions ici, puis relance `pnpm run build:info` (ou `pnpm run dev:web`).
Tout ce qui précède le premier `##` (ce titre et ces notes) est ignoré par le build.

L'ordre est celui d'un débutant : d'abord le piège, puis tes fichiers, puis l'obtention
et l'exécution de Lolly, puis les organisations, puis la façon dont il a été fait. L'ancre
de chaque question est construite à partir de la question anglaise à la même position, donc une traduction garde
l'ordre anglais.

## Pourquoi est-ce gratuit ? Où est le piège ?

**Nous avons construit Lolly pour nous.** SUSE avait besoin de milliers de fichiers aux couleurs de la marque, créés sans rien confier à des services extérieurs. Nous avons donc construit un outil qui fait tout cela sur l'appareil, et nous l'avons publié en open source, comme tout ce que nous faisons. Nous continuons de le maintenir parce que nous l'utilisons tous les jours. **Il n'y a aucune obligation :** tout ce qui est ici fonctionne avec ou sans nous.

Cette limite est inscrite dans la licence, pas dans une promesse : tout ce qui tourne en local est gratuit, pour toujours. Une version publiée est placée sous une licence qui ne peut pas être retirée, et il n'existe aucun accord de contributeur qui pourrait changer la licence du travail de quiconque.

## Quelle part SUSE garde-t-elle privée ? (autrement dit : quand nous retire-t-on le tapis sous les pieds ?)

Le moteur, les shells, les schémas et les outils indépendants d'une marque sont open source. Les marques déposées de SUSE et les outils à son image sont la partie qui reste privée, et ils sont déjà séparés. L'instance publique sur [lolly.tools](https://lolly.tools) fait tourner [Lolly Demo](/info/lolly-demo.html), le propre design system de Lolly.

Rien ici ne repose sur une promesse : chaque version publiée reste open source, et la seule chose réservée est la marque déposée. Quand une autre entreprise a fermé ses sources de Linux d'entreprise en 2023, SUSE a cofondé [OpenELA](https://openela.org) pour garder ce code ouvert, la même posture dont ce projet hérite.

En toute transparence : SUSE *construit* des outils internes pour relier Lolly à ses propres systèmes informatiques. C'est la configuration interne de SUSE, pas une séparation entre développement public et privé. Lolly vise aussi à être construit via [Open Build Service](https://openbuildservice.org/), avec des artefacts sécurisés de chaîne d'approvisionnement fournis par la [SUSE Application Collection](https://apps.rancher.io/applications).

## Pourquoi le nom « Lolly Tools » ?

**Lolly** parce que la liberté a un goût sucré, et parce qu'en Australie, en Nouvelle-Zélande et au Royaume-Uni, une « lolly » est un bonbon.

**Tools** parce qu'un outil reste immobile tant que tu ne le prends pas en main. Il ne tourne pas quand tu ne t'en sers pas, et il ne t'observe pas quand tu t'en sers.

## Pourquoi tout est-il vert ?

lolly.tools s'ouvre sur [Lolly Demo](/info/lolly-demo.html), le design system d'exemple de Lolly, et sa couleur principale est le vert. C'est un exemple, pas une règle. Passe à **Lolly Starter**, un design system vierge, ou au tien dans [Settings → Design systems](/#/settings?focus=design-systems-section).

## Puis-je utiliser ma propre marque ?

Oui. **Design System Setup** (`#/start`) construit un design system à partir d'une couleur, d'un fichier de design tokens ou d'un design terminé, et chaque outil dessine alors avec ton design system. [Start](/info/quickstart.html#put-your-brand-in) détaille les trois voies.

Un design system que fournit ton organisation ou ta version est géré : il affiche un cadenas et reste en lecture seule, et tu peux en faire une copie modifiable pour le changer.

## Où est ce que j'ai fait hier ?

Si tu as appuyé sur **Save as** ou **Save**, il est dans **Projects**, sur l'écran d'accueil, dans le navigateur ou l'application d'où tu as enregistré. Si tu as seulement appuyé sur **Download**, le fichier est là où ton navigateur ou ton système enregistre les téléchargements, et une copie se trouve généralement dans **Assets**. Les outils qui [enregistrent pendant que tu travailles](/info/find-your-work.html#which-tools-save-as-you-work) conservent aussi le travail non enregistré dans **Projects**. [Find and recover your work](/info/find-your-work.html) couvre tous les cas.

## J'ai fermé l'onglet. Mon travail a-t-il disparu ?

Le travail enregistré est toujours dans **Projets**. Le travail non enregistré a disparu, sauf dans les outils qui enregistrent au fil du travail, qui le gardent aussi dans **Projets**. La prochaine fois, appuie sur **Enregistrer sous** avant de partir. Voir [Si tu as fermé l'onglet ou quitté l'outil](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Puis-je partager mon travail sous forme de fichier plutôt que de lien ?

Oui. Quand un lien ne peut pas tout porter, comme tes propres photos ou un long texte, la boîte de dialogue Share dit ce qui manquerait et propose à la place un fichier **.lolly** : un seul fichier contenant le design, les images qu'il utilise et, si tu le choisis, l'outil lui-même.

Tu décides de ce qui voyage. Ton nom et tes informations n'y figurent que si ton profil l'autorise, et l'art sous licence est retenu sauf si tu choisis de l'inclure. Quiconque ouvre un fichier qui porte un outil doit dire s'il fait confiance à l'outil avant qu'il puisse s'exécuter. Voir [Sharing your work](/info/using.html#sharing-your-work).

## À quoi servent les informations de mon profil ?

Tes informations dans **Settings** préremplissent les outils qui les demandent, comme un nom sur un badge. Elles restent sur cet appareil. Si tu actives aussi l'option, les informations que tu choisis sont scellées dans ce que tu crées, et te désignent comme source. Rien n'est inclus à moins que tu choisisses d'inclure tes informations.

Le partage et Sync n'envoient que le contenu que tu choisis. Sur l'instance Lolly Work d'une organisation, les sessions partagées et le travail encadré vont aussi à ce serveur. Voir [Privacy](/info/privacy.html).

## Comment obtenir les applications mobile ou bureau ?

Télécharge-les depuis [Install Lolly](/info/install.html). La page liste chaque version pour macOS, Windows, Linux et Android, et montre comment vérifier le fichier que tu as téléchargé. L'iPhone et l'iPad obtiennent **Lolly Tools** sur l'App Store ; [la section iPhone et iPad](/info/install.html#iphone-and-ipad) contient le lien.

N'importe qui peut aussi construire et distribuer sa propre copie de l'application, avec les outils et réglages dont son public a besoin. Le [Build Guide](/info/build-guide.html) montre comment.

## Lolly dit qu'il requiert WebGPU. Que puis-je faire ?

L'application web dessine avec WebGPU, une fonction graphique des navigateurs actuels, et elle la vérifie avant d'ouvrir un outil. Essaie ceci dans l'ordre :

1. Mets ton navigateur à jour vers sa version actuelle.
2. Active l'accélération graphique ou matérielle dans les réglages du navigateur, puis redémarre-le.
3. Essaie un navigateur qui a été testé : [Supported environments](/info/supported-environments.html) les liste.
4. Sur un Mac, un iPhone ou un iPad, [installe plutôt l'application](/info/install.html).

## Lolly peut-il modifier et rendre mes fichiers Figma, Penpot, Illustrator ou InDesign ?

Oui. Ouvre **Design** et clique sur **Import a design** : il accepte un **.fig** Figma natif (Save local copy), un export **.penpot** de Penpot, un **.ai** ou **.pdf** Illustrator, un **.idml** InDesign (File → Export → InDesign Markup) ou **n'importe quel SVG**. Tu n'as besoin d'aucun compte, d'aucun plugin ni d'aucune licence d'application de design.

![Le canevas ouvert de Design - Importer un design se trouve dans le menu Lolly de la barre d'outils](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Les calques arrivent sous forme de blocs modifiables : le texte reste modifiable, les formes restent des formes et les images rejoignent ta propre bibliothèque. Enregistre-le, et **Share with rules** peut transformer la mise en page en outil que toute personne ayant Lolly peut remplir de nouveau. Voir [Import a design](/info/design-import.html).

## Deux personnes peuvent-elles travailler sur le même design sans internet ?

Oui. Une personne partage une invitation, sous forme de lien, de QR code ou de code court, et l'autre l'accepte. Les deux appareils détiennent alors la même session en direct, présence et anneaux de focus compris. Cela fonctionne sur tout réseau partagé, y compris un point d'accès de téléphone dans un sous-sol, parce qu'aucun serveur ne se trouve au milieu. Voir [Working together](/info/collaborate.html). Pour des collègues sur des réseaux différents, l'instance Lolly Work d'une organisation fournit des collabs de travail authentifiées.

## Que sont les feature flags ?

Les feature flags activent ou désactivent des parties de Lolly. En usage autonome, tu choisis tes réglages personnels. Une organisation qui utilise Lolly Work peut définir des valeurs par défaut ou masquer certains interrupteurs selon sa politique, et les contrôles gérés sont étiquetés. Voir [Use Lolly at your organisation](/info/organisation.html).

![Feature flags personnels dans l'application autonome ; la politique d'une organisation peut régir certains interrupteurs](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Qu'est-ce qui distingue les utilitaires des outils ?

Un utilitaire fait une tâche rapide sur un fichier que tu as déjà, comme compresser un PDF, convertir une photo ou retirer des données cachées, et beaucoup d'entre eux tournent sur ton appareil sans rien envoyer. Ils existent pour que les tâches que l'on confie d'habitude à un site web quelconque restent dans Lolly. Compresser un contrat, convertir des photos de vacances dont l'emplacement est encore inclus ou coller un jeton dans un formateur en ligne ne devrait pas revenir à confier le fichier à un site dont la conservation, la juridiction et le modèle économique sont inconnus. [Utilities](/info/utilities.html) les liste, et [The trade we never agreed to](/info/status-quo.html) raconte l'histoire derrière eux.

![La vue Utilities : Strip Hidden Data, Compress PDF, Convert Image et les autres tâches sur l'appareil, réunis au même endroit](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Notre organisation peut-elle utiliser le SSO, des projets partagés et des approbations ?

Oui, avec **Lolly Work**, le serveur d'organisation du même projet open source. Il tourne séparément et ajoute l'authentification unique via ton fournisseur d'identité, le provisionnement SCIM, les permissions par groupe, les projets et ressources partagés, les collabs de travail en direct, les approbations et les enregistrements d'audit. L'application de tous les jours fonctionne toujours seule.

[Use Lolly at your organisation](/info/organisation.html) couvre la connexion et la recherche du travail partagé, et [Deployment](/info/deployment.html#organisation-services-with-lolly-work) couvre la mise en place. Le contenu partagé et les enregistrements de l'organisation suivent les politiques de confidentialité et de conservation de cette instance.

## À quels obstacles s'attendre en adoptant Lolly ?

La plupart des changements concernent le côté production plutôt que la technologie. Une équipe qui veut un ensemble d'outils encadré a besoin de quelqu'un pour rédiger son design system et les premiers modèles, même si chacun peut commencer à créer ses propres outils dans Design dès le premier jour, sans git. Et les processus existants continuent de fonctionner même quand leur résultat est hors charte ; convertir bien un résultat visible, avant et après côte à côte, plaide donc plus vite qu'un plan.

[Adoption & Governance](/info/adoption-governance.html) couvre l'accueil par rôle, la mesure d'un pilote et à quoi peut ressembler un processus de gouvernance.

## Lolly a-t-il été "vibe coded" ?

Lolly a été développé avec du code assisté par IA, de la découverte assistée par IA et, par endroits, du contenu assisté par IA, en utilisant un mélange de modèles et de fournisseurs, dont ceux d'entreprises de pointe du cloud public. Un humain a créé l'architecture, sélectionné le code avec intention et dirigé artistiquement l'expérience.

Une alerte élevée ou critique dans les dépendances de Lolly bloque la CI. Une alerte qui ne peut pas encore être corrigée n'est mise de côté que comme exception approuvée avec une raison écrite. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) liste chaque exception en vigueur aujourd'hui, et les [notes de version](https://github.com/lolly-tools/lolly/releases) listent celles que porte chaque version. SECURITY.md indique aussi comment signaler une vulnérabilité.

Des contrôles du build rejettent aussi les formulations qui semblent produites par une machine dans les commentaires de code, l'application et ces docs, pour garder un texte simple pour tous les lecteurs. Un effet secondaire est qu'un détecteur peut avoir plus de mal à dire quel texte un modèle a écrit. Nous ne cherchions pas à provoquer cela.

Surtout, Lolly repose sur les épaules de décennies de travail open source d'experts du monde entier.

**Déclaration sur l'IA générative :**

- **Code écrit par des LLM :** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (cette liste peut s'allonger)
- **Découverte par des LLM :** Gemini 3.1, Fable, Codex Astra
- **Documentation :** Sonnet 5
- **Bibliothèques open source :** leurs auteurs respectifs, indiqués dans le SBOM, les commentaires et les en-têtes de fichiers

Cette liste n'inclut pas les modèles intégrés directement dans Lolly.

**Contributions humaines :**
- **Idéation, revue et retours :** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la communauté Penpot, Tim Hildred (liste non exhaustive)
- **Architecture, direction artistique & nettoyeur de bâclage :** Andy Fitzsimon

## Où sont passés les outils aux couleurs de SUSE ?

Ils vivent dans un dépôt séparé et privé. Un clone public ne récupère pas du tout le pack de marque SUSE, donc un build qui en part utilise le profil neutre `lolly-start`, sauf si tu en choisis un autre : les outils communautaires indépendants d'une marque plus une marque vierge que tu remplis avec la tienne. [lolly.tools](https://lolly.tools) est construit avec le profil `lolly-demo` et s'ouvre sur [Lolly Demo](/info/lolly-demo.html), le design system propre de Lolly. SUSE exploite sa propre instance pour protéger ses marques déposées.

## Quel parfum a ce logo Lolly ?

Certains disent citron vert, d'autres menthe et parfois pomme ; Lolly apporte le sucré, c'est toi qui fais le parfum !
