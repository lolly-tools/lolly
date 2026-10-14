# Lolly et les API de rendu

_Dernière vérification : 28 septembre 2026._

Lolly génère des assets à partir de modèles et de données sur ton appareil, en CI ou via l'API serveur de [lolly.work](https://lolly.work). La solution combinée couvre le rendu automatisé ainsi que l'identité, les politiques et la livraison qui entourent les tâches de production d'une organisation.

## Où ils se recoupent

[Bannerbear](https://www.bannerbear.com/) et [Placid](https://placid.app/) génèrent des images et d'autres médias à partir de modèles via des API et des intégrations. Lolly adopte la même approche, un modèle plus des entrées, avec le [mode URL](/info/url-mode.html), la [CLI](/info/cli.html), une grille de lot et des points d'accès serveur pour soumettre le travail.

## Ce que fournit lolly.work

lolly.work est le service d'organisation du projet Lolly, déployé séparément. Il exécute le moteur Lolly derrière une API, applique les politiques de visibilité des outils et d'entrée, et sert les fichiers rendus et les liens de partage signés. Son [service de rendu récupérable](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) prend en charge les tâches individuelles et les lots, la soumission idempotente, le statut, les nouvelles tentatives bornées, l'annulation et la conservation des sorties. Le travail interrompu peut reprendre après un redémarrage du serveur lorsqu'un stockage persistant est configuré.

Le serveur utilise un chemin de rendu SVG/PNG rapide et un worker Chromium facultatif pour les outils qui ont besoin d'un navigateur. L'automatisation s'authentifie avec des jetons de service, et la sortie terminée peut être envoyée par [livraison encadrée](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) vers des destinations de l'organisation. Une identité de signature configurée active la signature C2PA sur les sorties serveur prises en charge.

## Qui exploite le service

Bannerbear et Placid proposent le rendu sous forme de services gérés, avec leur propre infrastructure et leurs intégrations. Avec Lolly, un particulier peut effectuer le rendu en local ou une équipe peut exploiter lolly.work sur sa propre infrastructure. Les deux dépôts Lolly sont open source sous MPL-2.0 ; l'auto-hébergement n'entraîne aucun coût de licence logicielle par rendu, tandis que le calcul, le stockage et l'exploitation restent des coûts à prévoir.

Le site public lolly.work est un bac à sable d'évaluation, et non un engagement d'hébergement en production. Un service durable demande une base de données et un stockage de sorties persistants ; les outils dépendant du navigateur ont besoin du worker Chromium. Le [guide d'installation](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) et la [page d'état](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) décrivent ces exigences et les limites actuelles.

Le rendu local et en CI reste disponible sans le service d'organisation. Soumettre une tâche serveur envoie ses entrées et les assets nécessaires à cette instance ; c'est distinct du chemin sur l'appareil. Consulte la [vue d'ensemble de la solution combinée](/info/compare.html).

Bannerbear et Placid sont des marques de leurs propriétaires. Cette page décrit les points de recoupement entre les solutions et n'est affiliée à aucune des deux.
