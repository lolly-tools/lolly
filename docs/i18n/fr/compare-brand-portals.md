# Lolly et les portails de marque

_Dernière vérification : 28 septembre 2026._

Lolly et [lolly.work](https://lolly.work) couvrent ensemble les workflows de création et de gouvernance pour lesquels les équipes utilisent des portails de marque : assets approuvés, modèles verrouillés, contrôle d'accès, validation et distribution. Compare cette solution combinée à Bynder, Frontify, Marq ou Brandfolder pour choisir comment les gens trouvent les assets de marque et en créent de nouveaux.

## Création et services d'organisation

Le moteur et les applications de Lolly produisent les fichiers. Les modèles, les design tokens et les entrées autorisées définissent ce que chacun peut modifier, et le rendu peut rester sur son appareil. Lolly autonome ne demande aucun compte.

lolly.work est le service d'organisation du même projet, maintenu dans un [dépôt séparé](https://github.com/lolly-tools/lolly-work) et déployé à côté de Lolly. Il ajoute l'identité, le stockage partagé, les politiques, les validations et les rapports. Les deux parties sont open source sous MPL-2.0. Cette séparation permet à un particulier d'utiliser Lolly indépendamment et à une organisation d'exploiter la solution combinée sur une infrastructure qu'elle contrôle.

## Ce que fournit la solution combinée

| Besoin | Lolly + lolly.work |
|---|---|
| Connexion et provisionnement | Authentification unique OIDC, plusieurs fournisseurs d'identité, provisionnement des utilisateurs SCIM 2.0 et appartenance aux groupes, et désactivation de compte qui révoque les sessions existantes. Un fournisseur d'identité SAML uniquement peut se connecter via un pont OIDC tel que Keycloak. |
| Modèles approuvés | Lolly définit les entrées modifiables du modèle ; lolly.work applique la visibilité par groupe et des politiques d'entrée qui verrouillent des valeurs, restreignent des choix ou masquent des contrôles. |
| Bibliothèque d'assets partagée | Téléversements appartenant à l'instance, collections, métadonnées personnalisées et catalogues à accès contrôlé, plus des connecteurs qui lisent les bibliothèques DAM et de stockage existantes. |
| Validation | Étapes de validation ordonnées, groupes de validateurs éligibles, règles de quorum et séparation des tâches ; la validation peut encadrer les soumissions au catalogue et la livraison vers les destinations de l'organisation. |
| Historique et disponibilité des assets | Versions et retour arrière pour les assets appartenant à l'instance, rétention et blocages juridiques, disponibilité planifiée, expiration et révocation. Les fournisseurs connectés conservent leur propre historique source. |
| Rapports | Compteurs d'utilisation et de téléchargement des assets, activité des outils et des exports, tableaux de bord et piste d'audit. L'attribution d'usage suit la politique de télémétrie du déploiement ; le réglage d'attribution par défaut exige un consentement. |
| Distribution | Liens expirants et révocables, collections partagées, accès invité et livraison vers des destinations d'organisation configurées. |

Les [guides opérateur de lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) décrivent ces fonctionnalités et leur configuration. Ce sont des capacités disponibles, et non des fonctionnalités qui exigent de construire un autre système autour de Lolly.

## Choisir un workflow de portail

Les portails établis proposent un hébergement géré, du support et de nombreux workflows DAM. Par exemple, le [DAM d'entreprise de Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combine découverte des assets, contrôles d'accès, workflows de validation et distribution. Compare le workflow exact de validation et de droits dont tu as besoin : Lolly fournit des contrôles de métadonnées, d'accès et de disponibilité, tandis que la validation juridique et les obligations de licence relèvent toujours du processus d'une organisation. Ses chaînes de validation sont séquentielles ; elles ne modélisent pas de workflows à ramification arbitraire.

La pile Lolly est plus jeune, et la [page d'état de lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) consigne ses limites de déploiement. En particulier, le site public lolly.work est un bac à sable d'évaluation. Un déploiement durable en organisation demande un stockage persistant et un opérateur. L'auto-hébergement n'entraîne aucun coût de licence logicielle par utilisateur ; l'infrastructure et l'administration coûtent tout de même de l'argent.

Un DAM existant peut aussi rester la source de référence. Les connecteurs de catalogue de lolly.work rendent ses assets approuvés disponibles dans Lolly, où les gens créent de nouveaux fichiers selon les règles de l'organisation. C'est un choix d'intégration ; la bibliothèque et les validations propres à Lolly sont disponibles quand l'organisation veut gérer elle-même ces workflows.

Consulte [Comment Lolly se compare](/info/positioning.html) pour la comparaison des capacités et [Lolly comparé, outil par outil](/info/compare.html) pour le reste de cet ensemble. Les noms de fournisseurs identifient les produits comparés ; Lolly n'est pas affilié à ces derniers.
