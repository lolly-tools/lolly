# Comparer Lolly, outil par outil

Ces pages indiquent si Lolly remplace un autre produit, fonctionne à ses côtés ou ne convient pas à ton travail. Chaque page commence par ce que l'autre produit fait mieux.

_Dernière vérification : 28 septembre 2026._

<!--i:eti-grid-->
## Comparer par produit

- [Lolly et Canva](/info/compare-canva.html) - modèles, design au quotidien et production de marque partagée.
- [Lolly et Adobe](/info/compare-adobe.html) - édition, conversion, fichiers professionnels et Content Credentials.
- [Lolly et Figma](/info/compare-figma.html) - design, collaboration en direct et production de ressources réutilisables.
- [Lolly et Penpot](/info/compare-penpot.html) - design open source, tokens partagés et travail en organisation.
- [Lolly et les portails de marque](/info/compare-brand-portals.html) - bibliothèques approuvées, modèles verrouillés, identité, révision et rapports.
- [Lolly et les API de rendu](/info/compare-render-apis.html) - génération automatisée sur ton appareil, en CI ou sur ton propre serveur, et [comment migrer](/info/work-move-from-render-api.html) depuis Bannerbear ou Placid.
- [Lolly et les convertisseurs de fichiers en ligne](/info/compare-converters.html) - conversion de formats sur ton propre appareil.

[Comment Lolly se compare](/info/positioning.html) présente la comparaison fonction par fonction. Chaque comparaison est datée. Une affirmation qui ne correspond plus à l'un ou l'autre produit doit être corrigée.

<!--i:eti-map-pin-->
## Ce qui tourne où

Chaque comparaison couvre deux parties d'un même projet open source. **Lolly** comprend le moteur, les applications et les outils. **Lolly Work** est le serveur de l'organisation, maintenu dans le [dépôt lolly-work](https://github.com/lolly-tools/lolly-work). Les deux sont sous MPL-2.0, et l'organisation décide quels services Lolly Work activer.

::: cols
## Sur ton appareil : Lolly

- Aucun compte pour une utilisation autonome
- Création, édition, conversion et export
- Fonctionne hors ligne une fois les outils et ressources nécessaires enregistrés
- Content Credentials signés sur l'appareil
- Collaborations privées entre deux appareils, sans serveur

## Sur le serveur de ton organisation : Lolly Work

- Authentification unique, provisionnement SCIM, rôles et politiques
- Catalogues partagés, projets d'équipe et collaborations de travail
- Approbations, rapports d'utilisation et enregistrements d'audit
- Rendu serveur, tâches récupérables et livraison approuvée
- Signature serveur avec l'identité de l'organisation
:::

L'utilisation autonome garde les fichiers sur l'appareil. Choisir des projets partagés, une collaboration de travail, un rendu serveur ou une livraison envoie les données nécessaires à cette fonction au serveur de ton organisation.

<!--i:eti-info-->
## Les hypothèses de chaque comparaison

Ces limites s'appliquent à chaque page de cet ensemble :

- **Les collaborations Lolly Work tournent aujourd'hui sur un seul nœud serveur.** Leur échelle et leur historique d'exploitation diffèrent de ceux des produits hébergés établis de longue date. [État et feuille de route de Lolly Work](/info/work-status.html) consigne les limites actuelles.
- **Le site [lolly.work](https://lolly.work) est un bac à sable de démonstration.** Un déploiement durable pour une organisation nécessite un stockage persistant et un opérateur. [Installer Lolly Work](/info/work-install.html) couvre les deux.
- **Il n'y a pas de frais de licence logicielle par utilisateur** pour Lolly ou un Lolly Work auto-hébergé. L'hébergement, le stockage et l'exploitation coûtent toujours de l'argent.
- **Une signature ne rend pas le signataire digne de confiance.** Un vérificateur n'affiche le signataire comme digne de confiance que s'il fait confiance au certificat qui a signé le fichier. [Identité Content Credentials](/info/content-credentials-identity.html) explique comment.
