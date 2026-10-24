# Arquitetura do Lolly

![Ícone do Lolly - Pirulito grande verde e branco](/info/icon.svg)

Esta página é para quem altera o código do Lolly: como o motor, os shells e os pacotes de ferramentas se encaixam, onde cada um fica no repositório e os compromissos que restringem toda mudança. Se você quer saber o que o Lolly faz e quem o usa, leia primeiro [How Lolly works](/info/how-lolly-works.html).

Dois complementos aprofundam o assunto. O [`engine/README.md`](../engine/README.md) é o mapa do motor módulo a módulo, gerado a partir do código. O [Threat Model & Trust Boundaries](/info/threat-model.html) lê a mesma arquitetura como limites de confiança, e é a página para qualquer dúvida sobre o que o motor trata como não confiável.

## Visão geral

As ferramentas são dados no topo. O motor, no meio, não sabe nada de nenhuma plataforma. Os shells, na base, implementam um contrato, e os catálogos fornecem o conteúdo.

![As ferramentas fornecem um manifesto, um template e hooks ao motor compartilhado. Os shells web, Tauri e de terminal implementam a ponte de capacidades HostV1 e leem ferramentas e recursos dos catálogos.](/info/diagrams/concepts/platform-layers.svg)

Se você consegue descrever algo apenas com dados e Handlebars, isso pertence ao **motor**. Se toca o DOM, o sistema de arquivos, a rede ou qualquer API do navegador ou do sistema operacional, pertence ao **host**, o lado do shell na ponte. O motor é de código aberto, e nada que conheça uma marca ou plataforma específica entra no motor.

## Estrutura do repositório

O Lolly é um único repositório. Todo diretório abaixo é um diretório comum dele, exceto `brands/suse`, um submódulo git **privado** que guarda o pacote de ferramentas e o catálogo da SUSE, que um clone público não busca. Os pacotes que uma compilação lê são definidos por um perfil de conteúdo (`profiles.json`), resolvido por processo e não alternado globalmente. O [Build Guide](/info/build-guide.html) tem o comando de clone e como uma mudança dentro do pacote privado é confirmada.

| Diretório | O que contém |
|---|---|
| `engine/` | O núcleo independente de plataforma: carregador, runtime, entradas, templates, modo URL, unidades e os módulos de formato |
| `shells/` | O app web, os apps desktop e mobile Tauri, a CLI, a TUI e a extensão de navegador |
| `packages/` | O SDK para autores de ferramentas (`@lolly-tools/core`), as peças compartilhadas do shell Node e o renderizador de docs, entre outros |
| `community/` | As ferramentas independentes de marca, mais os pacotes de emoji compartilhados |
| `brands/` | Pacotes de marca: `lolly-demo` (Lolly Demo, o sistema de design que o lolly.tools executa), `lolly-start` (o ponto de partida em branco) e o `suse`, privado |
| `services/` | Os serviços opcionais de MCP, certificados e Penpot, e o código de servidor que eles compartilham |
| `schemas/` | JSON Schema para manifestos de ferramentas, entradas de recursos e referências a recursos |
| `scripts/`, `tests/`, `docs/`, `api/` | Scripts de compilação e de catálogo, a suíte de testes do motor, estes documentos e os pacotes serverless gerados |

::: details Os arquivos do motor e do shell que você encontra primeiro
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

Não existe diretório `tools/` ou `catalog/` na raiz do repositório. O `packages/node-shell/src/content-roots.ts` responde "onde fica a ferramenta `<id>`" e "onde fica o catálogo" a partir do `profiles.json`, quando solicitado. Um par real de `tools/` e `catalog/` só é gravado em uma saída de compilação, como `dist/`, uma carga de RPM ou uma imagem de contêiner, porque um navegador busca esses dois caminhos por HTTP.

## Onde o Lolly roda

Todas as superfícies usam o mesmo motor e os mesmos arquivos de ferramenta.

- **O app web.** Um app web progressivo que funciona offline depois que o service worker coloca em cache as ferramentas e os recursos. Não exige conta; o estado fica no IndexedDB de cada dispositivo. Um único layout responsivo atende desktop e celular: no celular, os controles viram uma folha e os controles de exportação abrem a partir de uma pílula flutuante.
- **Os apps desktop e mobile.** Pacotes Tauri do mesmo app web, com diálogos de arquivo nativos, estado no sistema de arquivos e uso offline completo.
- **A CLI.** `lolly <tool-id> --input=value --output=file.png` carrega o mesmo motor em um DOM sem interface e grava o arquivo. É o modo URL sobre outro transporte, não uma implementação separada. Veja [CLI](/info/cli.html).
- **A TUI.** Um app de terminal em tela cheia, voltado ao teclado, que reaproveita a ponte da CLI, mantém as sessões salvas em disco (na pasta do próprio app desktop quando ele está instalado, ou então em `~/.lolly`) e só inicia um navegador sem interface restrito quando um formato exige. Veja [TUI](/info/tui.html).

