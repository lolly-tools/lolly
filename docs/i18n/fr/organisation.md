# Utiliser Lolly dans ton organisation

Ton organisation peut exploiter son propre Lolly : la même application, avec les outils et les design systems qu'elle a choisis. Découvre comment y accéder, te connecter et ce qui change.

Pour planifier la configuration de l'organisation, [Utiliser Lolly avec ton DAM existant](/info/use-with-dam.html) explique comment une bibliothèque approuvée peut rester en place pendant que les utilisateurs créent du contenu dans Lolly. [Souveraineté du contenu](/info/content-sovereignty.html) décrit le contrôle plus large sur la création, la gouvernance, le stockage et la portabilité.

::: note Ce qu'il te faut de ton organisation
L'adresse web de son Lolly, ou un fichier de configuration `.lolly` qu'elle a créé. lolly.tools seul ne se connecte pas à une organisation.
:::

<!--i:eti-globe-->
## Dans un navigateur

Ouvre l'adresse que ton organisation t'a donnée. Si la page te demande de te connecter, appuie sur **Sign in** et suis les étapes de la page de connexion qui s'ouvre. Ensuite, Lolly fonctionne comme d'habitude, avec les outils et les design systems de ton organisation.

Tu peux aussi partir de lolly.tools : ouvre la vue **Settings** et, sur la carte **Lolly instance**, appuie sur **Open a workspace**, saisis l'adresse et appuie sur **Open this instance**. Le navigateur ouvre l'adresse de ton organisation, car il ne peut pas charger les outils d'un autre Lolly depuis lolly.tools.

