# Lolly et Figma

_Dernière vérification : 28 septembre 2026._

Lolly prend en charge le design, l'édition en direct et la production d'assets réutilisables. [lolly.work](https://lolly.work) ajoute autour de ce travail les services d'organisation : identité, projets partagés, contrôles d'accès et validations.

## Où ils se recoupent

Les deux permettent de disposer texte, formes et images sur un canevas et de travailler avec d'autres personnes. L'[Import a design](/info/design-import.html) de Lolly lit les fichiers Figma comme des mises en page modifiables. Figma couvre aussi la production de marque à partir de modèles : [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) crée des assets à partir de modèles et les remplit depuis des fichiers CSV ou XLSX.

Lolly transforme un design en [outil réutilisable avec des règles](/info/create-a-tool.html). Cet outil s'exécute dans le navigateur ou la CLI et accepte des entrées depuis une URL, un script ou la grille de lot. Le même modèle sert aussi bien à une personne qui modifie un asset qu'à une équipe qui produit de nombreuses variantes.

## Collaboration et design produit

[Figma Design](https://www.figma.com/design/) réunit design d'interface, composants, prototypes interactifs et transfert aux développeurs. Son workflow de design produit établi et son écosystème comptent lorsqu'une équipe doit concevoir et spécifier une application complète.

Lolly propose deux types de collaboration en direct. Une [collab privée](/info/collaborate.html) relie directement deux appareils, sans compte et sans internet sur un réseau partagé. Une collab de travail utilise lolly.work pour l'accès authentifié, les modifications partagées, les curseurs en direct et les sessions d'équipe enregistrées. La collaboration de travail est implémentée à la fois dans le client Lolly et dans le serveur lolly.work ; son déploiement actuel à nœud unique n'établit pas de parité avec l'échelle d'exploitation de Figma.

## Déploiement et production

Les applications créatives de Lolly et lolly.work sont des parties déployées séparément du même projet open source. Lolly autonome peut effectuer des rendus hors ligne sans compte. lolly.work fournit le SSO, SCIM, les catalogues partagés, les permissions de projet, les validations, les journaux d'audit et le rendu serveur sur une infrastructure que l'organisation contrôle.

Les sessions d'équipe et les modifications de collab de travail atteignent cette instance ; les rendus locaux peuvent rester sur l'appareil. Les Content Credentials sont facultatifs pour les exports pris en charge, et la signature côté serveur utilise une identité d'organisation configurée. Consulte la [vue d'ensemble de la solution combinée](/info/compare.html) pour la séparation et [Content Credentials Identity](/info/content-credentials-identity.html) pour savoir comment un vérificateur fait confiance au signataire.

Figma est une marque de son propriétaire. Cette page décrit les points de recoupement entre les deux solutions et n'est pas affiliée à Figma.
