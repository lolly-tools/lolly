# Questions & réponses

Questions fréquentes, affichées sous forme d'accordéon sur `/info/start/faq.html`.

**Mise à jour :** chaque titre `##` ci-dessous est une question. Tout ce qui se trouve sous ce titre,
jusqu'au prochain `##`, est la réponse. Les réponses utilisent le markdown léger du site :
sépare les paragraphes par une ligne vide. Ajoute, supprime ou réordonne les questions ici et
relance `pnpm run build:info` (ou `pnpm run dev:web`).
Le build ignore tout ce qui précède le premier `##` (ce titre et ces notes).

L'ordre est celui d'une première découverte : le piège d'abord, puis tes fichiers, puis comment obtenir
et lancer Lolly, puis les organisations, puis comment il a été créé. L'ancre de chaque question
est construite à partir de la question anglaise à la même position, donc une traduction garde
l'ordre anglais.

## Pourquoi est-ce gratuit ? Où est le piège ?

**Nous avons créé Lolly pour nous-mêmes.** SUSE avait besoin de milliers de fichiers conformes à sa marque, créés sans rien confier à des services externes. Nous avons donc construit un outil qui fait tout sur l'appareil et l'avons publié en open source, comme tout ce que nous créons. Nous continuons à le maintenir parce que nous l'utilisons chaque jour. **Il n'y a aucune obligation :** tout fonctionne ici avec ou sans nous.

Cette limite est inscrite dans la licence, pas dans une promesse : tout ce qui fonctionne localement est gratuit, pour toujours. La licence d'une version publiée garantit qu'elle ne peut pas être retirée. Aucun accord de contribution ne pourrait changer la licence du travail de quiconque.

## Qu'est-ce que SUSE garde privé ? (autrement dit, quand le piège se refermera-t-il ?)

Le moteur, les enveloppes applicatives, les schémas et les outils indépendants de toute marque sont open source. Les marques déposées de SUSE et ses outils de marque restent privés et sont déjà séparés du reste. L'instance publique sur [lolly.tools](https://lolly.tools) utilise [Lolly Demo](/info/lolly-demo.html), le design system propre à Lolly.

Rien ici ne repose sur une promesse : chaque version publiée reste open source. Quand une autre entreprise a fermé les sources de son Linux d'entreprise en 2023, SUSE a cofondé [OpenELA](https://openela.org) pour garder ce code ouvert. Ce projet hérite de cette position.

SUSE développe *bien* des outils internes pour connecter Lolly à ses propres systèmes informatiques. C'est la configuration interne de SUSE, pas une séparation entre développement public et privé. Lolly vise aussi à être compilé via [Open Build Service](https://openbuildservice.org/), avec des artefacts issus d'une chaîne d'approvisionnement sécurisée, livrés par la [SUSE Application Collection](https://apps.rancher.io/applications).

## Pourquoi le nom « Lolly Tools » ?

**Lolly** parce que la liberté a un goût sucré, et parce qu'en Australie, en Nouvelle-Zélande et en Grande-Bretagne, une lolly est une friandise.

**Tools** parce qu'un outil reste immobile tant que tu ne le prends pas. Il ne fonctionne pas quand tu ne l'utilises pas, et il ne te surveille pas quand tu t'en sers.

## Pourquoi tout est vert ?

