# Lolly et les portails de marque

_Dernière vérification : 28 septembre 2026._

Si ton organisation garde ses ressources approuvées dans Bynder, Frontify, Marq ou Brandfolder, cette page compare cela à Lolly plus Lolly Work : comment les gens trouvent des ressources de marque, et comment ils créent de nouveaux fichiers à partir d'elles.

## Ce qu'un portail établi fait mieux

Les portails établis offrent un hébergement géré, du support et des flux de gestion de ressources étendus. Par exemple, le [DAM d'entreprise de Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combine la découverte de ressources, les contrôles d'accès, les flux d'approbation et la distribution. La pile Lolly est plus jeune et ses chaînes d'approbation sont séquentielles plutôt que des flux de travail à ramifications arbitraires. [Work status and roadmap](/info/work-status.html) consigne ses limites de déploiement.

## Où ils se recoupent

Les deux couvrent les ressources approuvées, les modèles verrouillés, le contrôle d'accès, la revue et la distribution. Lolly fabrique les fichiers : les modèles, les design tokens et les entrées autorisées définissent ce qu'une personne peut changer, et le rendu peut rester sur son appareil. Lolly Work ajoute l'identité, le stockage partagé, la politique, les approbations et les rapports sur une infrastructure que l'organisation contrôle.

![Le design system actif dans Settings, présenté sous forme de couverture et de pages : les couleurs, la typographie et les logos avec lesquels chaque outil dessine](/info/shots/dashboard-brand.svg)

## Ce que fournissent Lolly et Lolly Work

| Besoin | Lolly + Lolly Work |
|---|---|
| Connexion et provisionnement | Authentification unique OIDC, plusieurs fournisseurs d'identité, provisionnement d'utilisateurs SCIM 2.0 et appartenance aux groupes, et désactivation de compte qui révoque les sessions existantes. Un fournisseur d'identité uniquement SAML peut se connecter via un pont OIDC comme Keycloak. |
| Modèles approuvés | Lolly définit les entrées modifiables du modèle ; Lolly Work applique la visibilité par groupe et des politiques d'entrées qui verrouillent des valeurs, restreignent des choix ou masquent des contrôles. |
| Bibliothèque de ressources partagée | Envois détenus par l'instance, collections, métadonnées personnalisées et catalogues à accès contrôlé, plus des connecteurs qui lisent les bibliothèques DAM et de stockage existantes. |
| Revue | Étapes d'approbation ordonnées, groupes d'approbateurs éligibles, règles de quorum et séparation des tâches ; la revue peut régir les soumissions au catalogue et la livraison vers les cibles de l'organisation. |
| Historique et disponibilité des ressources | Versions et retour arrière pour les ressources détenues par l'instance, conservation et gels, disponibilité planifiée, expiration et révocation. Les fournisseurs connectés gardent leur propre historique source. |
| Licences et crédits | Lolly consigne la licence de chaque source qu'un fichier utilise et prépare les crédits dus ; [Creative rights and credits](/info/creative-rights.html) explique ce qu'il consigne et où les crédits sont écrits. Il ne valide pas les droits. |
| Rapports | Comptages d'utilisation et de téléchargement des ressources, activité des outils et des exports, tableaux de bord et piste d'audit. L'attribution d'usage suit la politique de télémétrie du déploiement ; le réglage d'attribution par défaut exige un consentement. |
| Distribution | Liens expirants et révocables, collections partagées, accès invité et livraison vers des destinations d'organisation configurées. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) et [Policy and governance](/info/work-governance.html) décrivent ces fonctions et leur configuration.

## Garder ton portail existant

Un DAM existant peut rester la source de vérité. Les connecteurs de catalogue de Lolly Work mettent ses ressources approuvées à disposition dans Lolly, où les gens créent de nouveaux fichiers selon les règles de l'organisation. C'est un choix d'intégration ; la bibliothèque et les approbations propres de Lolly sont là quand l'organisation veut les gérer elle-même. [What runs where](/info/compare.html#what-runs-where) liste les limites que partage chaque comparaison.

Voir [How Lolly compares](/info/positioning.html) pour la comparaison des capacités. Les noms de fournisseurs identifient les produits comparés ; Lolly n'est pas affilié à eux.