![La carte Lolly instance dans Settings, où tu ouvres l'espace de travail de ton organisation ou changes la source des outils de l'application](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## Dans l'application de bureau ou mobile

L'application démarre avec les outils qu'elle intègre. Pour te connecter, ouvre la vue **Settings** et appuie sur **Change** dans la carte **Lolly instance**. Le panneau demande **Where should Lolly get its tools?**

1. Choisis **Connect to a Lolly instance**.
2. Saisis l'adresse web de ton organisation et appuie sur **Check & connect**.
3. Appuie sur **Use this instance**. L'écran suivant, **Import your data (optional)**, transfère le travail enregistré depuis une sauvegarde Lolly. Appuie sur **Skip** si tu n'en as pas.
4. Connecte-toi si l'application te le demande.

Les outils d'une instance connectée s'exécutent avec le même niveau de confiance que ceux de l'application : ne te connecte donc qu'à une instance de confiance. Ton organisation peut aussi t'envoyer un fichier de configuration `.lolly` qui connecte l'application pour toi.

Pour changer d'instance plus tard, utilise à nouveau **Change**, ou **Leave** sur la même carte.

### Se connecter avec un code

Dans les applications de bureau et mobiles, l'écran de connexion propose aussi un code court lorsque le Lolly de ton organisation prend en charge la connexion par code. Appuie sur **Open sign-in in browser**, connecte-toi et approuve le code dans le navigateur. Tu peux aussi ouvrir l'adresse affichée sur un téléphone ou un ordinateur où tu es déjà connecté et saisir le code. Il reste valable environ dix minutes.

<!--i:eti-sliders-->
## Ce qui y est différent

- **Certains contrôles sont réglés pour toi.** Un contrôle géré par ton organisation affiche **Managed by** suivi du nom de l'organisation, ou **Managed by your organisation**. Un contrôle verrouillé ne peut pas être modifié et un menu peut ne proposer qu'une partie de ses choix. Certains contrôles sont masqués. La console de ton organisation consigne la règle qui a verrouillé un contrôle et pourquoi. Adresse-toi à la personne qui gère le Lolly de ton organisation.
- **Certains design systems sont verrouillés.** Un design system fourni par ton organisation affiche un cadenas et reste en lecture seule. Pour essayer des modifications, crée une copie modifiable dans **Settings → Preferences → Design systems**.
- **Seuls ses outils sont listés.** Un outil que ton organisation ne propose pas n'apparaît pas.
- **Projets partagés.** Si ton organisation partage des projets avec toi, **Projects** affiche une tuile **Team projects**. Ces sessions sont conservées sur le serveur de l'organisation. Ouvre-en une pour y travailler, ou démarre une [collaboration de travail](/info/collaborate.html#collabs-through-lolly-work-optional) depuis **Share** lorsque cette option est disponible.
- **Certains exports peuvent nécessiter une approbation.** Là où ton organisation exige une approbation, **Request approval** remplace **Download** et un outil peut proposer moins de formats.
- **Ton accueil peut s'ouvrir sur des modèles.** Si ton organisation publie des modèles à ton intention, comme elle pourrait le faire pour une entreprise partenaire, l'accueil les affiche à la place du message de première visite. Chaque modèle est une carte, avec **Your copy** pour continuer et **New version** quand le modèle change. Voir [Modèles pour les partenaires](/info/work-partner-templates.html).

### Ce qui reste où

::: cols
## Sur cet appareil

- Tes propres enregistrements, sauf si tu actives [Sync](/info/sync.html)
- Les design systems que tu as créés toi-même
- Tout ce que tu crées et télécharges

## Sur le serveur de ton organisation

- Ton identité de connexion et les informations sur ton appareil
- Les projets d'équipe, les sessions partagées et les modifications en direct dans une collaboration de travail
- Les ressources que tu envoies dans la bibliothèque partagée
- Les demandes d'approbation et les livraisons approuvées
- Un journal de tes connexions et de tes actions sur ce serveur
:::

Quand un espace de travail est connecté, la ligne sur la confidentialité au premier écran de l'application indique la même chose. Les applications de Lolly n'envoient aucun événement d'utilisation à l'espace de travail. [Confidentialité](/info/privacy.html#organisation-services-with-lolly-work) liste ce que le serveur conserve et qui contrôle ces données.

<!--i:eti-building-->
## Ce qu'ajoute Lolly Work

Le serveur de ton organisation exécute **Lolly Work**, le logiciel pour les organisations issu du même projet open source. L'application n'a besoin ni d'un compte professionnel ni de Lolly Work quand tu l'utilises seul.

::: details Ce que Lolly Work peut ajouter
Ton organisation héberge [Lolly Work](https://github.com/lolly-tools/lolly-work) aux côtés de Lolly et choisit les fonctions à activer :

- **Connexion et accès.** Authentification unique de l'organisation, permissions par groupe et champs de profil gérés. Les administrateurs peuvent provisionner et désactiver des comptes via SCIM.
- **Travail partagé.** Projets d'équipe, sessions partagées et [collaborations de travail](/info/collaborate.html#collabs-through-lolly-work-optional), avec modification en direct via le serveur de l'organisation.
- **Une bibliothèque de ressources partagée.** Ressources envoyées, collections et bibliothèques connectées, avec règles d'accès, versions et révision.
- **Révision et livraison.** Étapes d'approbation, liens gérés avec expiration ou révocation et livraison vers les destinations autorisées par l'organisation.
- **Administration.** Un enregistrement d'audit des actions encadrées et des rapports d'utilisation selon la politique de télémétrie de l'instance pour les clients qui envoient des événements d'utilisation. Les applications de Lolly n'en envoient aucun aujourd'hui.
:::

Pour configurer le service, commence par [Déploiement](/info/deployment.html#organisation-services-with-lolly-work). La démo publique sur [lolly.work](https://lolly.work) est un bac à sable. Utilise l'adresse de ton organisation pour le travail que tu dois conserver.

<!--i:eti-palette-->
## La marque d'une autre organisation

Un partenaire, un client ou un sponsor peut t'envoyer sa marque sous forme de fichier de design system (`.lolly`) plutôt qu'une adresse. Ouvrir ce fichier ne connecte l'application à rien. Le fichier ajoute son design system à côté du tien sur cet appareil. Un fichier de configuration de ta propre organisation connecte l'application au Lolly de l'organisation. Avant tout changement, l'aperçu montre ce que fera l'ouverture du fichier. [Travailler avec des partenaires](/info/partners.html) présente les deux côtés du travail avec la marque d'une autre organisation.

<!--i:eti-unlink-->
## Quitter

**Leave**, sur la carte **Lolly instance** dans **Settings**, supprime le design system, les outils et le catalogue de ton organisation. Ton propre travail reste. Tout ce que tu as créé avec ses outils ne pourra plus s'ouvrir avant que tu te reconnectes. Lorsque le Lolly de ton organisation le propose, **Sign out everywhere** sur la même carte met fin à tes sessions sur tous les appareils, y compris celui-ci.

Tout ce que tu as enregistré auprès de l'organisation y reste, selon ses politiques d'accès et de conservation. Quitter ou effacer les données de cet appareil ne supprime pas cette copie sur le serveur. Dans un navigateur à l'adresse de ton organisation, il n'y a rien à quitter : ouvre une autre adresse.

<!--i:eti-help-->
## À qui s'adresser

Ce qui atteint le serveur de ton organisation, qui peut voir ses projets partagés et quels réglages sont verrouillés relèvent des décisions de ton organisation. Adresse-toi à la personne qui gère son Lolly. [Confidentialité](/info/privacy.html) décrit ce que Lolly lui-même fait de tes données.
