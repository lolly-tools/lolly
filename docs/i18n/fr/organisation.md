# Utiliser Lolly dans ton organisation

Ton organisation peut faire tourner son propre Lolly : la même application, avec les outils et le design system qu'elle a choisis, et parfois une connexion. Cette page montre comment y accéder et ce qui change une fois que c'est fait.

::: note Ce dont tu as besoin de ton organisation
L'adresse web de son Lolly, ou un fichier de configuration `.lolly` que ton organisation a créé. lolly.tools seul ne se connecte à aucune organisation.
:::

## Dans un navigateur

Ouvre l'adresse que ton organisation t'a donnée. Si la page te demande de te connecter, appuie sur **Se connecter** et suis la page de connexion qui s'ouvre. Ensuite, ça fonctionne comme n'importe quel Lolly, avec les outils et le design system de ton organisation.

Un navigateur n'a aucun réglage pour basculer vers un autre Lolly, donc ouvre l'adresse propre à ton organisation plutôt que lolly.tools.

## Dans l'application de bureau ou mobile

Au premier démarrage, l'application demande : **Où Lolly doit-il obtenir ses outils ?**

1. Choisis **Se connecter à une instance Lolly**.
2. Saisis l'adresse web de ton organisation et appuie sur **Vérifier et se connecter**.
3. Appuie sur **Utiliser cette instance**. L'écran suivant, **Importer tes données (facultatif)**, rapatrie le travail enregistré depuis une sauvegarde Lolly ; appuie sur **Passer** si tu n'en as pas.
4. Connecte-toi si l'application le demande.

Les outils d'une instance connectée s'exécutent avec la même confiance que ceux propres à l'application, donc ne te connecte qu'à une instance en laquelle tu as confiance. Ton organisation peut aussi t'envoyer un fichier de configuration `.lolly` qui connecte l'application à ta place.

Pour changer plus tard, ouvre **Paramètres** : la carte **Instance Lolly** propose **Modifier** et **Quitter**.

## Se connecter avec un code

Si te connecter sur cet appareil est peu pratique et que le Lolly de ton organisation le propose, appuie sur **Se connecter avec un code sur un autre appareil**. Lolly affiche un code court et une adresse : ouvre l'adresse sur un téléphone ou un ordinateur où tu es déjà connecté, et saisis-y le code. Le code dure environ dix minutes.

## Ce qui est différent là-bas

- **Certains contrôles sont réglés pour toi.** Un contrôle géré par ton organisation affiche **Managed by** et le nom de l'organisation, ou **Géré par ton organisation**. Un contrôle fixe ne peut pas être modifié, un menu peut n'offrir qu'une partie de ses choix, et une ligne commençant par **Set by** peut dire quelle règle s'applique et pourquoi. Certains contrôles ne sont pas affichés du tout.
- **Seuls ses outils sont listés.** Un outil que ton organisation ne propose pas n'est pas affiché du tout.
- **Projets partagés.** Si ton organisation partage des projets avec toi, **Projets** affiche une tuile **Projets d'équipe**.
- **Certains exports peuvent nécessiter une approbation.** Là où ton organisation demande une approbation, **Demander l'approbation** prend la place de **Télécharger**, et un outil peut proposer moins de formats.
- **Tes propres enregistrements** restent sur cet appareil sauf si tu actives la [synchronisation](/info/sync.html), comme partout dans Lolly.

## Quitter

**Quitter**, sur la carte **Instance Lolly** dans **Paramètres**, supprime le design system, les outils et le catalogue de ton organisation. Ton propre travail reste. Tout ce que tu as fait avec ses outils ne se rouvrira qu'une fois reconnecté, et tout ce que tu as enregistré auprès de l'organisation reste chez l'organisation. Dans un navigateur à l'adresse propre de ton organisation, il n'y a rien à quitter : ouvre une adresse différente à la place.

## À qui demander

Ce qui atteint le serveur de ton organisation, qui peut voir ses projets partagés et quels réglages sont fixes sont des décisions de ton organisation. Demande à la personne qui gère le Lolly de ton organisation. [Politique de confidentialité](/info/privacy.html) couvre ce que Lolly lui-même fait de tes données.
