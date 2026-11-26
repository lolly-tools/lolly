# Arquitetura do Lolly

![Ícone do Lolly - Pirulito grande verde e branco](/info/icon.svg)

Esta página é para quem altera o código do Lolly: como o motor, os shells e os pacotes de ferramentas se encaixam, onde cada um fica no repositório e os compromissos que limitam cada alteração. Para saber o que o Lolly faz e quem usa o Lolly, leia primeiro [Como o Lolly funciona](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) mapeia o motor módulo por módulo e é gerado a partir do código. [Modelo de ameaças & limites de confiança](/info/threat-model.html) interpreta a mesma arquitetura como limites de confiança e diz o que o motor trata como não confiável.

<!--i:eti-layers-->
## Visão geral

As ferramentas são dados no topo. O motor no meio não conhece nenhuma plataforma. Os shells na base implementam um único contrato, e os catálogos fornecem o conteúdo.

![As ferramentas fornecem um manifesto, um template e hooks ao motor compartilhado. Os shells web, Tauri e de terminal implementam a ponte de capacidades HostV1 e leem ferramentas e recursos dos catálogos.](/info/diagrams/concepts/platform-layers.svg)

Tudo o que você pode descrever com dados puros e Handlebars pertence ao **motor**. Tudo o que toca no DOM, no sistema de arquivos, na rede ou em qualquer API do navegador ou do sistema operacional pertence ao **host**, o lado do shell na ponte. O motor é de código aberto. Nada que conheça uma marca específica entra no motor.

<!--i:eti-folder-shared-->
## Estrutura do repositório

O Lolly é um único repositório. Cada diretório abaixo é um diretório comum, exceto `brands/suse`: um submódulo git **privado** com o pacote de ferramentas e o catálogo da SUSE, que um clone público não baixa. Um perfil de conteúdo (`profiles.json`) define quais pacotes uma compilação lê. Cada processo resolve seu próprio perfil, e não há um seletor global. O [Guia de compilação](/info/build-guide.html) tem o comando de clonagem e mostra como fazer commit de uma alteração dentro do pacote privado.

| Diretório | O que contém |
|---|---|
| `engine/` | O núcleo independente de plataforma: carregador, runtime, entradas, templates, modo URL, unidades e módulos de formato |
| `shells/` | O app web, os apps Tauri para desktop e dispositivos móveis, a CLI, a TUI e a extensão de navegador |
| `packages/` | O SDK para autores de ferramentas (`@lolly-tools/core`), as partes compartilhadas do shell Node e o renderizador da documentação, entre outros |
| `community/` | As ferramentas independentes de marca, além dos pacotes de emojis compartilhados |
| `brands/` | Pacotes de marca: `lolly-demo` (Lolly Demo, o sistema de design usado por lolly.tools), `lolly-start` (o ponto de partida em branco) e o `suse` privado |
| `services/` | Os serviços opcionais de MCP, certificados e Penpot e o código de servidor que compartilham |
| `schemas/` | JSON Schema para manifestos de ferramentas, entradas de recursos e referências a recursos |
| `scripts/`, `tests/`, `docs/`, `api/` | Scripts de compilação e catálogo, a suíte de testes do motor, esta documentação e os pacotes serverless gerados |

::: details Os arquivos do motor e dos shells que você encontra primeiro
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note Não há diretório `tools/` nem `catalog/` na raiz do repositório
`packages/node-shell/src/content-roots.ts` responde a "onde fica a ferramenta `<id>`" e "onde está o catálogo" a partir de `profiles.json`. Um par real de `tools/` e `catalog/` só é gravado na saída de uma compilação, como `dist/`, o conteúdo de um RPM ou uma imagem de contêiner, porque um navegador busca esses dois caminhos por HTTP.
:::

<!--i:eti-monitor-->
## Onde o Lolly roda

Cada interface usa o mesmo motor e os mesmos arquivos de ferramentas.

- **O app web.** Um app web progressivo. Funciona offline depois que seu service worker armazena as ferramentas e os recursos em cache. Não precisa de conta, e o estado fica no IndexedDB em cada dispositivo. Um único layout responsivo atende ao desktop e ao celular. No celular, os controles viram um painel e os controles de exportação abrem a partir de uma pílula flutuante.
- **Os apps para desktop e dispositivos móveis.** Pacotes Tauri do mesmo app web, com caixas de diálogo nativas para arquivos, estado no sistema de arquivos e uso totalmente offline.
- **A CLI.** `lolly <tool-id> --input=value --output=file.png` carrega o mesmo motor em um DOM sem interface gráfica e grava o arquivo. É o modo URL por outro meio de transporte. Veja [CLI](/info/cli.html).
- **A TUI.** Um app de terminal em tela cheia, pensado para o teclado. Reutiliza a ponte da CLI e mantém as sessões salvas em disco: na pasta do app para desktop quando ele está instalado ou em `~/.lolly` caso contrário. Inicia um navegador sem interface gráfica de escopo restrito apenas quando um formato precisa dele. Veja [TUI](/info/tui.html).

