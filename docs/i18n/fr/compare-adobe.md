# Lolly et Adobe

_Dernière vérification : 28 septembre 2026._

Lolly gère l'édition et la conversion d'images, la mise en page, la production de marque répétable, la sortie print et les Content Credentials. [lolly.work](https://lolly.work) ajoute à ce workflow créatif l'identité d'organisation, les assets partagés, les validations et la production serveur automatisée.

## Où ils se recoupent

Les deux prennent en charge des tâches comme redimensionner des images, composer des mises en page et exporter des formats professionnels. Lolly prend en charge PDF/X, CMYK et la sortie raster à haute profondeur de bits, avec des [capacités propres à chaque format](/info/formats.html). Ses utilitaires sur l'appareil convertissent et nettoient les fichiers sans les téléverser.

Les applications spécialisées d'Adobe couvrent de nombreux workflows créatifs. [Photoshop](https://www.adobe.com/products/photoshop.html), par exemple, offre des outils détaillés de retouche photo, de sélection, de masquage et de compositing. Compare les opérations d'édition dont ton travail a besoin avec les outils de Lolly ; un asset de marque récurrent et une retouche complexe peuvent avoir des exigences différentes.

## Création et services d'organisation

Lolly autonome fonctionne sans compte Adobe ni compte Lolly, avec le même moteur dans le navigateur, l'application de bureau et la CLI. Les modèles et les design tokens rendent les sorties répétables, et [Share with rules](/info/create-a-tool.html) transforme un design en outil que d'autres personnes peuvent remplir.

lolly.work est un service distinct au sein du projet Lolly, open source sous MPL-2.0 comme les applications créatives. Il fournit le SSO, SCIM, les catalogues et projets partagés, les validations, les politiques d'accès, les journaux d'audit et le rendu serveur. Une organisation peut exécuter elle-même les deux parties et connecter ses bibliothèques d'assets existantes. La création locale reste sur l'appareil ; le travail partagé et les tâches serveur utilisent les services configurés.

## Content Credentials et identité

Lolly peut signer les exports pris en charge sur l'appareil, avec les Content Credentials activés par l'utilisateur. Une clé générée sur l'appareil prouve l'intégrité de la signature du fichier ; un vérificateur doit encore faire confiance au signataire avant d'afficher une identité vérifiée. Une organisation peut utiliser sa propre autorité de certification et distribuer sa racine à ses vérificateurs. lolly.work prend aussi en charge la signature côté serveur avec un certificat et une clé d'organisation configurés.

Cela rend disponibles, au sein de la solution Lolly, la signature personnelle comme la signature d'organisation. Consulte [Content Credentials Identity](/info/content-credentials-identity.html), le [guide de signature lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) et la [vue d'ensemble de la solution combinée](/info/compare.html). Les utilitaires de transformation sur l'appareil n'ajoutent ni filigrane Lolly ni métadonnées de provenance.

Adobe, Photoshop et Creative Cloud sont des marques d'Adobe. Cette page décrit les points de recoupement entre les solutions et n'est pas affiliée à Adobe.
