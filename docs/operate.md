# Deploy

Hosting the Lolly web app, handing out the packaged app and running a Lolly Work server are separate jobs. Start with the one you have, and read only the pages it needs. [Choose a deployment](/info/deployment.html) compares the routes for the web app and the packaged apps.

## Choose and install

- [Run Lolly Work](/info/work-self-host.html): the path that matches what you have, from the public demo to Kubernetes, with downloads and checksums.
- [How a Work deployment fits together](/info/work-deployment.html): the parts every Lolly Work deployment runs and the ones you can leave out.
- [Official installation routes](/info/work-official-installations.html): which packages exist, what each has passed and how to check a download.

## Configure the instance

- [Work instance configuration](/info/work-configuration.html): every setting a Lolly Work instance reads.
- [Configure your first Work instance](/info/work-customer-setup.html): the first settings after install.
- [Set up enterprise identity](/info/work-enterprise-identity.html): single sign-on, SCIM and sign-out.
- [Configure Work export signing](/info/work-c2pa.html): Content Credentials signed with your organisation's identity.
- [Configure connector origins](/info/connector-origins.html): which outside services the app may reach.

## Keep it running

- [Operations runbook](/info/work-operations.html): backups, restores, upgrades and recovery.
- [Telemetry and dashboards](/info/work-telemetry.html): what the server measures and where you see the numbers.
- [Audit log](/info/work-audit.html): the record of governed actions.

## Build and package

- [Build Guide](/info/build-guide.html): build the web app, the desktop and mobile apps and the terminal tools yourself.
- [Build the web container and Helm chart](/info/build-kubernetes.html): run Lolly on Kubernetes.

An installation recipe describes a supported way to deploy, not your server. Before you update an instance that is already running, check the record of how that instance was deployed: its host, cluster, secrets, volumes and pinned release. A generic recipe cannot tell which server is your production one.
