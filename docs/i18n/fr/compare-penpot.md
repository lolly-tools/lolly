# Lolly et Penpot

_Dernière vérification : 28 septembre 2026._

Si ton équipe conçoit dans Penpot, Lolly travaille à ses côtés : les deux sont open source et lisent les mêmes design tokens. Cette page dit à quoi sert chacun.

## Ce que Penpot fait mieux

[Penpot](https://penpot.app/) offre le design d'interface, les composants, des mises en page flexibles, des prototypes interactifs et l'inspection pour les développeurs, avec édition en temps réel et curseurs en direct. Il propose des déploiements hébergés et auto-hébergés, avec des [options d'installation Docker et Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Pour concevoir une application, Penpot est l'outil.

## Où ils se recoupent

Les [design tokens de Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) utilisent le format DTCG, que Lolly lit aussi, donc couleurs, typographie et autres valeurs de tokens passent de l'un à l'autre. [Import a design](/info/design-import.html) de Lolly ouvre un export `.penpot` comme mise en page modifiable, et **Send to Penpot** dans Lolly renvoie un design sous forme d'archive `.penpot`. Lolly maintient aussi le [plugin Lolly Export pour Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), qui utilise le moteur de Lolly pour ajouter, sur l'appareil, des Content Credentials facultatifs.

## Comment Lolly fait la tâche commune

Le canevas Design de Lolly crée des ressources modifiables et peut transformer une mise en page en [outil avec des règles](/info/create-a-tool.html). Le même outil se rend dans le navigateur, l'application de bureau ou la CLI et produit des variantes à partir de données. Lolly autonome fait le rendu et signe sur l'appareil, sans compte ni serveur. Une [collab privée](/info/collaborate.html) relie directement deux appareils.

## Avec une organisation

Lolly Work ajoute l'authentification unique, le provisionnement SCIM, les catalogues et projets partagés, les rôles, les approbations, les enregistrements d'audit, les collabs de travail et le rendu serveur. Les deux dépôts sont sous MPL-2.0 et une organisation peut exploiter les deux. [What runs where](/info/compare.html#what-runs-where) met les deux parties côte à côte.

Tu peux utiliser les deux : Penpot pour le design d'interface et le prototypage, Lolly pour les fichiers répétables, reliés par des tokens partagés et des designs importés.

Penpot est une marque de son propriétaire. Cette page décrit où les deux produits se recoupent et n'est pas affiliée à Penpot.