![A visão dividida do desktop: controles gerados a partir do manifesto à esquerda, o canvas ao vivo à direita](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

A mesma ferramenta na largura de um celular não precisa de um segundo layout: os controles viram uma folha no topo e a prévia ocupa a tela.

![Um audiograma em uma tela de 430px de largura: a folha de controles acima, a arte quadrada final abaixo e a pílula de exportação flutuante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

O app web também traz o **Batch** (`#/batch`, `shells/web/src/pro/`), uma grade no estilo de planilha que renderiza muitas linhas de uma vez em uma ou várias ferramentas; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) trata do Batch. **Settings → Capabilities** mapeia tudo o que a plataforma declara que pode fazer.

![O Batch em uma instalação nova: uma linha vazia esperando uma ferramenta, com a superfície de planilha e o botão Render no lugar antes de qualquer dado chegar](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Compromissos arquiteturais

Estas decisões estão assentadas. Mudar qualquer uma delas é uma tarefa de grande porte, porque elas moldam todas as outras decisões do código.

### 1. Ferramentas declarativas, com uma válvula de escape imperativa

Uma ferramenta é um manifesto (`tool.json`), um template (`template.html`) e um `hooks.js` opcional. **O manifesto declara as entradas**, nunca o template: as entradas não são inferidas a partir de tokens do Handlebars. A maioria das ferramentas é só manifesto e template, e é isso que permite que pessoas sem formação em programação as criem.

![A pilha de controles do Street Map: um menu suspenso de cidades, um seletor de tema, controles deslizantes de espessura e gatilhos de cor, todos desenhados a partir de uma linha do manifesto](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

As ferramentas que calculam valores, como a codificação de QR ou a formatação de gráficos, acrescentam hooks: funções de ciclo de vida nomeadas que o runtime chama com a ponte de capacidades injetada. Os hooks são um contrato de portabilidade, não um sandbox de segurança, e rodam dentro de um orçamento de tempo. As ferramentas cujos hooks comprovadamente não usam globais da página carregam `isolate: true` e rodam em um Worker. [Tool hooks](/info/tool-hooks.html) traz o ciclo de vida e os orçamentos, e o [Threat Model](/info/threat-model.html) diz o que o executor dentro da página contém e não contém.

### 2. Ferramentas e assets são dados, não código empacotado

Os apps web e Tauri buscam os catálogos de ferramentas e de recursos na inicialização, colocam em cache e trabalham com o que estiver lá, então uma nova ferramenta ou recurso não exige lançamento de app. Os bytes dos recursos têm checksum SHA-256, e o `id` e a `version` de um recurso conduzem a invalidação do cache.

### 3. A ponte de capacidades é a única API que as ferramentas veem

As ferramentas nunca tocam o DOM fora do template, nunca chamam `fetch` diretamente e nunca leem o sistema de arquivos. Elas chamam métodos `host.*` versionados. A definição canônica do contrato está em `packages/core/src/host-v1.ts`, o SDK para autores de ferramentas `@lolly-tools/core`, para que um terceiro possa desenvolver sobre ele sem depender do motor; o `engine/src/bridge/host-v1.ts` reexporta seus tipos.

| API obrigatória | O que faz |
|---|---|
| `host.profile` | Os dados do usuário; preenche entradas por meio de `bindToProfile` |
| `host.assets` | Consultas ao catálogo, resolução de recursos e o seletor do host |
| `host.state` | Salvar e carregar slots de entrada: IndexedDB na web, sistema de arquivos no Tauri, memória na CLI |
| `host.clipboard` | Gravar texto ou uma imagem na área de transferência, com alternativas por plataforma |
| `host.export` | Rasterizar ou serializar o alvo de renderização, e o caminho de transformação de arquivos no dispositivo |
| `host.log` | Registro em log com níveis para o host |

Todas as outras APIs são opcionais e aditivas: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` e muitas mais. O manifesto de uma ferramenta lista em `requires` as APIs opcionais que os hooks chamam sem verificar antes, e um host que não tem uma delas se recusa a montar a ferramenta; os hooks detectam o resto por feature detection. Algumas, como `recorder`, também exigem uma capacidade de dispositivo que a ferramenta declara. O `packages/core/src/host-v1/apis.ts` lista todas e [Host API](/info/host-api.html) documenta cada uma. Adicionar um método é uma versão menor; removê-lo ou alterá-lo é uma versão maior, e a v1 continua funcionando quando a v2 for lançada.

### 4. Os ids de recursos são para sempre

`lolly/logo/primary` é um contrato. Depois de publicado, um id nunca muda e nunca é reutilizado. Uma mudança nos bytes aumenta o `version` na entrada do recurso, e uma substituição define `deprecated: true` e, opcionalmente, `replacedBy`, para que as referências existentes sempre sejam resolvidas. É isso que mantém sessões salvas e links compartilhados funcionando por anos.

### 5. O modo URL é de primeira classe

Toda entrada pode ser expressa como parâmetro de URL, então um link é um arquivo pronto:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Esse link, sozinho, sem mais nada, é o arquivo pronto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Mude um parâmetro e você tem outro arquivo. Esta paleta inteira é uma cor-semente, uma harmonia e um número de passos:

![Nove passos em quatro tons, todos derivados da cor-semente única transportada no link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

A CLI monta o mesmo estado de URL a partir dos argumentos e executa o mesmo pipeline, então a CLI não pode divergir do app. O `engine/src/url-mode.ts` faz a análise e a serialização; um conjunto de nomes reservados (`format`, `width`, `dpi`, `c2pa`, `z` e outros) nunca é passado a uma ferramenta, e [Reserved URL parameters](/info/url-parameters.html) os lista todos. As entradas de recursos viajam por `id` e são resolvidas por `host.assets.get()` antes de o template ser preenchido.

### 6. O armazenamento passa pela ponte

O app web usa o IndexedDB, o Tauri usa o sistema de arquivos e a CLI usa a memória. As ferramentas veem apenas `host.state.save(slot, data)` e `host.state.load(slot)`, nunca o `localStorage`. As pessoas podem manter várias sessões nomeadas por ferramenta, sem conta. Como a ponte é a única junção, esse estado também é portátil: o `shells/web/src/data-transfer.ts` o lê de volta em um único arquivo `lolly-backup` que pode ser importado em qualquer outra instalação ([Data transfer](/info/data-transfer.html)), e o [Sync](/info/sync.html) envia o mesmo pacote para o armazenamento que a pessoa escolher.

### 7. As tags de maturidade dizem o que uma ferramenta é

Toda ferramenta declara `status: official | community | experimental`. A galeria ordena por status, e as ferramentas experimentais marcam suas exportações com marca d'água por padrão: o runtime ativa a marca d'água, a menos que quem chama passe `watermark: false`, e as ferramentas no dispositivo são isentas. Qualquer processo que uma equipe coloque em torno do catálogo fica por cima disso.

### 8. As entradas são tipadas no manifesto

Uma entrada declara um `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` ou `file`. O host renderiza um controle por tipo, então as ferramentas não escrevem código de controle, e qualquer entrada pode levar `bindToProfile`. Três têm mais peso:

- **`asset`**, com `filter` e `allowUpload`, é a ponte para o sistema de recursos. `allowUpload: false` limita um slot a recursos da biblioteca, e os envios do usuário compartilham o formato `AssetRef` da biblioteca.
- **`blocks`** é um grupo de campos repetido editado em um painel lateral, usado pelo Meeting Planner, Wayfinding, Diagrams e outros. Clicar em um bloco renderizado dá foco à linha dele.
- **`file`** guarda o arquivo do próprio usuário na memória para utilitários no dispositivo, como Strip Hidden Data e Compress, e **`vector`** agrupa um conjunto fixo de números em um único controle.

### 9. Os templates não têm lógica

Os templates são Handlebars, escolhido para que pessoas sem formação em programação possam escrevê-los: `{{x}}` escapa, e `{{{x}}}` é uma opção explícita. A lógica vive no `hooks.js`, onde é explícita e revisável. Muitos templates usam `{{{` para marcação que um hook calculou, então cada hook deve escapar o que entrega. Os helpers são `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` e `media`, mais `icsStamp`, `rfcText`, `csvCell` e `arrow` para templates irmãos `.ics`, `.vcf` e `.csv`. [Templates and rendering](/info/tool-rendering.html) os cobre.

### 10. Ferramentas compõem ferramentas

Uma ferramenta pode incorporar a renderização de outra sem importações entre ferramentas; o motor resolve a composição. Um manifesto pode declarar `composes: [{ id, tool, inputs }]` e posicionar a filha com `{{asset <id>}}`, e uma URL de incorporação portátil (`https://lolly.tools/tool/<id>.svg?…`) renderiza a filha localmente, que é como o Design posiciona um QR code ou gráfico ao vivo. Uma filha em SVG continua vetorial em um pai SVG ou PDF. As filhas são intermediárias, nunca recebem marca d'água nem carimbo, e um shell que não consegue renderizar uma deixa o slot vazio enquanto o pai ainda renderiza. [Composition and brand overlays](/info/tool-composition.html) traz os detalhes.

## O que escolhemos não fazer

- **Nada de JavaScript arbitrário nos templates.** A lógica vive no `hooks.js`.
- **Nenhum servidor de recursos obrigatório.** As pessoas adicionam os próprios arquivos em Assets no app e passam o trabalho adiante como uma sessão: um link de compartilhamento para entradas e configurações, um arquivo `.lolly` quando os envios também viajam. Uma sessão compartilhada pode virar um template no seletor de uma ferramenta. Uma organização que quer um catálogo governado pode usar o catálogo, as aprovações e as políticas do Lolly Work, ou gerenciar o pacote de marca no git e revisar as mudanças lá.
- **Nenhum controle de acesso forçado.** O app aberto é público por padrão, e as etiquetas de maturidade e as marcas d'água carregam o risco da marca. Login da organização, funções e políticas vêm do Lolly Work quando uma equipe os quer.
- **Nenhum banco de dados central.** O estado do usuário fica em cada dispositivo, e o Sync opcional o copia para o armazenamento que a pessoa escolher, nunca para um banco de dados do Lolly.
- **Nenhum caminho de código compartilhado entre as ferramentas e o motor.** O motor e as ferramentas da comunidade são de código aberto, e um pacote de marca como o privado `brands/suse/` traz as próprias ferramentas e o próprio catálogo sob termos próprios. Nenhuma ferramenta importa de `engine/`, então a separação se mantém limpa.

## O ciclo de vida de uma renderização

Alguém abre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Boot.** O app web abre o IndexedDB, monta a ponte de capacidades e sincroniza os catálogos de ferramentas e recursos, ou os carrega do cache quando está offline.
2. **Rota.** O caminho seleciona a tela da ferramenta `qr-code`, com a query como valores iniciais.
3. **Load.** O `loadTool` busca o `tool.json`, valida-o contra o schema e busca o template, os estilos e os hooks.
4. **Análise do link.** O `parseUrlState` transforma os parâmetros em valores de entrada. Uma referência a recurso como `?logo=lolly/logo/primary` vira um `{ id }` não resolvido.
5. **Início do runtime.** O `createRuntime(tool, host, initialValues)` monta o modelo de entradas a partir dos dados do perfil, dos padrões e do link, resolve as referências a recursos, carrega os hooks e chama o `onInit`.
6. **Render.** O shell assina o runtime, desenha os controles a partir do modelo e grava o template preenchido em `#tool-canvas`.
7. **Interação.** Digitar chama `runtime.setInput`, que aplica as restrições, chama o `onInput`, preenche o template de novo e redesenha.
8. **Export.** **Download** chama `runtime.export(node, format)`, e o `host.export` do shell produz o arquivo: um raster, um vetor do DOM walker, um PDF, um documento ou um dos outros formatos em `schemas/tool.schema.json`. As unidades físicas são convertidas por formato, e os metadados e as Content Credentials são incorporados onde o formato pode guardá-los. As ferramentas experimentais recebem a marca d'água do host, não da ferramenta. [Templates and rendering](/info/tool-rendering.html) e [Export a file](/info/exporting.html) cobrem a etapa de exportação.

![O painel de exportação que ?options abre: o par nome de arquivo e formato, o tamanho de saída e os controles que gravam o arquivo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

O mesmo ciclo de vida roda no Tauri e na CLI com um DOM sem interface, onde a saída vai para um arquivo ou para o stdout.

## Licenças

O código, incluindo `engine/`, `shells/`, `services/`, `schemas/` e o gerador da documentação, é MPL-2.0, em um repositório público, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). A prosa da documentação é CC BY-SA 4.0. Os pacotes de marca trazem os próprios termos no `NOTICE.md` de cada pacote: as ferramentas da comunidade são MPL-2.0, e o pacote privado da SUSE é proprietário da SUSE. [About](/info/about.html) traz a nota completa de licenciamento.
