# Lolly et les API de rendu

_Dernière vérification : 5 novembre 2026._

Si tu génères aujourd'hui des images à partir de modèles via une API, cette page dit ce qui change si tu fais tourner toi-même cette production : sur ton propre appareil, en CI ou sur un serveur que tu contrôles. [Move from a hosted render API](/info/work-move-from-render-api.html) explique comment faire.

## Ce que les API de rendu hébergées font mieux

[Bannerbear](https://www.bannerbear.com/) et [Placid](https://placid.app/) sont des services gérés, et c'est un vrai avantage. Tu envoies une requête et quelqu'un d'autre fait tourner les serveurs, les maintient et absorbe la charge.

- **Rien à exploiter.** Pas de serveur, de base de données, de stockage, de mises à jour ni de planification de capacité.
- **Un éditeur de modèles hébergé** avec des modèles prêts à adapter.
- **Plus de types de sortie depuis une seule API.** Les deux publient des points d'accès vidéo et PDF, et Bannerbear documente aussi la sortie animée, WebP et AVIF, les captures d'écran et la suppression d'arrière-plan par IA.
- **Leurs propres intégrations et leur support.**

Si c'est l'arrangement que tu veux, ces services sont un choix solide.

## Ce que l'auto-hébergement t'apporte

- **Ton contenu reste sur tes systèmes.** Les entrées, les ressources et les sorties vivent sur une infrastructure que tu as choisie. Faire le rendu sur un appareil ou en CI n'exige aucun service.
- **Les règles vivent dans l'outil.** Les couleurs, la typographie, les logos et les entrées verrouillées viennent de ton [design system](/info/brand-studio.html), donc un appelant ne peut changer que ce que tu autorises. [Lolly Work](/info/compare.html#what-runs-where) applique la visibilité des outils et des politiques d'entrées à chaque requête.
- **Le même outil partout.** Un outil se rend sur un portable, dans une tâche CI ou sur un serveur à partir des mêmes entrées, et les gens peuvent modifier le même outil dans l'application.
- **Des enregistrements que tu détiens.** Des [reçus de rendu](/info/work-renders.html#evidence-and-identity), une piste d'audit, et des Content Credentials là où tu configures une identité de signature.
- **Open source et sans compteur.** Tu fais tourner le code, et ce que tu paies, c'est ta propre infrastructure.

Tu prends en charge le travail que ces services font pour toi. Un serveur durable exige une base de données persistante et un stockage de sortie, et les outils qui ont besoin d'un navigateur exigent le worker Chromium. [Install Lolly Work](/info/work-install.html) décrit les deux.

## Comment les tâches se correspondent

| Tâche | API de rendu hébergée | Lolly |
|---|---|---|
| Remplir un modèle à partir de données | Requête API nommant un modèle et ses calques | [URL](/info/url-mode.html), [CLI](/info/cli.html) ou [API serveur](/info/work-automation-api.html) nommant un outil et ses entrées |
| Beaucoup de fichiers à partir d'un tableau | Lots et collections | [Batch](/info/batch.html) sur ton appareil, ou [lots de rendu](/info/work-renders.html#batches-with-durable-rows) sur un serveur |
| Attendre ou interroger un résultat | Interrogation, ou option synchrone | Rendus durables que tu interroges, ou rendu immédiat |
| Appeler un webhook à la fin | Oui | [Rappels signés](/info/work-renders.html) vers des origines que tu autorises |
| URL d'image dynamique | Oui | [Liens de partage et URL `/render`](/info/url-mode.html) |
| Modifier un modèle | Éditeur hébergé | [Design](/info/using.html), sur ton appareil |
| Agents | Les deux publient un serveur MCP | [MCP](/info/mcp.html), avec un point d'accès d'organisation sous la politique d'un token sur Lolly Work |

Les types de sortie propres à Lolly sont listés dans [Exporting](/info/exporting.html). Sur un serveur Work aujourd'hui, les rendus durables produisent du SVG, du PNG, du JPG et du PDF, et [la vidéo reste sur l'appareil, la CLI et MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Ce qui se transfère et ce qui ne se transfère pas

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Tes requêtes | L'API de migration de Work accepte la même forme | Pareil | Pareil |
| Tes modèles | **Importés** comme documents modifiables, sauf les types de calque sans schéma confirmé | Noms de champs et aperçu uniquement. Reconstruis chacun | Noms de champs et aperçu uniquement. Reconstruis chacun |
| URL dynamiques existantes | Non prises en charge | Non prises en charge | Les URL signées continuent de fonctionner après un changement d'hôte, avec ton ancien token privé |
| Webhooks | Les webhooks enregistrés ne sont pas pris en charge | `webhook_url` fonctionne | `webhook_success` fonctionne |
| Sortie WebP et AVIF | Refusée par son nom | Non proposée | WebP refusé par son nom |
| Animations, vidéos, collections, captures d'écran | Pas sur l'API de migration | Pas sur l'API de migration | Pas sur l'API de migration |

Tout cela a été construit à partir de la documentation publique de chaque éditeur et n'a pas été exécuté sur un compte réel. [Le guide de migration](/info/work-move-from-render-api.html#check-it-on-your-own-account) contient une courte liste de vérification si tu en as un.

Migrer n'est pas tout ou rien. Tu peux migrer un modèle et laisser les autres où ils sont, et [quitter Lolly](/info/work-move-from-render-api.html#leave-lolly-too) reste tout aussi ouvert : les outils sont de simples fichiers et la CLI les rend sans serveur.

## Qui exploite le service

Avec Lolly, une personne rend en local, ou une équipe fait tourner Lolly Work sur sa propre infrastructure. Soumettre une tâche serveur envoie ses entrées et les ressources nécessaires à cette instance, ce qui diffère du chemin sur l'appareil.

Bannerbear et Placid sont des marques de leurs propriétaires. Cette page décrit où les produits se recoupent, d'après leur documentation publique, et n'est pas affiliée à l'un ni à l'autre.
