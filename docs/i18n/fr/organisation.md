# Utiliser Lolly dans ton organisation

Ton organisation peut faire tourner son propre Lolly : la même application, avec les outils et les design systems qu'elle a choisis. Cette page montre comment y accéder, te connecter et ce qui change ensuite.

::: note Ce dont tu as besoin de ton organisation
L'adresse web de son Lolly, ou un fichier de configuration `.lolly` que ton organisation a créé. lolly.tools seul ne se connecte à aucune organisation.
:::

## Dans un navigateur

Ouvre l'adresse que ton organisation t'a donnée. Si la page te demande de te connecter, appuie sur **Sign in** et suis la page de connexion qu'elle ouvre. Ensuite, elle fonctionne comme n'importe quel Lolly, avec les outils et les design systems de ton organisation.

Tu peux aussi partir de lolly.tools : ouvre **Settings**, et sur la carte **Lolly instance** appuie sur **Open a workspace**, saisis l'adresse et appuie sur **Open this instance**. Le navigateur va à l'adresse propre de ton organisation, car un navigateur ne peut pas charger depuis lolly.tools les outils d'un autre Lolly.

![La carte Lolly instance dans les réglages, où tu ouvres l'espace de travail de ton organisation ou changes la source des outils de l'application](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## Dans l'application de bureau ou mobile

L'application démarre avec ses outils intégrés. Pour te connecter, ouvre **Settings** et appuie sur **Change** sur la carte **Lolly instance**. La feuille demande **Where should Lolly get its tools?**

1. Choisis **Se connecter à une instance Lolly**.
2. Saisis l'adresse web de ton organisation et appuie sur **Vérifier et se connecter**.
3. Appuie sur **Utiliser cette instance**. L'écran suivant, **Importer tes données (facultatif)**, rapatrie le travail enregistré depuis une sauvegarde Lolly ; appuie sur **Passer** si tu n'en as pas.
4. Connecte-toi si l'application le demande.

Les outils d'une instance connectée s'exécutent avec la même confiance que ceux propres à l'application, donc ne te connecte qu'à une instance en laquelle tu as confiance. Ton organisation peut aussi t'envoyer un fichier de configuration `.lolly` qui connecte l'application à ta place.

Pour changer plus tard, utilise de nouveau **Change**, ou **Leave** sur la même carte.

### Se connecter avec un code

Dans les applications de bureau et mobiles, l'écran de connexion propose aussi un code court, lorsque le Lolly de ton organisation prend en charge la connexion par code. Appuie sur **Open sign-in in browser**, connecte-toi et approuve le code là-bas. Ou ouvre l'adresse affichée sur un téléphone ou un ordinateur où tu es déjà connecté, et saisis le code. Le code dure environ dix minutes.

## Ce qui est différent là-bas

- **Certains contrôles sont réglés pour toi.** Un contrôle que ton organisation gère affiche **Managed by** et le nom de l'organisation, ou **Managed by your organisation**. Un contrôle fixe ne peut pas être modifié, un menu peut ne proposer qu'une partie de ses choix, et une ligne commençant par **Set by** peut dire quelle règle s'applique et pourquoi. Certains contrôles ne sont pas affichés du tout.
- **Certains design systems sont verrouillés.** Un design system que fournit ton organisation affiche un cadenas et reste en lecture seule. Pour essayer des changements, crée une copie modifiable dans **Settings → Preferences → Design systems**.
- **Seuls ses outils sont listés.** Un outil que ton organisation ne propose pas n'est pas affiché du tout.
- **Projets partagés.** Si ton organisation partage des projets avec toi, **Projects** affiche une tuile **Team projects**. Ces sessions vivent sur le serveur de l'organisation. Ouvre-en une pour y travailler, ou démarre une [collab de travail](/info/collaborate.html#work-collabs-with-lolly-work-optional) depuis **Share** quand c'est possible.
- **Certains exports peuvent nécessiter une approbation.** Lorsque ton organisation demande une approbation, **Request approval** remplace **Download**, et un outil peut proposer moins de formats.

### Ce qui reste où

::: cols
## Sur cet appareil

- Tes propres enregistrements, sauf si tu actives [Sync](/info/sync.html)
- Les design systems que tu as créés toi-même
- Tout ce que tu crées et télécharges

## Sur le serveur de ton organisation

- Ton identité de connexion et les informations sur l'appareil
- Les projets d'équipe, les sessions partagées et les modifications en direct dans une collab de travail
- Les ressources que tu envoies dans la bibliothèque partagée
- Les demandes d'approbation et les livraisons approuvées
- Les événements d'usage, là où ton organisation les active
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) liste ce que le serveur stocke et qui contrôle ces données.

## Ce que Lolly Work ajoute

Le serveur de ton organisation fait tourner **Lolly Work**, le logiciel d'organisation du même projet open source. L'application n'a besoin ni d'un compte de travail ni de Lolly Work quand tu l'utilises seul.

::: details Ce que Lolly Work peut ajouter
Ton organisation héberge [Lolly Work](https://github.com/lolly-tools/lolly-work) à côté de Lolly et choisit les fonctions à activer :

- **Connexion et accès.** Authentification unique de l'organisation, permissions par groupe et champs de profil gérés. Les administrateurs peuvent provisionner et désactiver des comptes via SCIM.
- **Travail partagé.** Projets d'équipe, sessions partagées et [collabs de travail](/info/collaborate.html#work-collabs-with-lolly-work-optional), avec édition en direct via le serveur de l'organisation.
- **Une bibliothèque de ressources partagée.** Ressources importées, collections et bibliothèques connectées, avec règles d'accès, versions et revue.
- **Revue et livraison.** Étapes d'approbation, liens gérés avec expiration ou révocation, et livraison vers les destinations que l'organisation autorise.
- **Administration.** Rapports d'usage selon la politique de télémétrie de l'instance, plus un enregistrement d'audit des actions encadrées.

Si tu mets en place le service, commence par [Deployment](/info/deployment.html#organisation-services-with-lolly-work). La démo publique sur [lolly.work](https://lolly.work) est un bac à sable ; utilise l'adresse propre de ton organisation pour le travail que tu dois conserver.
:::

## Quitter

**Leave**, sur la carte **Lolly instance** dans **Settings**, supprime le design system, les outils et le catalogue de ton organisation. Ton propre travail reste. Tout ce que tu as créé avec ses outils ne s'ouvrira plus tant que tu ne te reconnectes pas.

Tout ce que tu as enregistré dans l'organisation reste à l'organisation, selon ses politiques d'accès et de conservation. Quitter ou vider cet appareil ne supprime pas cette copie côté serveur. Dans un navigateur à l'adresse propre de ton organisation, il n'y a rien à quitter : ouvre plutôt une autre adresse.

## À qui demander

Ce qui atteint le serveur de ton organisation, qui peut voir ses projets partagés et quels réglages sont fixes sont des décisions de ton organisation. Demande à la personne qui gère le Lolly de ton organisation. [Politique de confidentialité](/info/privacy.html) couvre ce que Lolly lui-même fait de tes données.
