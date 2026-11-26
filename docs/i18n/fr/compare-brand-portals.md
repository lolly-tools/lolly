# Lolly et les portails de marque

_Positionnement mis à jour : 31 octobre 2026. Exemple de capacité fournisseur vérifié : 28 septembre 2026._

Si ton organisation conserve ses ressources approuvées dans Bynder, Frontify, Marq ou Brandfolder, cette page compare ce portail à Lolly avec Lolly Work. Elle couvre la façon dont les personnes trouvent les ressources de marque et créent de nouveaux fichiers à partir de celles-ci.

<!--i:eti-folder-shared-->
## Garder ton portail existant

Un DAM existant peut rester la source de référence. Les connecteurs de catalogue de Lolly Work rendent une partie sélectionnée de sa bibliothèque disponible dans Lolly, où les personnes créent de nouveaux fichiers selon les règles de l'organisation. Les contraintes de la source prises en charge par le DAM et les règles d'exposition de Lolly Work régissent l'accès. La révision du résultat final est une décision séparée.

[Utiliser Lolly avec ton DAM existant](/info/use-with-dam.html) explique les responsabilités et les limites. [L'expérience de SUSE avec Brandfolder](/info/suse-brandfolder.html) consigne une intégration réussie qui a aidé les administrateurs à gérer le changement avant une migration prévue.

Lolly vise la [souveraineté sur les contenus](/info/content-sovereignty.html), y compris le contrôle de la production et la liberté de choisir les systèmes. Sa propre bibliothèque et ses approbations servent les organisations qui choisissent de gérer elles-mêmes ces fonctions. [Lolly pour les fournisseurs de DAM et les partenaires d'implémentation](/info/dam-partners.html) décrit comment le flux de travail connecté peut apporter de la valeur à un système de référence existant.

<!--i:eti-award-->
## Ce qu'un portail établi fait mieux

Les portails établis proposent un hébergement géré, une assistance et des flux de gestion des ressources étendus. [Le DAM d'entreprise de Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combine la découverte de ressources, les contrôles d'accès, les flux d'approbation et la distribution. L'ensemble Lolly est plus jeune. Ses chaînes d'approbation sont séquentielles et ne peuvent pas se ramifier librement. [État et feuille de route de Lolly Work](/info/work-status.html) consigne ses limites de déploiement.

<!--i:eti-blend-->
## Leurs fonctions communes

Les deux couvrent les ressources approuvées, les modèles verrouillés, le contrôle d'accès, la révision et la distribution. Lolly crée les fichiers. Les modèles, les tokens de design et les entrées autorisées définissent ce qu'une personne peut changer, et le rendu peut rester sur son appareil. Lolly Work ajoute l'identité, le stockage partagé, les politiques, les approbations et les rapports sur une infrastructure que l'organisation contrôle.

![Le design system actif dans Settings, présenté comme une couverture et des pages : les couleurs, la typographie et les logos avec lesquels chaque outil dessine](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Ce que Lolly et Lolly Work proposent

| Besoin | Lolly + Lolly Work |
|---|---|
| Connexion et provisionnement | Authentification unique OIDC, plusieurs fournisseurs d'identité, provisionnement des utilisateurs et appartenance aux groupes via SCIM 2.0, et désactivation des comptes qui révoque les sessions existantes. Un fournisseur d'identité uniquement SAML peut se connecter via une passerelle OIDC comme Keycloak. |
| Modèles approuvés | Lolly définit les entrées modifiables du modèle ; Lolly Work applique la visibilité par groupe et des politiques d'entrée qui verrouillent les valeurs, restreignent les choix ou masquent les contrôles. |
| Bibliothèque de ressources partagée | Téléversements appartenant à l'instance, collections, métadonnées personnalisées et catalogues à accès contrôlé, ainsi que des connecteurs qui lisent les bibliothèques DAM et de stockage existantes. |
| Révision | Étapes d'approbation ordonnées, groupes d'approbateurs habilités, règles de quorum et séparation des tâches ; la révision peut régir les soumissions au catalogue et la livraison vers les destinations de l'organisation. |
| Historique et disponibilité des ressources | Versions et retour en arrière pour les ressources appartenant à l'instance, conservation et gels, disponibilité planifiée, expiration et révocation. Les fournisseurs connectés gardent leur propre historique de source. |
| Licences et crédits | Lolly enregistre la licence de chaque source qu'un fichier utilise et prépare les crédits dus ; [Droits et crédits des créations](/info/creative-rights.html) explique ce qu'il enregistre et où les crédits sont écrits. Il n'obtient pas les autorisations relatives aux droits. |
| Rapports | Comptages des utilisations et téléchargements de ressources, activité des outils et exports, tableaux de bord et piste d'audit. L'attribution des usages suit la politique de télémétrie du déploiement ; le réglage d'attribution par défaut exige le consentement. |
| Distribution | Liens révocables avec expiration, collections partagées, accès invité et livraison vers les destinations configurées de l'organisation. |
| Une page de marque publique | Lolly écrit une [page de marque](/info/brand-page.html) statique, depuis Lolly Design System Setup ou la ligne de commande : logos, couleurs, typographie, règles et exemples pour les personnes, avec des tokens, `DESIGN.md` et des skills pour les agents. Tu héberges le dossier, ou un administrateur active l'[hébergement de pages de marque](/info/work-design-system-administration.html#host-a-brand-page) dans Lolly Work, désactivé par défaut. |

[Catalogue et contenu](/info/work-catalog.html), [Approbations](/info/work-approvals.html) et [Politique et gouvernance](/info/work-governance.html) décrivent ces fonctions et leur configuration.

<!--i:eti-checklist-->
## Évaluer le flux de travail combiné

Utilise [la séquence de production d'une carte d'événement](/info/dam-production.html) pour tester l'accès aux sources, les modifications autorisées, la révision du résultat et la livraison avec ta propre bibliothèque. [Ce qui tourne où](/info/compare.html#what-runs-where) liste les limites communes à toutes les comparaisons. Une connexion à une source ne suffit pas à établir un partenariat avec un fournisseur ou une qualification pour chaque tenant.

[Comment Lolly se compare](/info/positioning.html) présente la comparaison des capacités. Les noms des fournisseurs identifient les produits comparés. Lolly ne leur est pas affilié.
