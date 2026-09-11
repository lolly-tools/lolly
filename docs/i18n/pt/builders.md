# Lolly para Desenvolvedores

A documentação técnica - para quem cria ferramentas, integra o Lolly a um pipeline, faz o self-host dele ou estende a plataforma.

**O que você ganha com isso.** Construa uma ferramenta uma vez e o pedido para de voltar pra você. Aquele "você pode só fazer um pra mim…" repetitivo que consome suas tardes vira um template que as outras pessoas preenchem sozinhas - direitinho, sem você precisar entrar no meio. Seu trabalho é HTML/CSS/JS puro: versionado, fácil de comparar, revisável, e roda sobre um engine aberto, sem vendor lock-in, então continua sendo seu. Automatize a produção e seu tempo vai para o problema interessante, não para a exportação número dez mil.

O Lolly é um **engine** independente de plataforma que executa o mesmo caminho de renderização em vários **shells** (web PWA, Tauri desktop/mobile, CLI, TUI). As ferramentas são **dados, não código empacotado** - um manifest, mais um template, mais hooks opcionais - então novas ferramentas são lançadas sem precisar de uma atualização do app. Comece pela [Visão Geral](/info/overview.html) para entender a arquitetura, e depois siga a trilha que combina com o que você está construindo.

Novo na plataforma? O **[Guia Rápido](/info/quickstart.html)** coloca uma marca e o seu primeiro render no lugar antes de você se aprofundar.

## Entenda a arquitetura



- **[Visão Geral](/info/overview.html)** - por que o Lolly existe, a separação entre engine/shell/tools, a bridge de capacidades e os compromissos arquiteturais já definidos.
- **[Design Tokens](/info/design-tokens.html)** - o modelo de tokens DTCG em que as marcas são expressas, e como as ferramentas os consomem.

## Crie ferramentas

Cada controle abaixo foi gerado a partir de um input declarado no `tool.json`. Você escreve a linha do manifest, o host desenha o widget, e o mesmo modelo alimenta a CLI e a URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

E isso escala bem além de cinco controles. Dê a um input um `section` e o host o recolhe, então uma ferramenta de cinquenta inputs como o D3 Chart Studio ainda abre como uma pilha curta, com o resto guardado atrás de grupos nomeados.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Criação de Ferramentas](/info/authoring-tools.html)** - o guia completo: manifest, template, estilos, hooks, composição e publicação.
- **[Criação de Assets](/info/authoring-assets.html)** - assets do catálogo, tiers, locales, paletas, ícones temáveis e fontes.
- **[API do Host](/info/host-api.html)** - a bridge de capacidades `HostV1` contra a qual toda ferramenta é escrita (a única API que as ferramentas veem).
- **[Modo URL](/info/url-mode.html)** - cada input como um parâmetro de URL; parâmetros reservados, codificação compacta, links compactados.

## Execute e integre

- **[CLI](/info/cli.html)** - renderização headless; o mesmo caminho de renderização da GUI, controlado por argv no formato `--foo=bar`.
- **[TUI](/info/tui.html)** - o shell de terminal interativo.
- **[Servidor MCP](/info/mcp.html)** - o endpoint nativo que permite que um agente de IA descubra e execute ferramentas.
- **[Agentes de IA](/info/ai-agents.html)** - controlando o Lolly a partir de um modelo: uma URL é a API.
- **[Extensão do Chrome](/info/extension.html)** - capture uma URL ao vivo como um asset reutilizável.

## Publique e opere

- **[Guia de Build](/info/build-guide.html)** - compile cada target: CLI, TUI, desktop, mobile.
- **[Implantação](/info/deployment.html)** - o app web, os apps e os serviços de backend; onde cada peça roda.
- **[Configuração](/info/configuration.html)** - profiles, brand packs, capability gating, feature flags e validação do catálogo.

## Confiança e dados

Direitos e autoria são inputs como quaisquer outros. O Embed & Track Image declara campos de autor, copyright, licença e contato, e a exportação grava tudo isso nos metadados do próprio arquivo e no manifest C2PA dele.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Identidade de Content Credentials](/info/content-credentials-identity.html)** - assinatura emitida por uma CA para C2PA no dispositivo; contratos do engine e o runbook do operador.
- **[Transferência de Dados](/info/data-transfer.html)** - o bundle `lolly-backup`: envelope, integridade e garantias entre shells.
- **[Sobre](/info/about.html)** - o projeto, o limite da sua licença e o repositório.
