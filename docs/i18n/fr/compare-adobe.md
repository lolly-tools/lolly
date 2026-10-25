# Lolly et Adobe

_Dernière vérification : 28 septembre 2026._

Si tu utilises Photoshop, Illustrator ou InDesign pour des fichiers du quotidien, cette page dit lesquelles de ces tâches Lolly peut reprendre et lesquelles restent chez Adobe.

## Ce qu'Adobe fait mieux

Les applications spécialisées d'Adobe couvrent un travail créatif approfondi. [Photoshop](https://www.adobe.com/products/photoshop.html), par exemple, offre une retouche photo détaillée, la sélection, le masquage et le compositing. Une retouche complexe et une ressource de marque récurrente n'ont pas les mêmes besoins : compare les opérations d'édition que ton travail exige avant de le déplacer.

## Où ils se recoupent

Les deux redimensionnent des images, composent des mises en page et exportent des formats professionnels. Lolly prend en charge PDF/X, CMJN et une sortie raster à forte profondeur de bits, avec des [capacités propres à chaque format](/info/formats.html), et ses utilitaires sur l'appareil convertissent et nettoient des fichiers sans les envoyer.

## Comment Lolly fait la tâche commune

Lolly autonome n'a besoin ni d'un compte Adobe ni d'un compte Lolly, et exécute le même moteur dans le navigateur, l'application de bureau et la CLI. Les modèles et les design tokens gardent chaque fichier cohérent, et [Share with rules](/info/create-a-tool.html) transforme un design en outil que d'autres remplissent.

Lolly signe les exports pris en charge avec des Content Credentials sur l'appareil, activés par défaut ; tu peux les désactiver. Une clé d'appareil prouve que le fichier n'a pas changé depuis sa signature. Une organisation peut utiliser sa propre autorité de certification, pour que ses vérificateurs fassent confiance au signataire ; [Content Credentials Identity](/info/content-credentials-identity.html) explique la différence. Les utilitaires de transformation sur l'appareil n'ajoutent ni filigrane Lolly ni Content Credentials.

## Avec une organisation

Lolly Work ajoute la connexion d'organisation, les ressources partagées, les approbations et la production serveur, avec une [signature serveur](/info/work-c2pa.html) sous un certificat d'organisation. [What runs where](/info/compare.html#what-runs-where) met les deux parties côte à côte.

Adobe, Photoshop et Creative Cloud sont des marques d'Adobe. Cette page décrit où les produits se recoupent et n'est pas affiliée à Adobe.
