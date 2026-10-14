# Lolly et Canva

_Dernière vérification : 28 septembre 2026._

Lolly crée dans le navigateur des visuels, publications sociales, présentations et mises en page fidèles à la marque. Avec [lolly.work](https://lolly.work), il prend aussi en charge les projets partagés, la collaboration de travail en direct, les assets approuvés et les politiques d'organisation.

## Où ils se recoupent

Les deux permettent de partir d'un modèle et de produire un visuel fini sans être designer. Les deux prennent en charge les workflows d'équipe et les contrôles de marque : [Canva les regroupe dans ses offres business](https://www.canva.com/canva-business/) ; Lolly sépare les applications créatives du service d'organisation.

Lolly fonctionne en autonome sur ton appareil, sans compte. lolly.work ajoute le SSO, le provisionnement SCIM, les rôles, les catalogues partagés, les validations et les rapports d'usage quand ton organisation en a besoin. Il fait partie du projet Lolly, est déployé séparément et est open source sous MPL-2.0, comme Lolly lui-même.

## Modèles et travail d'équipe

Canva réunit en un seul service une grande bibliothèque de modèles et de contenus stock, des applications et des workflows d'équipe hébergés. Ce contenu prêt à l'emploi et cette expérience gérée peuvent être utiles pour choisir un point de départ. Consulte les [modèles de Canva](https://www.canva.com/templates/) et sa [place de marché d'applications](https://www.canva.com/apps/).

Les outils de Lolly encodent les modifications autorisées et peuvent être réutilisés dans le navigateur, l'application de bureau ou la CLI. Un design peut devenir un [outil avec des règles](/info/create-a-tool.html), et le même outil peut produire de nombreuses sorties à partir d'un tableau de valeurs. lolly.work gère l'accès, le travail partagé et les politiques autour de ces outils.

L'édition en direct est disponible à la fois via les [collabs privées](/info/collaborate.html), qui connectent deux appareils directement, et via les collabs de travail par l'instance lolly.work d'une organisation. Les collabs de travail incluent les modifications partagées, les curseurs et les sessions d'équipe enregistrées. Le déploiement serveur actuel utilise un seul nœud de collaboration ; son échelle et son historique d'exploitation diffèrent de ceux du service établi de Canva.

## Où vit le travail

Lolly autonome garde la création et l'export sur l'appareil et peut fonctionner hors ligne une fois ses ressources disponibles. La collaboration de travail, le stockage d'équipe et le rendu serveur utilisent les services configurés de l'organisation. Ce choix de déploiement est la différence : une organisation peut exploiter elle-même les deux parties de Lolly, sans coût de licence logicielle par utilisateur, tout en payant son propre hébergement et son administration.

Les Content Credentials sont facultatifs pour les exports pris en charge. lolly.work peut signer la sortie serveur avec une identité d'organisation configurée ; un vérificateur doit faire confiance à cette identité avant d'afficher le signataire comme fiable. Consulte [Content Credentials Identity](/info/content-credentials-identity.html) et la [vue d'ensemble de la solution combinée](/info/compare.html).

Canva est une marque de son propriétaire. Cette page décrit les points de recoupement entre les deux solutions et n'est pas affiliée à Canva.