lolly.tools s'ouvre dans [Lolly Demo](/info/lolly-demo.html), le design system d'exemple propre à Lolly, dont la couleur principale est le vert. Passe à **Lolly Starter**, un design system vierge, ou au tien dans [Settings → Design systems](/#/settings?focus=design-systems-section).

## Puis-je utiliser ma propre marque ?

Oui. **Lolly Design System Setup** (`#/start`) construit un design system à partir d'une couleur, d'un fichier de tokens de design ou d'un design terminé. Chaque outil dessine ensuite avec ton design system. [Démarrer](/info/quickstart.html#put-your-brand-in) présente les trois parcours.

Un design system fourni par ton organisation ou ta version de l'application est géré. Il affiche un cadenas et reste en lecture seule. Pour le modifier, fais-en une copie modifiable.

## Où est ce que j'ai créé hier ?

Si tu as appuyé sur **Save as** ou **Save**, ton travail se trouve dans **Projects** sur l'écran d'accueil, dans le navigateur ou l'application où tu l'as enregistré. Si tu as seulement appuyé sur **Download**, le fichier se trouve dans les téléchargements de ton navigateur ou de ton système, et une copie est généralement dans **Assets**. Les outils qui [enregistrent pendant que tu travailles](/info/find-your-work.html#which-tools-save-as-you-work) gardent aussi le travail non enregistré dans **Projects**. [Retrouver et récupérer ton travail](/info/find-your-work.html) couvre tous les cas.

## J'ai fermé l'onglet. Mon travail est-il perdu ?

Le travail enregistré est toujours dans **Projects**. Le travail non enregistré est perdu, sauf dans les outils qui enregistrent pendant que tu travailles, qui le gardent aussi dans **Projects**. La prochaine fois, appuie sur **Save as** avant de partir. Voir [Si tu as fermé l'onglet ou quitté l'outil](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Puis-je partager mon travail sous forme de fichier plutôt que de lien ?

Oui. Quand un lien ne peut pas tout contenir, comme tes propres photos ou un texte long, la boîte de dialogue Share indique ce qui manquerait et propose un fichier **.lolly**. Ce seul fichier contient le design, les images qu'il utilise et, si tu le choisis, l'outil.

Tu décides de ce qui voyage. Ton nom et tes informations ne sont inclus que si tu l'autorises dans ton profil. Les illustrations sous licence sont exclues sauf si tu choisis de les inclure. Quiconque ouvre un fichier contenant un outil doit indiquer s'il fait confiance à cet outil avant qu'il puisse s'exécuter. Voir [Partager ton travail](/info/using.html#sharing-your-work).

## À quoi servent les informations de mon profil ?

Tes informations dans **Settings** préremplissent les outils qui les demandent, comme un nom sur un badge. Elles restent sur cet appareil. Rien n'entre dans ce que tu crées sans ton accord explicite. Les informations que tu choisis sont alors scellées dans le résultat et te désignent comme source.

Le partage et Sync envoient uniquement le contenu que tu choisis. Sur l'instance Lolly Work d'une organisation, les sessions partagées et le travail soumis à sa gouvernance vont aussi sur ce serveur. Voir [Confidentialité](/info/privacy.html).

## Comment obtenir les applications mobiles ou de bureau ?

Télécharge-les depuis [Installer Lolly](/info/install.html). La page liste toutes les versions pour macOS, Windows, Linux et Android, et montre comment vérifier le fichier téléchargé. Sur iPhone et iPad, **Lolly Tools** se télécharge depuis l'App Store. [La section iPhone et iPad](/info/install.html#iphone-and-ipad) contient le lien.

Chacun peut aussi compiler et distribuer sa propre copie de l'application, avec les outils et réglages dont son public a besoin. Le [Guide de compilation](/info/build-guide.html) montre comment faire.

## Lolly dit qu'il nécessite WebGPU. Que puis-je faire ?

L'application web dessine avec WebGPU, une fonction graphique des navigateurs actuels, et vérifie sa présence avant d'ouvrir un outil. Essaie ces étapes dans l'ordre :

1. Mets ton navigateur à jour vers sa version actuelle.
2. Active l'accélération graphique ou matérielle dans les réglages du navigateur, puis redémarre-le.
3. Essaie un navigateur testé : [Environnements pris en charge](/info/supported-environments.html) les liste.
4. Sur un Mac, iPhone ou iPad, [installe plutôt l'application](/info/install.html).

## Lolly peut-il modifier et rendre mes fichiers Figma, Penpot, Illustrator ou InDesign ?

Oui. Ouvre l'outil **Design** et clique sur **Import a design** : il accepte un fichier Figma natif **.fig** (Save local copy), un export Penpot **.penpot**, un fichier Illustrator **.ai** ou **.pdf**, un fichier InDesign **.idml** ou **.indd**, un document Affinity, un fichier Photoshop **.psd**, PowerPoint **.pptx**, CAD **.dxf** ou **tout SVG** ([tous les formats qu'il lit](/info/design-import.html#what-comes-in-from-each-app)). Tu n'as besoin d'aucun compte, plugin ou licence d'application de design.

![Le canevas libre de Lolly Design - Import a design se trouve dans le menu Lolly de la barre d'outils](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Les calques arrivent comme des blocs modifiables. Le texte reste modifiable, les formes restent des formes et les images rejoignent ta bibliothèque. Une fois la mise en page enregistrée, **Share with rules** peut la transformer en outil que toute personne ayant Lolly peut remplir à nouveau. Voir [Importer un design](/info/design-import.html).

## Deux personnes peuvent-elles travailler sur le même design sans internet ?

Oui. Une personne partage une invitation (un lien, un code QR ou un code court) et l'autre l'accepte. Les deux appareils partagent alors la même session en direct, avec des indicateurs de présence et des anneaux de focus. Cela fonctionne sur tout réseau commun, y compris le point d'accès d'un téléphone, car aucun serveur ne sert d'intermédiaire. Voir [Travailler ensemble](/info/collaborate.html). Pour des collègues sur des réseaux différents, l'instance Lolly Work d'une organisation propose des collaborations de travail authentifiées.

## Que sont les options de fonctionnalité ?

Les options de fonctionnalité activent ou désactivent certaines parties de Lolly. En utilisation autonome, tu choisis tes réglages personnels. Une organisation utilisant Lolly Work peut définir des valeurs par défaut ou masquer certains interrupteurs selon sa politique, et les contrôles gérés sont signalés. Voir [Utiliser Lolly dans ton organisation](/info/organisation.html).

![Options de fonctionnalité personnelles dans l'application autonome ; la politique de l'organisation peut régir certains interrupteurs](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Qu'est-ce qui distingue les utilitaires des outils ?

Un utilitaire accomplit une tâche rapide sur un fichier que tu as déjà, comme compresser un PDF, convertir une photo ou retirer des données cachées. Beaucoup fonctionnent sur ton appareil sans rien envoyer. Les utilitaires gardent dans Lolly les tâches qu'on confie habituellement à un site web quelconque. Compresser un contrat, convertir des photos de vacances qui contiennent encore leur localisation ou coller un jeton dans un formateur en ligne ne devrait pas signifier confier le fichier à un site dont on ignore la durée de conservation, la juridiction et le modèle économique. [Lolly Utilities](/info/utilities.html) les liste, et [Le marché que nous n'avons jamais accepté](/info/status-quo.html) raconte leur raison d'être.

![La vue Utilities : Lolly Strip Hidden Data, Compress PDF, Convert Image et les autres tâches exécutées sur l'appareil, toutes au même endroit](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Notre organisation peut-elle utiliser le SSO, des projets partagés et des approbations ?

Oui, avec **Lolly Work**, le serveur d'organisation du même projet open source. Il fonctionne séparément et ajoute l'authentification unique via ton fournisseur d'identité, le provisionnement SCIM, les permissions de groupe, les projets et ressources partagés, les collaborations de travail en direct, les approbations et les enregistrements d'audit. L'application du quotidien fonctionne toujours seule.

[Utiliser Lolly dans ton organisation](/info/organisation.html) explique comment se connecter et retrouver le travail partagé. [Déploiement](/info/deployment.html#organisation-services-with-lolly-work) couvre la mise en place de Lolly Work. Le contenu partagé et les enregistrements de l'organisation suivent les politiques de confidentialité et de conservation de cette instance.

## Quels obstacles pourrais-je rencontrer en adoptant Lolly ?

Surtout des changements dans la façon dont une équipe produit son travail, pas dans la technologie. Une équipe qui veut un ensemble d'outils encadré a besoin de quelqu'un pour créer son design system et ses premiers modèles. Chacun peut toujours créer ses propres outils dans Lolly Design dès le premier jour, sans git. Les processus existants continuent de fonctionner même quand leur résultat n'est pas conforme à la marque. Bien convertir un résultat visible, avec l'avant et l'après côte à côte, convainc plus vite qu'un plan.

[Adoption & gouvernance](/info/adoption-governance.html) couvre la prise en main par rôle, la mesure d'un pilote et ce à quoi peut ressembler un processus de gouvernance.

## Lolly a-t-il été créé par « vibe coding » ?

Lolly a été développé avec du code assisté par l'IA, de la recherche assistée par l'IA et, à de nombreux endroits, du contenu assisté par l'IA, en utilisant plusieurs modèles et fournisseurs, dont ceux d'entreprises de pointe du cloud public. Un humain a créé l'architecture, sélectionné le code avec intention et assuré la direction artistique de l'expérience.

Un avis de sécurité de gravité élevée ou critique dans les dépendances de Lolly bloque la CI. Un avis qui ne peut pas encore être corrigé n'est écarté qu'en tant qu'exception approuvée avec une justification écrite. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) liste chaque exception en vigueur, et les [notes de version](https://github.com/lolly-tools/lolly/releases) listent celles que chaque version contient. SECURITY.md indique aussi comment signaler une vulnérabilité.

Les vérifications du build rejettent aussi les formulations qui semblent écrites par une machine dans les commentaires du code, l'application et cette documentation, pour que le texte reste simple pour chaque lecteur. Cela peut avoir pour effet secondaire de rendre plus difficile, pour un détecteur, l'identification du texte écrit par un modèle. Ce n'était pas notre intention.

Surtout, Lolly s'appuie sur des décennies de travail open source réalisé par des experts du monde entier.

**Déclaration d'utilisation de l'IA générative :**

- **Code écrit par des LLM :** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (cette liste peut s'allonger)
- **Recherche avec des LLM :** Gemini 3.1, Fable, Codex Astra
- **Documentation :** Sonnet 5
- **Bibliothèques open source :** leurs auteurs respectifs, indiqués dans le SBOM, les commentaires et les en-têtes de fichiers

Cette liste n'inclut pas les modèles intégrés à Lolly.

**Contributions humaines :**
- **Idées, relecture et retours :** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la communauté Penpot, Tim Hildred (liste non exhaustive)
- **Architecture, direction artistique & nettoyage du contenu médiocre :** Andy Fitzsimon

## Où sont passés les outils aux couleurs de SUSE ?

Ils se trouvent dans un dépôt privé distinct. Un clonage public ne récupère pas le pack de marque SUSE, donc une compilation à partir de celui-ci utilise le profil neutre `lolly-start`, sauf si tu en choisis un autre. Ce profil contient les outils communautaires indépendants de toute marque et une marque vierge à personnaliser. [lolly.tools](https://lolly.tools) est compilé avec le profil `lolly-demo` et s'ouvre dans [Lolly Demo](/info/lolly-demo.html), le design system propre à Lolly. SUSE exploite sa propre instance pour protéger ses marques.

## Quel parfum a le logo de Lolly ?

Certains disent citron vert, d'autres menthe et parfois pomme. Lolly apporte la douceur, et tu choisis le parfum.

## Qu'entend Lolly par souveraineté des contenus ?

Le contrôle de la création, de la gouvernance, du stockage et du déplacement de tes contenus entre les systèmes de ton choix. Lolly permet la production locale, le travail modifiable et les outils portables. Lolly Work ajoute des services partagés contrôlés par l'organisation. Les licences des sources, les dépendances disponibles et les flux de données du processus restent à prendre en compte. [Qu'est-ce que la souveraineté des contenus ?](/info/content-sovereignty.html) explique chaque contrôle et ses limites.

## Peut-on garder notre DAM actuel ?

Oui. Un DAM pris en charge peut rester la source de référence pendant que Lolly Work relie les ressources sélectionnées aux outils Lolly. L'accès aux sources, les modifications autorisées, les droits d'utilisation et l'approbation du résultat final sont des décisions distinctes. [Utiliser Lolly avec ton DAM actuel](/info/use-with-dam.html) explique ce fonctionnement, et [l'expérience de SUSE avec Brandfolder](/info/suse-brandfolder.html) décrit son utilisation réussie pendant l'adoption.
