# Lolly et les API de rendu

_Dernière vérification : 28 septembre 2026._

Si tu génères aujourd'hui des images à partir de modèles via une API, cette page dit comment Lolly fait la même tâche sur ton propre appareil, en CI ou sur ton propre serveur.

## Ce que les API de rendu hébergées font mieux

[Bannerbear](https://www.bannerbear.com/) et [Placid](https://placid.app/) proposent le rendu sous forme de services gérés, avec leur propre infrastructure, leurs intégrations et leur support. Tu envoies une requête et quelqu'un d'autre fait tourner les serveurs.

## Où ils se recoupent

Les deux transforment un modèle plus des entrées en média. Lolly prend ses entrées d'un [lien](/info/url-mode.html), de la [CLI](/info/cli.html), d'une grille de lot ou d'un point d'accès serveur.

## Comment Lolly fait la tâche commune

Le même outil se rend sur un portable, dans une tâche de CI ou sur un serveur, à partir des mêmes entrées. Le rendu local et en CI n'exige aucun service.

![Réglages d'export en lot : nom de fichier, format par défaut, unités, DPI et nombre de lignes à rendre](/info/shots/use-batch-toolbar.svg)

Sur un serveur, [Lolly Work](/info/compare.html#what-runs-where) exécute le moteur de Lolly derrière une API et applique la visibilité des outils et les politiques d'entrées. Son [service de rendu récupérable](/info/work-renders.html) prend en charge les tâches uniques et les lots, la soumission idempotente, le statut, les nouvelles tentatives bornées, l'annulation et les sorties conservées, et le travail interrompu reprend après un redémarrage quand un stockage persistant est configuré.

Le serveur a un chemin rapide SVG et PNG et un worker Chromium facultatif pour les outils qui ont besoin d'un navigateur. L'automatisation se connecte avec des jetons de service, la sortie terminée peut passer par une [livraison approuvée](/info/work-delivery.html) vers des destinations d'organisation, et une identité de signature configurée ajoute des Content Credentials à la sortie prise en charge.

## Qui exploite le service

Avec Lolly, une personne rend en local, ou une équipe fait tourner Lolly Work sur sa propre infrastructure. Soumettre une tâche serveur envoie ses entrées et les ressources nécessaires à cette instance, ce qui diffère du chemin sur l'appareil. Un service durable exige une base de données persistante et un stockage de sortie, et les outils qui dépendent d'un navigateur ont besoin du worker Chromium ; [Install Lolly Work](/info/work-install.html) décrit les deux.

Bannerbear et Placid sont des marques de leurs propriétaires. Cette page décrit où les produits se recoupent et n'est pas affiliée à l'un ni à l'autre.
