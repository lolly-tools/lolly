# Lolly comparé, outil par outil

Si tu utilises déjà un autre produit, ces pages disent si Lolly le remplace, fonctionne à ses côtés ou ne convient pas à ton travail. Chacune commence par ce que l'autre produit fait mieux.

_Dernière vérification : 28 septembre 2026._

## Comparer par produit

- [Lolly et Canva](/info/compare-canva.html) - modèles, design du quotidien et production de marque partagée.
- [Lolly et Adobe](/info/compare-adobe.html) - édition, conversion, sortie professionnelle et Content Credentials.
- [Lolly et Figma](/info/compare-figma.html) - design, collaboration en direct et production réutilisable de ressources.
- [Lolly et Penpot](/info/compare-penpot.html) - design open source, tokens partagés et travail d'organisation.
- [Lolly et les portails de marque](/info/compare-brand-portals.html) - bibliothèques approuvées, modèles verrouillés, identité, revue et rapports.
- [Lolly et les API de rendu](/info/compare-render-apis.html) - génération automatisée sur ton appareil, en CI ou sur un serveur Lolly Work.
- [Lolly et les convertisseurs de fichiers en ligne](/info/compare-converters.html) - conversion de format sur ton propre appareil.

Pour la vue capacité par capacité, consulte [Comment Lolly se compare](/info/positioning.html). Chaque comparaison est datée ; une affirmation qui ne correspond plus à l'un des deux produits doit être corrigée.

## Ce qui tourne où

Chaque comparaison couvre deux parties d'un même projet open source. **Lolly** est le moteur, les applications et les outils. **Lolly Work** est le serveur d'organisation, maintenu dans le [dépôt lolly-work](https://github.com/lolly-tools/lolly-work). Les deux sont sous MPL-2.0, et une organisation décide quels services Lolly Work activer.

::: cols
## Sur ton appareil : Lolly

- Aucun compte pour l'usage autonome
- Créer, modifier, convertir et exporter
- Fonctionne hors ligne une fois les outils et ressources nécessaires enregistrés
- Content Credentials signés sur l'appareil
- Collabs privées entre deux appareils, sans serveur

## Sur le serveur de ton organisation : Lolly Work

- Authentification unique, provisionnement SCIM, rôles et politiques
- Catalogues partagés, projets d'équipe et collabs de travail
- Approbations, rapports d'usage et enregistrements d'audit
- Rendu serveur, tâches récupérables et livraison approuvée
- Signature serveur avec l'identité de l'organisation
:::

L'usage autonome garde les fichiers sur l'appareil. Choisir des projets partagés, une collab de travail, un rendu serveur ou une livraison envoie les données dont cette fonction a besoin au serveur de ton organisation.

## Ce que chaque comparaison suppose

Ces limites s'appliquent à chaque page de cet ensemble, donc elles sont énoncées une fois ici :

- **Les collabs de travail tournent aujourd'hui sur un seul nœud serveur.** Leur échelle et leur historique d'exploitation diffèrent de ceux des produits hébergés établis de longue date. [Work status and roadmap](/info/work-status.html) consigne les limites actuelles.
- **Le site [lolly.work](https://lolly.work) est un bac à sable de démonstration.** Un déploiement d'organisation durable demande un stockage persistant et un opérateur ; [Install Lolly Work](/info/work-install.html) couvre les deux.
- **Il n'y a pas de frais de licence logicielle par poste** pour Lolly ni pour un Lolly Work auto-hébergé. L'hébergement, le stockage et l'exploitation coûtent quand même de l'argent.
- **Une signature n'est pas un signataire de confiance.** Un vérificateur doit faire confiance au certificat qui a signé un fichier avant de montrer le signataire comme fiable ; [Content Credentials Identity](/info/content-credentials-identity.html) explique comment.