![A visão dividida no desktop: controles gerados a partir do manifesto à esquerda, o canvas ao vivo à direita](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Na largura de um celular, o painel de controles fica no topo e a prévia preenche a tela.

![Um audiograma em uma tela de 430px de largura: o painel de controles acima, a arte quadrada finalizada abaixo e a pílula flutuante de exportação](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

O app web também inclui o **Batch** (`#/batch`, `shells/web/src/pro/`), uma grade no estilo de planilha que renderiza muitas linhas de uma vez em uma ou várias ferramentas. Veja [Batch e Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** lista tudo o que a plataforma declara ser capaz de fazer.

![Batch em uma instalação nova: uma linha vazia esperando uma ferramenta, com a interface de planilha e seu botão Render prontos antes de qualquer dado chegar](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Compromissos de arquitetura

Estas decisões estão definidas. Todas as outras decisões na base de código dependem delas, então mudar uma exige um esforço grande.

### 1. Ferramentas declarativas, com uma alternativa imperativa

Uma ferramenta é um manifesto (`tool.json`), um template (`template.html`) e um `hooks.js` opcional. **O manifesto declara as entradas**. As entradas nunca são inferidas dos tokens Handlebars do template. A maioria das ferramentas tem apenas um manifesto e um template, então quem não é desenvolvedor também pode criá-las.

![A pilha de controles do Street Map: um menu suspenso de cidades, um seletor de tema, controles deslizantes de espessura e gatilhos de cor, cada um gerado a partir de uma linha do manifesto](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Ferramentas que calculam valores, como codificação de QR ou construção de gráficos, acrescentam hooks: funções nomeadas do ciclo de vida que o runtime chama com a ponte de capacidades injetada. Os hooks são um contrato de portabilidade, não uma sandbox de segurança. Eles rodam dentro de um limite de tempo. Ferramentas cujos hooks comprovadamente não usam variáveis globais da página trazem `isolate: true` e rodam em um Worker. [Hooks de ferramentas](/info/tool-hooks.html) apresenta o ciclo de vida e os limites de tempo. O [Modelo de ameaças](/info/threat-model.html) diz o que o executor dentro da página consegue ou não isolar.

### 2. Ferramentas e recursos são dados, não código empacotado

Os apps web e Tauri buscam os catálogos de ferramentas e recursos ao iniciar, armazenam-nos em cache e trabalham com o que está no cache. Uma ferramenta ou um recurso novo não exige uma nova versão do app. Os bytes dos recursos têm somas de verificação SHA-256. O `id` e a `version` de um recurso determinam a invalidação do cache.

### 3. A ponte de capacidades é a única API que as ferramentas veem

As ferramentas nunca tocam no DOM fora de seu template, nunca chamam `fetch` diretamente e nunca leem o sistema de arquivos. Elas chamam métodos `host.*` versionados. O contrato é definido em `packages/core/src/host-v1.ts`, no SDK para autores de ferramentas `@lolly-tools/core`. Terceiros podem desenvolver com o SDK sem depender do motor. `engine/src/bridge/host-v1.ts` reexporta seus tipos.

| API obrigatória | O que faz |
|---|---|
| `host.profile` | Os dados do usuário; preenche entradas por meio de `bindToProfile` |
| `host.assets` | Consultas ao catálogo, resolução de recursos e o seletor do host |
| `host.state` | Salva e carrega slots de entradas: IndexedDB na web, o sistema de arquivos no Tauri, memória na CLI |
| `host.clipboard` | Grava texto ou uma imagem na área de transferência, com alternativas para cada plataforma |
| `host.export` | Rasteriza ou serializa o alvo de renderização e oferece o caminho de transformação de arquivos no dispositivo |
| `host.log` | Registro de logs por nível no host |

Todas as outras APIs são opcionais e complementares: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` e muitas outras. O `requires` de um manifesto lista as APIs opcionais que seus hooks chamam sem verificar antes. Um host que não tenha uma delas se recusa a montar a ferramenta. Os hooks detectam a disponibilidade das demais. Algumas, como `recorder`, também precisam de uma capacidade do dispositivo declarada pela ferramenta. `packages/core/src/host-v1/apis.ts` lista todas, e [API do host](/info/host-api.html) documenta cada uma. Adicionar um método gera uma versão menor. Remover ou alterar um gera uma versão maior, e a v1 continua funcionando quando a v2 é lançada.

### 4. Os ids de recursos são para sempre

`lolly/logo/primary` é um contrato. Depois de publicado, um id nunca muda e nunca é reutilizado. Uma alteração de bytes incrementa `version` na entrada do recurso. Uma substituição define `deprecated: true` e, opcionalmente, `replacedBy`. As referências existentes sempre são resolvidas, então sessões salvas e links compartilhados continuam funcionando por anos.

### 5. O modo URL tem suporte de primeira classe

Toda entrada pode ser expressa como um parâmetro de URL, então um link é um arquivo pronto:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Esse link sozinho, sem mais nada, é o arquivo pronto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Mude um parâmetro e você terá um arquivo diferente. Esta paleta é uma cor inicial, uma harmonia e um número de etapas:

![Nove etapas em quatro matizes, todas geradas a partir da única cor inicial contida no link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

A CLI monta o mesmo estado de URL a partir de seus argumentos e executa o mesmo fluxo, então a CLI não pode divergir do app. `engine/src/url-mode.ts` analisa e serializa o estado da URL. Nomes reservados (`format`, `width`, `dpi`, `c2pa`, `z` e outros) nunca são passados a uma ferramenta. [Parâmetros de URL reservados](/info/url-parameters.html) lista todos. Entradas de recursos viajam por `id` e são resolvidas por `host.assets.get()` antes que o template seja preenchido.

### 6. O armazenamento passa pela ponte

O app web usa IndexedDB, o Tauri usa o sistema de arquivos e a CLI usa a memória. As ferramentas veem apenas `host.state.save(slot, data)` e `host.state.load(slot)`, nunca `localStorage`. As pessoas podem manter várias sessões nomeadas por ferramenta sem conta. Como a ponte é o único ponto de conexão, esse estado também é portátil. `shells/web/src/data-transfer.ts` exporta o estado como um único arquivo `lolly-backup` que pode ser importado em qualquer outra instalação ([Transferência de dados](/info/data-transfer.html)). O [Sync](/info/sync.html) envia o mesmo pacote para o armazenamento que a pessoa escolhe.

### 7. As tags de maturidade dizem o que uma ferramenta é

Toda ferramenta declara `status: official | community | experimental`. A galeria ordena por status. Ferramentas experimentais colocam marca d'água nas exportações por padrão: o runtime ativa a marca d'água, a menos que quem faz a chamada passe `watermark: false`. Ferramentas que operam no dispositivo são isentas. O processo de catálogo da própria equipe se baseia nessas tags.

### 8. As entradas têm tipos definidos no manifesto

Uma entrada declara um `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` ou `file`. O host renderiza um controle para cada tipo, então as ferramentas não escrevem código de controles. Qualquer entrada pode ter `bindToProfile`. Três tipos são os mais importantes:

- **`asset`**, com `filter` e `allowUpload`, é a ponte para o sistema de recursos. `allowUpload: false` limita um slot aos recursos da biblioteca. Os uploads dos usuários usam a mesma estrutura `AssetRef` da biblioteca.
- **`blocks`** é um grupo de campos repetidos editado em um painel lateral, usado por Meeting Planner, Wayfinding, Diagrams e outras ferramentas. Clicar em um bloco renderizado coloca o foco na sua linha.
- **`file`** mantém o arquivo do próprio usuário na memória para utilitários que operam no dispositivo, como Lolly Strip Hidden Data e Compress, e **`vector`** agrupa um conjunto fixo de números em um único controle.

### 9. Templates não contêm lógica

Os templates usam Handlebars, então quem não é desenvolvedor também pode escrevê-los. `{{x}}` faz o escape, e `{{{x}}}` exige uma escolha explícita. A lógica fica em `hooks.js`, onde pode ser revisada. Muitos templates usam `{{{` para marcação calculada por um hook, então cada hook deve fazer o escape do que entrega. Os helpers são `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` e `media`, além de `icsStamp`, `rfcText`, `csvCell` e `arrow` para templates correspondentes `.ics`, `.vcf` e `.csv`. [Templates e renderização](/info/tool-rendering.html) explica cada um.

### 10. Ferramentas compõem outras ferramentas

Uma ferramenta pode incorporar a renderização de outra sem importações entre ferramentas. O motor resolve a composição. Um manifesto pode declarar `composes: [{ id, tool, inputs }]` e posicionar a ferramenta filha com `{{asset <id>}}`. Uma URL de incorporação portátil (`https://lolly.tools/tool/<id>.svg?…`) renderiza a filha localmente; é assim que o Lolly Design posiciona um código QR ou gráfico ao vivo. Uma filha em SVG continua vetorial em uma saída pai em SVG ou PDF. As filhas são intermediárias e nunca recebem marca d'água nem carimbo. Um shell que não consegue renderizar uma filha deixa o slot vazio, e a ferramenta pai continua sendo renderizada. [Composição e sobreposições de marca](/info/tool-composition.html) traz os detalhes.

<!--i:eti-scissors-->
## O que escolhemos não fazer

- **Nenhum JavaScript arbitrário em templates.** A lógica fica em `hooks.js`.
- **Nenhum servidor obrigatório de recursos.** As pessoas adicionam seus próprios arquivos a Assets no app e repassam o trabalho como uma sessão: um link de compartilhamento para entradas e configurações, um arquivo `.lolly` quando os uploads também são enviados. Uma sessão compartilhada pode virar um template no seletor de uma ferramenta. Uma organização que quer um catálogo governado pode usar o catálogo, as aprovações e as políticas do Lolly Work ou gerenciar o pacote de marca no git e revisar as alterações lá.
- **Nenhum controle de acesso imposto.** O app aberto é público por padrão. As tags de maturidade e as marcas d'água sinalizam o risco para a marca. O login na organização, os papéis e as políticas vêm do Lolly Work quando a equipe quer usá-los.
- **Nenhum banco de dados central.** O estado do usuário fica em cada dispositivo, e o Sync opcional o copia para o armazenamento que a pessoa escolhe, nunca para um banco de dados do Lolly.
- **Nenhum caminho de código compartilhado entre as ferramentas e o motor.** O motor e as ferramentas da comunidade são de código aberto. Um pacote de marca, como o `brands/suse/` privado, contém suas próprias ferramentas e seu catálogo sob seus próprios termos. Nenhuma ferramenta importa de `engine/`, então a separação se mantém clara.

<!--i:eti-refresh-->
## O ciclo de vida de uma renderização

Alguém abre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Inicialização.** O app web abre o IndexedDB, monta a ponte de capacidades e sincroniza os catálogos de ferramentas e recursos ou os carrega do cache quando está offline.
2. **Roteamento.** O caminho seleciona a visualização da ferramenta `qr-code`, com a consulta como seus valores iniciais.
3. **Carregamento.** `loadTool` busca `tool.json`, valida o arquivo em relação ao esquema e busca o template, os estilos e os hooks.
4. **Análise do link.** `parseUrlState` transforma os parâmetros em valores de entrada. Uma referência a recurso como `?logo=lolly/logo/primary` vira um `{ id }` ainda não resolvido.
5. **Início do runtime.** `createRuntime(tool, host, initialValues)` monta o modelo de entradas a partir dos dados do perfil, dos valores padrão e do link, resolve as referências a recursos, carrega os hooks e chama `onInit`.
6. **Renderização.** O shell assina as atualizações do runtime, desenha os controles a partir do modelo e grava o template preenchido em `#tool-canvas`.
7. **Interação.** Digitar chama `runtime.setInput`, que aplica as restrições, chama `onInput`, preenche o template novamente e redesenha.
8. **Exportação.** **Download** chama `runtime.export(node, format)`, e o `host.export` do shell produz o arquivo: um raster, um vetor gerado pelo percurso do DOM, um PDF, um documento ou um dos outros formatos de `schemas/tool.schema.json`. As unidades físicas são convertidas por formato. Metadados e Content Credentials são incorporados onde o formato consegue contê-los. Ferramentas experimentais recebem a marca d'água do host, não da ferramenta. [Templates e renderização](/info/tool-rendering.html) e [Exportar um arquivo](/info/exporting.html) explicam a etapa de exportação.

![O painel de exportação que ?options abre: o par de nome do arquivo e formato, o tamanho da saída e os controles que gravam o arquivo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

O mesmo ciclo de vida roda no Tauri e na CLI com um DOM sem interface gráfica, onde a saída vai para um arquivo ou para stdout.

<!--i:eti-stamp-->
## Licenças

O código, incluindo `engine/`, `shells/`, `services/`, `schemas/` e o gerador de documentação, usa MPL-2.0 e fica em um único repositório público, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). O texto da documentação usa CC BY-SA 4.0. Os pacotes de marca têm seus próprios termos no `NOTICE.md` de cada pacote: as ferramentas da comunidade usam MPL-2.0, e o pacote privado da SUSE é software proprietário da SUSE. [Sobre](/info/about.html) traz a nota completa de licenciamento.
