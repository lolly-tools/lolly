# Lolly et les API de rendu

_Dernière vérification : 5 novembre 2026._

Si tu génères des images à partir de modèles via une API, cette page indique ce qui change lorsque tu exécutes cette production sur ton propre appareil, en CI ou sur un serveur que tu contrôles. [Migrer depuis une API de rendu hébergée](/info/work-move-from-render-api.html) donne les étapes.

<!--i:eti-award-->
## Ce que les API de rendu hébergées font mieux

[Bannerbear](https://www.bannerbear.com/) et [Placid](https://placid.app/) sont des services gérés : tu envoies une requête et quelqu'un d'autre gère les serveurs.

- **Rien à exploiter.** Ni serveur, ni base de données, ni stockage, ni mises à jour, ni planification de capacité.
- **Un éditeur de modèles hébergé** avec des modèles prêts à adapter.
- **Plus de types de sortie depuis une seule API.** Les deux publient des points de terminaison vidéo et PDF, et Bannerbear documente aussi les sorties animées, WebP et AVIF, les captures d'écran et la suppression d'arrière-plan par IA.
- **Leurs propres intégrations et leur assistance.**

Si c'est le fonctionnement que tu souhaites, ces services sont un choix judicieux.

<!--i:eti-home-->
## Ce que l'auto-hébergement t'apporte

- **Ton contenu reste sur tes systèmes.** Les entrées, les ressources et les sorties résident sur l'infrastructure que tu as choisie. Le rendu sur un appareil ou en CI n'a besoin d'aucun service.
- **Les règles sont dans l'outil.** Les couleurs, la typographie, les logos et les entrées verrouillées viennent de ton [design system](/info/brand-studio.html), donc l'appelant ne peut changer que ce que tu autorises. [Lolly Work](/info/compare.html#what-runs-where) applique la visibilité des outils et les politiques d'entrée à chaque requête.
- **Le même outil partout.** Un outil effectue le rendu à partir des mêmes entrées sur un ordinateur portable, dans une tâche CI ou sur un serveur. Les personnes peuvent modifier le même outil dans l'application.
- **Des enregistrements que tu détiens.** Des [accusés de rendu](/info/work-renders.html#evidence-and-identity), une piste d'audit et Content Credentials lorsque tu configures une identité de signature.
- **Open source et sans facturation à l'usage.** Tu exécutes le code et ne paies que ta propre infrastructure.

Tu prends en charge le travail que ces services font pour toi. Un serveur durable a besoin d'une base de données persistante et d'un stockage des sorties. Les outils qui ont besoin d'un navigateur nécessitent le worker Chromium. [Installer Lolly Work](/info/work-install.html) décrit les deux.

<!--i:eti-table-->
## Les tâches en regard

| Tâche | API de rendu hébergée | Lolly |
|---|---|---|
| Remplir un modèle à partir de données | Requête API nommant un modèle et ses calques | [URL](/info/url-mode.html), [CLI](/info/cli.html) ou [API serveur](/info/work-automation-api.html) nommant un outil et ses entrées |
| De nombreux fichiers à partir d'un tableau | Lots et collections | [Traitement par lots](/info/batch.html) sur ton appareil, ou [lots de rendus](/info/work-renders.html#batches-with-durable-rows) sur un serveur |
| Attendre un résultat ou interroger son état | Interrogation périodique ou option synchrone | Rendus durables dont tu interroges l'état, ou rendu immédiat |
| Appeler un webhook une fois terminé | Oui | [Rappels signés](/info/work-renders.html) vers les origines que tu autorises |
| URL d'image dynamique | Oui | [Liens de partage et URL `/render`](/info/url-mode.html) |
| Modifier un modèle | Éditeur hébergé | [Design](/info/using.html), sur ton appareil |
| Agents | Les deux publient un serveur MCP | [MCP](/info/mcp.html), avec un point de terminaison d'organisation soumis à la politique d'un jeton sur Lolly Work |

Les types de sortie propres à Lolly sont listés dans [Exporter](/info/exporting.html). Sur un serveur Work aujourd'hui, les rendus durables produisent du SVG, PNG, JPG et PDF, et [la vidéo reste sur l'appareil, la CLI et MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Ce qui est transféré et ce qui ne l'est pas

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Tes requêtes | L'API de migration de Work accepte la même structure | Identique | Identique |
| Tes modèles | **Import** comme documents modifiables, sauf les types de calques sans schéma confirmé | Noms de champs et aperçu uniquement. Reconstruis chacun | Noms de champs et aperçu uniquement. Reconstruis chacun |
| URL dynamiques existantes | Non prises en charge | Non prises en charge | Les URL signées continuent de fonctionner après un changement d'hôte, avec ton ancien jeton privé |
| Webhooks | Les webhooks enregistrés ne sont pas pris en charge | `webhook_url` fonctionne | `webhook_success` fonctionne |
| Sorties WebP et AVIF | Refusées par leur nom | Non proposées | WebP refusé par son nom |
| Animations, vidéos, collections, captures d'écran | Pas sur l'API de migration | Pas sur l'API de migration | Pas sur l'API de migration |

::: note Construit à partir de la documentation publique
Cela a été construit à partir de la documentation publique de chaque fournisseur et n'a pas été exécuté sur un compte actif. Si tu as un compte, [le guide de migration](/info/work-move-from-render-api.html#check-it-on-your-own-account) propose une courte liste de vérification.
:::

Tu peux déplacer un modèle et garder les autres là où ils sont. [Quitter Lolly](/info/work-move-from-render-api.html#leave-lolly-too) est tout aussi ouvert : les outils sont de simples fichiers et la CLI en effectue le rendu sans serveur.

<!--i:eti-building-->
## Qui gère le service

Avec Lolly, une personne effectue le rendu localement, ou une équipe exécute Lolly Work sur sa propre infrastructure. Une tâche serveur envoie ses entrées et les ressources nécessaires à cette instance. Le parcours sur l'appareil ne le fait pas.

Bannerbear et Placid sont des marques de leurs propriétaires. Cette page décrit les fonctions communes des produits à partir de leur documentation publique et n'est affiliée ni à l'un ni à l'autre.
