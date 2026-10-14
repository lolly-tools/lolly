# Lolly et Penpot

_Dernière vérification : 28 septembre 2026._

Lolly et Penpot proposent tous deux des outils de design open source, des design tokens partagés et la collaboration en direct. Lolly associe la création sur l'appareil à [lolly.work](https://lolly.work), son service d'organisation déployé séparément.

## Fondations de design communes

Les [design tokens de Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) utilisent le format DTCG, que Lolly lit également. Les couleurs, la typographie et d'autres valeurs de tokens peuvent être partagées entre les deux workflows. L'[Import a design](/info/design-import.html) de Lolly ouvre un export `.penpot` comme une mise en page modifiable.

Le plugin Lolly Export pour Penpot est maintenu par Lolly. Il utilise le moteur de Lolly pour des C2PA Content Credentials activés sur option, sur l'appareil. L'intégrité de la signature et la confiance dans le signataire sont deux choses distinctes : un vérificateur a besoin d'une identité à laquelle il fait confiance, comme décrit dans [Content Credentials Identity](/info/content-credentials-identity.html).

## Workflows de design et d'équipe

[Penpot](https://penpot.app/) offre le design d'interface, les composants, des mises en page flexibles, des prototypes interactifs et l'inspection pour les développeurs. Il propose des déploiements hébergés et auto-hébergés, avec des [options d'installation Docker et Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Le canevas Design de Lolly crée des assets modifiables et peut transformer une mise en page en [outil avec des règles](/info/create-a-tool.html). Le même outil effectue son rendu dans le navigateur, l'application de bureau ou la CLI et peut générer des variantes à partir de données. Pour le travail d'équipe, Lolly propose à la fois des [collabs privées](/info/collaborate.html) directes entre deux appareils et des collabs de travail via lolly.work, avec modifications partagées, curseurs et sessions d'équipe enregistrées.

## En quoi les déploiements diffèrent

Lolly autonome effectue le rendu et la signature sur l'appareil, sans compte ni serveur. lolly.work ajoute le SSO, le provisionnement SCIM, les catalogues et projets partagés, les rôles, les validations, les journaux d'audit et le rendu serveur. Les deux dépôts sont open source sous MPL-2.0 et peuvent être exploités par l'organisation. Le travail partagé utilise l'instance configurée ; la création locale reste disponible indépendamment.

Le choix dépend du travail à faire : le workflow de design d'interface et de prototypage de Penpot, la production d'assets répétable de Lolly, ou une combinaison fondée sur des tokens partagés et des designs importés. La collaboration de travail de Lolly s'exécute actuellement sur un seul nœud serveur, et son [état de déploiement](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) doit faire partie de l'évaluation d'une organisation.

Penpot est une marque de son propriétaire. Le plugin ci-dessus est celui de Lolly. Consulte [Comment Lolly se compare](/info/positioning.html) et la [vue d'ensemble de la solution combinée](/info/compare.html) pour la comparaison plus large.
