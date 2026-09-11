# Lolly pour les opérateurs

Tu deviens la personne qui a dit oui à quelque chose à la fois sûr et populaire. Tu fermes une brèche d'exfiltration, tu gagnes en capacité et tu supprimes une file d'attente de demandes en un seul geste, ce qui est la rare victoire de sécurité qui te rend plus apprécié plutôt que moins : pas d'appel à 3 heures du matin parce que des fichiers sous embargo ont atterri sur un outil web quelconque, moins de fournisseurs et de contrats sur ton bureau, et un dossier que tu peux montrer quand on te le demande. Choisis ci-dessous la voie qui correspond à la fonction dont tu réponds.

Tu gouvernes le relais dans son ensemble : un créatif rédige les règles et un développeur les fait passer à l'échelle, et c'est l'opérateur qui rend cela sûr à exécuter dans toute une organisation, ce que [Le cycle de vie d'une campagne](/info/overview.html#the-lifecycle-of-a-campaign) suit de bout en bout.

Nouveau ici ? [Adoption et gouvernance](/info/adoption-governance.html) est le déploiement dans son intégralité. [Déploiement](/info/deployment.html) couvre déployer, servir et hybride, et [Configuration](/info/configuration.html) est ce qui façonne une instance unique.

## Ventes

Entre en réunion avec exactement le fichier dont tu as besoin, fait en chemin. Dépose le deck que tu as déjà et reconstruis-le, net, en fichier de deck natif, sans file d'attente de demandes entre toi et l'asset.

- **[Lolly pour les équipes commerciales](/info/sales.html)** - le manuel : réparer le deck que tu as, le reconstruire nativement et faire toi-même l'asset ponctuel.
- **[Exporter et formats](/info/exporting.html)** - le volet deck, PDF et image du panneau d'export, quand le fichier doit s'ouvrir sur l'ordinateur de quelqu'un d'autre.

## Presse

Des données en direct transformées en graphiques, cartes et tableaux déjà conformes au style maison. Construis le format de l'article une fois et réutilise-le à chaque parution, pour l'impression comme pour l'écran.

- **[Lolly pour la rédaction](/info/press.html)** - le manuel : le style info-éditorial, les données en direct en entrée et une sortie de qualité publication.
- **[Vues utilitaires](/info/utilities.html)** - le tableur et le convertisseur, pour l'étape avant le graphique.

## Marketing

Chaque taille, chaque langue, une seule source de vérité. Colle un tableur et obtiens un fichier terminé par ligne, sans agence au milieu des fichiers de routine.

- **[Lolly pour les équipes marketing](/info/marketing.html)** - le manuel : des variantes en volume, la localisation et ce qui cesse d'être un goulot d'étranglement.
- **[Utiliser Lolly](/info/using.html#batch-pro-mode)** - l'exécution en lot elle-même : une feuille en entrée, un dossier d'assets en sortie.

## Sécurité

La façon habituelle dont le travail créatif de routine se fait est une surface de responsabilité : des fichiers envoyés par e-mail à des prestataires externes, des assets de marque téléversés sur une douzaine d'éditeurs web, des données clients collées dans le site d'un inconnu pour faire rapidement un graphique. Lolly est la réponse immunitaire à cela, car elle remplace le travail plutôt que d'ajouter un contrôle par-dessus : la carte de citation, la bannière localisée et la capture d'écran caviardée sont faites sur l'appareil de l'employé lui-même, en conformité avec ta marque, si bien que rien ne part que tu n'y aies mis toi-même, et chaque résultat est reproductible à partir de ses entrées. Les exports peuvent porter plusieurs couches d'enregistrement cryptographique - un Content Credential C2PA signé par une clé générée sur l'appareil et jamais lisible en dehors, l'Imprint invisible de Lolly et une marque durable optionnelle qui survit à un ré-enregistrement - chacune inviolable de façon détectable et supprimable : un credential signale un changement plutôt que de l'empêcher, et c'est précisément ce qui rend possible une vérification entièrement hors ligne. La cryptographie et les analyseurs de fichiers passent par le durcissement de niveau entreprise de SUSE : les sceaux, la signature sur l'appareil et le chiffrement sont réels et défendables dès maintenant, donc là où un contrat exige une assurance certifiée, déploie-les en défense en profondeur pendant que ce processus s'achève.

- **[Confiance](/info/trust.html)** - chaque affirmation faite par ce site, avec le mécanisme qui la fait respecter juste à côté.
- **[Sécurité et vérification](/info/security.html)** - les normes, les primitives, le modèle de confiance et les tests, écrits pour un relecteur.
- **[Modèle de menace et frontières de confiance](/info/threat-model.html)** - ce contre quoi Lolly se défend, ce qu'elle ne fait explicitement pas et où se situe chaque frontière.
- **[Surface serveur](/info/server-surface.html)** - l'inventaire complet de ce qui tourne côté serveur (deux composants optionnels) face à ce qui tourne sur l'appareil.
- **[Inventaire des analyseurs](/info/parser-inventory.html)** - chaque analyseur qui touche un fichier qu'un utilisateur ouvre et contre quoi chacun est durci.
- **[Vérifie-le toi-même](/info/verify-yourself.html)** - vérifie les affirmations sur un export réel, étape par étape, sans rien que tu ne puisses exécuter toi-même.
- **[Politique de confidentialité](/info/privacy.html)** - l'énoncé formel de ce qui est collecté, stocké et envoyé, et de ce qui ne l'est pas.
- **[Production créative souveraine](/info/sovereign-production.html)** - déploiement en air gap, réseau soumis à consentement et signature sur l'appareil.
- **[Adoption et gouvernance](/info/adoption-governance.html)** - qui approuve un outil, comment les règles de marque deviennent applicables et ce que t'apporte l'option catalogue-en-tant-que-dépôt.

## Juridique

MPL-2.0 sans accord de licence de contributeur, énoncé sans détour, avec ce qui n'est pas revendiqué formulé aussi clairement que ce qui l'est. Les Content Credentials sont inviolables de façon détectable et supprimables, donc les pages ci-dessous disent ce qu'une signature affirme réellement avant que quiconque ne l'inscrive dans un contrat.

- **[Le marquage IA et l'EU AI Act](/info/eu-ai-act.html)** - l'Article 50, le Code of Practice qui pointe vers C2PA et l'adéquation honnête de Lolly.
- **[Comment Lolly se compare](/info/positioning.html)** - les faits de licence : MPL-2.0, aucun accord de licence de contributeur et sur quoi repose vraiment la gratuité pour toujours.
- **[Identité des Content Credentials](/info/content-credentials-identity.html)** - ce qu'un credential signé affirme, ce qu'il n'affirme pas et qui le certificat nomme.
- **[Transfert de données](/info/data-transfer.html)** - le paquet de sauvegarde avec lequel on répond à une demande d'accès aux données ou à une remise d'appareil.

## IA

Les agents fournissent des entrées, jamais un rôle. L'IA aide quand on la sollicite, ce qu'elle a produit le dit, et ton travail porte ton nom plutôt que celui d'un modèle.

- **[Notre position sur l'IA](/info/ai-stance.html)** - ce que Lolly fait et ne fait pas avec le contenu généré, et ce qui fait respecter chaque engagement.
- **[Généré une fois, restitué à l'identique](/info/ai-features.html)** - les fonctions d'IA livrées, et pourquoi inventer des pixels est marqué alors que les retirer ne l'est pas.
- **[Fournir des entrées, pas usurper une identité](/info/input-not-impersonation.html)** - pourquoi un agent fournit des entrées et jamais un rôle, comment cela est appliqué et ce qu'un agent malveillant ne peut toujours pas faire.
- **[Agents IA](/info/ai-agents.html)** - ce qu'un agent peut réellement piloter, si tes équipes en pointent déjà un vers ceci.
