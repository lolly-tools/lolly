# Visão geral

![Ícone do Lolly - Pirulito grande verde e branco](/info/icon.svg)

Este documento registra o propósito, a estrutura e as decisões arquiteturais da plataforma Lolly. Ele reflete tanto a visão de produto quanto o estado atual da base de código.

> **Status:** o Lolly é um protótipo interno em um **piloto fechado que ainda não foi concluído**. O motor é determinístico e internamente consistente, mas o produto é inicial - a SUSE é a cliente número um - e seus motores de criptografia e de análise de arquivos estão atualmente passando pelo rigoroso endurecimento de infraestrutura da SUSE, preparando-se para a escala corporativa (somos muito bons nisso). Leia a arquitetura abaixo como intenção de design em teste, não como um produto acabado e certificado. Veja [Adoção e Governança](/info/adoption-governance.html#status) para saber como o piloto é conduzido e medido.

> **Como ler esta página.** Ela traz dois tipos de conteúdo, em ordem. A primeira metade é
> **por que isso existe**: o problema, o posicionamento e o ciclo de vida que um único asset
> percorre. A partir de [O panorama geral](#the-big-picture-how-the-layers-fit) em diante é
> **como as camadas se encaixam**: o documento de arquitetura para contribuidores, cobrindo a
> separação engine/shell/pack, a organização do repositório, os alvos de entrega e os compromissos
> que limitam toda mudança na plataforma. Se você está aqui para mudar a base de código em vez de
> entender o produto, comece pelo panorama geral.
>
> Dois materiais complementares vão mais fundo do que esta página. O [`engine/README.md`](../engine/README.md)
> no repositório é o mapa módulo a módulo do engine, com uma tabela gerada de cada módulo e o que
> ele analisa ou grava. [Modelo de Ameaças e Fronteiras de Confiança](/info/threat-model.html)
> é a mesma arquitetura lida como fronteiras de confiança, e é a página certa para qualquer pergunta
> sobre o que o engine trata como não confiável.

---

## Por que isso existe

Equipes enfrentam um problema recorrente: trabalho criativo e de conteúdo repetível que é previsível demais para justificar mãos especializadas toda vez, mas sensível demais em qualidade para ser delegado sem parâmetros de proteção. O resultado é vazão lenta (gargalo do especialista), inconsistência (pessoas usando qualquer ferramenta que tiverem) ou dependência de fornecedor (um DAM SaaS que controla seus templates).

Esta plataforma é a resposta direta:

> **Criação e conteúdo programáticos em escala** - geração de assets sem esforço manual, com as regras sob controle central, para funcionários, fornecedores e parceiros.

A Lolly não é onde um sistema de design é inventado - é onde ele é produzido. Pense nela como uma máquina de vendas automática para design: faça uma seleção, receba um resultado. Toda vez. O engine busca a maior qualidade que cada formato consegue produzir no hardware à sua frente, e o mesmo engine gera o mesmo arquivo em cada superfície para a qual ele é distribuído.

O resultado é **abundância**: todo evento tem a sinalização correta, todo alerta de CVE segue o estilo da casa, toda etiqueta imprime limpa, toda assinatura de e-mail está atualizada - tudo sem um chamado de design. A plataforma trata do criativo operacionalizado e recorrente. Deliberadamente não é uma ferramenta criativa sob medida - os designers continuam donos do trabalho de destaque.

### Inove probabilisticamente, escale deterministicamente

Todo debate sobre IA em um pipeline criativo empaca na mesma pergunta: qual parte disso é trabalho da máquina? É uma pergunta antiga com resposta consolidada. Escribas e iluminadores já trabalhavam entre dois instrumentos - o esboço livre, onde nada estava fixo e tudo podia ser tentado, e a prensa de impressão, intimidante justamente por se comprometer. Os esboços eram onde a arte acontecia. A prensa era como ela chegava a alguém. Ninguém confundia os dois, e ambos continuavam avançando - novas tintas, novos tipos, novas prensas - cada um evoluindo em harmonia com o ofício e a intenção que servia.

O Lolly traça a mesma linha. Explore probabilisticamente: um modelo, um designer, uma ideia solta, um prompt que vai para onde ninguém planejou. Depois escale deterministicamente - o que alcança dez mil resultados é uma *ferramenta*, e uma ferramenta renderiza da mesma forma todas as vezes a partir de entradas que você consegue ler. A exploração continua livre porque nada depois dela depende de acontecer igual duas vezes. O resultado ganha confiança porque não é um palpite. Levar a experimentação com IA a resultados previsíveis e reprodutíveis não é uma disciplina nova; é a mesma divisão de trabalho que tornou o material impresso confiável desde o início.

> Confie no processo criativo, escale com rigor.

### Contra as alternativas

::: figure positioning-comparison
Completude de capacidades entre as ferramentas criativas atuais, pesquisado em agosto de 2026. Pontuação: 0 ausente, 25 nível de solução alternativa, 50 real mas limitado ou parcial, 75 forte com ressalvas, 100 competência central.
:::

A lacuna é evidente: nada disponível hoje entrega saída com prioridade em restrições, capaz de funcionar offline, de baixa habilidade e acessível internamente. O Lolly até inclui um canvas aberto - o **Design** - onde cores, tipografia e assets seguem os globais da marca, então o arranjo livre continua com prioridade em restrições. O que ele **não** é é um pacote de design sem restrições: os designers continuam usando o Illustrator e o Figma para o trabalho de destaque sob medida. Permutações podem ser montadas com esta ferramenta.

![Toda ferramenta da biblioteca como um card, agrupado por categoria, para que um produtor escolha uma e comece](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Use para:** geração rápida de assets criativos operacionalizados - blocos de evento, crachás nominais, assinaturas, alertas de CVE, códigos QR, cards sociais, etiquetas de remessa, relatórios estruturados.

**Não use para:** conteúdo de destaque sob medida.

---

## O ciclo de vida de uma campanha

A forma mais clara de ver o que o Lolly é não é uma lista de recursos - é acompanhar um único asset passando de mão em mão. Observe um card de campanha localizado se mover pela organização:

1. **O criativo define as regras.** Um designer cria o template base na ferramenta Design, fixando no código as variáveis de tipografia e cor da marca. Ele não está fazendo um card só - está fazendo o trabalho fundamental *uma vez* para nunca mais precisar localizá-lo à mão.
2. **O desenvolvedor escala.** Esse mesmo template é conectado a um pipeline noturno via CLI, então um gráfico novo ou uma nova variante de idioma é gerado automaticamente - nenhum designer reabre o arquivo.
3. **O produtor simplesmente usa.** Um representante de vendas, offline em um avião, abre a mesma ferramenta e gera uma apresentação perfeitamente alinhada à marca para uma reunião com cliente. Sem habilidade de design, sem rede, sem espera.

O "gráfico novo" do passo dois é uma renderização como esta, produzida a partir de uma string de dados e alguns parâmetros sem ninguém abrir um arquivo de design:

![Um gráfico de área empilhada com título, suas três séries em faixas de uma paleta fria, com eixos, legenda e título posicionados pelo modelo em vez de manualmente](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

O ponto não é que o Lolly é bom para designers *e* bom para desenvolvedores *e* bom para vendas, cada um isoladamente. É uma **corrida de revezamento**: o trabalho inicial do criativo é escalado pelo desenvolvedor, que por sua vez capacita o produtor. A experiência sem esforço para o representante não técnico no avião só é *possível* por causa do rigor que o designer estabeleceu e o desenvolvedor implantou.

Esse é o multiplicador de força. O Lolly não é uma gaveta de ferramentas separadas para papéis separados - é um único ciclo de vida de asset determinístico que toda função toca, e cada mão por onde passa multiplica o valor da anterior.

---

## Uma aprovação, dez mil assets

Como a aprovação vive na ferramenta e não no arquivo (veja [Como o Lolly se compara](/info/positioning.html)), escalar deixa de ser um problema de revisão. Aprove uma ferramenta de card social localizado uma vez, depois gere **10.000 assets em 12 idiomas** a partir de uma planilha - e nenhum deles precisa de uma nova verificação de conformidade do jurídico ou da marca, porque o template do qual todos vêm já foi aprovado.

A mesma ferramenta determinística alcança essa escala de três formas, todas produzindo saída idêntica e pré-aprovada:

- <!--i:people--> **Uma pessoa, no app.** A grade em lote `/pro`: cole ou importe as linhas, receba um asset finalizado por linha, baixe o zip. Sem habilidade de design, sem chamado, sem espera.
- <!--i:code--> **Um desenvolvedor, pela linha de comando.** A CLI roda o *mesmo* engine e o *mesmo* caminho de renderização sem interface, então a ferramenta pode ser sequenciada por todas as 10.000 linhas em um script ou pipeline noturno. Uma chamada `lolly <tool> --field=…` em um loop é toda a integração.
- <!--i:cpu--> **Um sistema ou agente de IA, via MCP.** A mesma ferramenta operada programaticamente, com a mesma fidelidade e escala ainda maior - porque uma máquina não fica entediada enquanto milhares de arquivos vão chegando.

![O modo Batch em uma instalação nova: uma linha vazia esperando por uma ferramenta, com toda a superfície de planilha e seu botão Render já no lugar antes de qualquer dado chegar](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Um conjunto de restrições de marca, fixado uma vez por um designer; três caminhos para a mesma saída pré-aprovada - e o caminho da máquina escala mais longe de todos, porque nunca se cansa enquanto os arquivos vão chegando.

---

## O panorama geral: como as camadas se encaixam

Tudo a partir daqui é arquitetura. O diagrama é o sistema inteiro em uma única visão: as ferramentas são
dados no topo, o engine no meio não conhece nenhuma plataforma, os shells abaixo dele
implementam um único contrato, e os catálogos fornecem o conteúdo.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Organização do repositório

O conteúdo é montado como pacotes: `community/`, `docs/`, todo `shells/*`, ambos `services/*` e `brands/suse` são cada um seu próprio repositório, obtidos como submódulos git deste. O pai possui `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` e `profiles.json`. Veja [Guia de Build » Obtendo o código-fonte](/info/build-guide.html) para o comando de checkout e o fluxo de trabalho entre repositórios.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Modelo de entrega da plataforma

A plataforma roda em diversas superfícies - PWA web, Tauri desktop/mobile, a CLI programável e o TUI interativo. Todas elas usam o mesmo engine e os mesmos arquivos de ferramenta.

### Web (PWA) - distribuição principal
Hospedado em uma URL controlada pela SUSE. Funciona offline assim que o service worker armazenar em cache as ferramentas e os assets. É onde a maioria dos funcionários, fornecedores e parceiros vai usar a plataforma. Sem necessidade de conta - o estado é armazenado no IndexedDB por dispositivo.

O shell web é responsivo a partir de um único layout. No desktop, uma ferramenta é uma barra lateral de controles redimensionável ao lado de um palco de prévia com navegação de canvas nativa de trackpad (Cmd/Ctrl-roda ou pinça para dar zoom em torno do cursor, Espaço- ou arraste com o botão do meio para deslocar, teclas `0`/`1`/`+`/`−` e um HUD de Ajustar/%). No celular (≤640px), os controles viram uma folha ancorada no topo com uma alça de arraste que encaixa em espiada/metade/tela cheia (o toque alterna) sobre uma prévia estática em tela cheia, e um botão flutuante **Render** abre os controles de **Export** em um pop-up de folha inferior. O toque tem pinça-zoom e arraste-deslocamento na prévia. O caminho de renderização e os controles de exportação são idênticos nos dois - só o chrome se reorganiza.

![A visão dividida do desktop - controles gerados a partir do manifesto à esquerda, o canvas ao vivo à direita](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

A mesma ferramenta em largura de celular, sem um segundo layout para manter: os controles viram uma folha no topo, a prévia ocupa a tela inteira e o botão de renderizar flutua sobre ela.

![Um Audiogram em uma tela de 430px de largura - a folha de controles acima, a arte quadrada finalizada abaixo e a pílula flutuante de renderização](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Modo em lote (`/pro`).** O shell web também traz uma grade de lote no estilo planilha (`shells/web/src/pro/`) que renderiza muitas linhas de uma vez em uma ou várias ferramentas. Ela faz round-trip de CSV/TSV mais colar de planilha, template/formato/tamanho/unidade/dpi por linha, um painel lateral de editor de blocos com prévia ao vivo, colunas de exportação recolhíveis, uma barra de tags de "relevância" por linha, reordenação de linhas por alça de arraste à esquerda, confirmação de exclusão em duas etapas, sessões de lote salvas e um download em `.zip`. Essa é a superfície de um-para-muitos por trás do posicionamento de "geração de conteúdo em massa".

### Tauri desktop / mobile
App nativo empacotado (footprint pequeno via Tauri). Fornece disponibilidade offline completa, acesso ao sistema de arquivos para ferramentas dependentes de CLI (PDF Smasher, Font Outliner) e acesso à câmera. Aprimoramento de ferramentas programado para meados de 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Usuários de desktop podem invocar várias ferramentas pelo terminal. O shell da CLI carrega o mesmo engine, cria um DOM jsdom, executa o mesmo caminho de renderização e grava o arquivo. O modo URL é o transporte - a CLI não é uma implementação separada. Isso garante que as saídas da CLI e da GUI sejam idênticas.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

A contraparte interativa da CLI: um app de terminal em tela cheia, orientado por teclado (construído sobre Ink) para navegar por ferramentas, preencher entradas, salvar projetos e exportar - tudo sem uma GUI. Sua ponte de host **reaproveita a implementação da CLI** para os formatos sem DOM (SVG/EMF/EPS/HTML + texto/dados), e adiciona estado em disco em `~/.lolly` além de uma prévia inline opcional. Além disso, ela tem uma **camada de renderização via navegador**: um Chromium headless com escopo restrito (o mesmo que o servidor MCP instala) que produz raster/PDF/vídeo e captura de URL ao vivo sob demanda - operando uma cópia compilada do shell web para que a saída seja idêntica, e sendo iniciado apenas na primeira vez que você exporta um desses formatos. Assim, `url-shot` (com corte + recoloração + PDF/SVG vetorial) e toda ferramenta de raster/pdf também rodam no terminal. Veja o [guia da TUI](/info/tui.html).

Independente da superfície em que você está, a aba Capabilities do dashboard é o mapa completo do que a plataforma declara saber fazer, agrupado e legível sem abrir uma única ferramenta.

---

## Categorias de ferramentas

As ferramentas são marcadas com uma `category` no manifesto para agrupamento na galeria.

As linhas são listadas na ordem das seções da galeria. A seção `utility` sempre renderiza **por último** na galeria (depois de toda outra categoria, incluindo futuras) - é a gaveta on-device "Offline Utilities".

| Categoria | Exemplos | Planejado |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Conversores de unidade/formato, mais utilitários de privacidade no dispositivo |

Essas células são **exemplos, não inventários**. Quais ferramentas existem é uma propriedade do perfil que você montou, não desta página: um pacote de marca adiciona as suas próprias e pode excluir uma ferramenta da comunidade que prefira não distribuir. `catalog/tools/index.json` - gerado a partir dos manifestos, e o registro que a galeria de fato lê - é a lista autoritativa; para contar o que um perfil monta, conte os manifestos (`ls community/*/tool.json brands/*/tools/*/tool.json`) em vez de confiar em um número anotado aqui. (Um id de ferramenta presente em dois pacotes monta uma única vez, a partir do pacote vencedor.)

As ferramentas também são classificadas por status: `official` (aprovada pela marca, sem marca d'água), `community` (contribuição externa), `experimental` (exportações com marca d'água). A maior parte da biblioteca é `official`; os estúdios mais novos e as ferramentas de captura tendem a ficar em `community` ou `experimental` enquanto amadurecem. Toda superfície mostra o selo, então quem lê sabe o que está pegando antes de abrir a ferramenta - e, assim como as células de categoria acima, a composição por status muda rápido demais para enumerar aqui. Consulte a galeria ou o índice gerado.

**Design** é a primeira ferramenta construída sobre o modo de canvas livre `render.layout: "editor"` - uma superfície sem chrome, de manipulação direta, onde você arrasta, redimensiona, gira e encaixa caixas de texto, formas e imagens, depois exporta pelo mesmo caminho de renderização que toda outra ferramenta.

**Strip Hidden Data** é o primeiro **utilitário on-device** (`privacy: "on-device"`): uma ferramenta de transformação de conteúdo que pega um arquivo fornecido *por você*, processa tudo no navegador e devolve uma cópia limpa - nunca enviada, nunca marcada com marca d'água, sem carimbo de proveniência. **Text Helper** é o segundo - uma bancada on-device para tarefas cotidianas de colar-em-um-site (formatação de JSON, decodificação de JWT, Base64, codificação/decodificação de URL, hashing SHA). **Compress PDF** é o terceiro - ele reduz um PDF recomprimindo suas imagens, também inteiramente on-device. O marcador e o texto do seu selo "Roda no seu dispositivo - nada é enviado" agora cobrem todo o conjunto de transformações: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (destruir regiões de uma imagem, SVG ou PDF), **Prompt to Image** e **Rebrand a Deck** (retematizar um `.pptx` no lugar) onde o perfil o monta. Essa é uma categoria de utilitários de privacidade que substitui a entrega de arquivos confidenciais a sites de propósito único.

![A gaveta Utilities, onde cada card é uma ferramenta que transforma um arquivo que você já tem](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Nota: `category` e `status` são desnormalizados em `catalog/tools/index.json` (o registro que a galeria lê) a partir de cada `tool.json`. O manifesto é a fonte da verdade - o índice é **gerado** por `npm run build:catalog` e `npm run validate:catalog` falha o CI se o índice commitado divergir dos manifestos.

---

## Compromissos arquiteturais

Essas decisões estão fechadas. Mudar qualquer uma delas é um empreendimento de grande porte - elas moldam toda outra decisão na base de código.

### 1. Ferramentas declarativas, com uma válvula de escape imperativa

Uma ferramenta é um manifesto (`tool.json`) + um template (`template.html`) + `hooks.js` opcional.

**O manifesto declara as entradas.** Não o template. As entradas não são inferidas de tokens Handlebars. O manifesto é o contrato; o template consome variáveis nomeadas por `{{id}}`.

![A pilha de controles do Street Map - um dropdown de cidade, uma seleção de tema, sliders de peso e gatilhos de cor, cada um deles vindo de uma linha do manifesto](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Os hooks são opcionais.** A maioria das ferramentas é puramente declarativa - manifesto + template já bastam. Ferramentas que precisam de valores computados (codificação de QR, formatação de dados de gráfico) fornecem `hooks.js` expondo funções de ciclo de vida nomeadas (`onInit`, `onInput`, `onFrame` - o hook de câmera ao vivo por quadro para ferramentas reativas a movimento - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - o caminho de transformação arquivo-entra/arquivo-sai usado por utilitários on-device como o Strip Hidden Data - e `exportStill`, para uma ferramenta que possui sua própria renderização raster profunda). O host carrega os hooks via `new Function('host', …)` com a ponte de capacidades injetada como escopo de closure. Isso é um **contrato de portabilidade, não um sandbox de segurança**: os hooks ainda rodam no realm da página e *podem* alcançar `window`/`fetch`/`document` em um shell de navegador - `host.*` é a superfície suportada e portável, não uma fronteira imposta. Resultados assíncronos de hooks têm prazo limitado (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) e resultados tardios são descartados; um hook *síncrono* fora de controle não pode ser interrompido. Código de hook de terceiros não confiável, portanto, não é seguro de rodar até que o isolamento por Worker seja lançado.

Isso importa porque: ferramentas declarativas podem ser criadas por não desenvolvedores. Se toda ferramenta fosse um web app, a nota de risco "habilidades limitadas para criar/manter templates de uso diário" vira um gargalo permanente.

### 2. Ferramentas e assets são dados, não código empacotado

Os apps web e Tauri buscam catálogos de ferramentas e assets de uma URL conhecida na inicialização, fazem cache local e operam sobre o que estiver lá. **Adicionar um novo card de evento ou asset sazonal não exige um lançamento de app.**

Os bytes dos assets têm checksum SHA-256 para evitar envenenamento de CDN. O `id` + `version` do asset conduz a invalidação de cache.

### 3. A Capability Bridge é a única API que as ferramentas veem

As ferramentas nunca tocam o DOM fora da área do seu template, nunca chamam `fetch` diretamente, nunca leem o sistema de arquivos. Elas chamam métodos versionados `host.*`. A definição canônica do contrato é `packages/core/src/host-v1.ts` - o SDK para autores de ferramentas `@lolly-tools/core`, para que terceiros possam construir contra ele sem depender do engine; `engine/src/bridge/host-v1.ts` é uma reexportação de tipo dele, e o código do engine/shells continua importando desse caminho sem mudanças:

| API da ponte | O que faz |
|---|---|
| `host.profile` | Nome, e-mail, foto, cidade etc. do usuário. Pré-preenche entradas via `bindToProfile`. |
| `host.assets` | Consultas ao catálogo, resolução de assets, UI de seleção fornecida pelo host. |
| `host.state` | Salvar / carregar slots de entrada. IndexedDB na web, sistema de arquivos no Tauri, memória na CLI. |
| `host.clipboard` | Escrever texto ou imagem na área de transferência (com fallbacks de plataforma). |
| `host.export` | Rasterizar ou serializar o alvo de renderização. Aplica marca d'água para ferramentas experimentais. |
| `host.net` | Fetch com lista de permissões - disponível somente se a ferramenta declarou a capacidade `"network"`. (Nenhuma ferramenta em produção usa isso atualmente.) |

Superfícies opcionais e aditivas aparecem apenas quando um shell as fornece. Algumas são **restritas por capacidade** - expostas somente quando a ferramenta declara a flag correspondente: `host.compose` (embutir a renderização de outra ferramenta - `compose`), `host.capture` (captura de página para o URL Screenshot - `capture`) e `host.recorder` (captura de microfone/câmera/tela para as ferramentas de gravação - `microphone` / `camera` / `screen`). O restante é **detectado por recurso** - presente sempre que o shell puder fornecê-lo, com a ferramenta mantendo um fallback para shells que não podem.

Um punhado de superfícies principais, para mostrar o que ela cobre - [Host API](/info/host-api.html) documenta cada uma delas, e `packages/core/src/host-v1.ts` é o próprio contrato:

| Superfície | Desde | O que adiciona |
|---|---|---|
| `host.tokens` | 1.0 | Tokens de design DTCG - os primitivos da própria marca |
| `host.text` | 1.0 | Texto para caminho (text-to-path) via HarfBuzz WASM (a flag de capacidade `wasm` sinaliza as ferramentas que dependem disso) |
| `host.media` | 1.4 | Quadros de câmera ao vivo acionando o hook `onFrame`. Aprimoramento progressivo, deliberadamente *não* condicionado pela flag `camera` - essa ferramenta continua funcionando como uma ferramenta comum de imagem estática |
| `host.color` | 1.40 | Matemática de cor perceptual: ΔEOK, contraste WCAG + APCA, rampas OKLab, class-breaks, paletas categóricas, esquemas de harmonia (1.60), mistura CSS Color 4 e bake de gradiente (1.68). Pura e síncrona - os shells anexam o `makeColorApi()` do engine em vez de implementar qualquer coisa, então não pode haver divergência |
| `host.images` | 1.60 | Decodifica / redimensiona / recodifica bytes no dispositivo - o caminho de conversão (HEIC → JPEG, compressão para WebP, downscale). Entregue no shell web como uma fachada preguiçosa (lazy facade), para que o decodificador HEIC nunca entre no chunk de boot |
| `host.geom` | 1.64 | Geometria vetorial exata: booleanos de caminho, offsetting, stroke-to-fill, rebaixamento de splines, simplificação, hit testing. Também pura, síncrona e anexada a partir do engine (`makeGeomApi()`); falhas são *retornadas*, nunca lançadas (thrown) |

O restante segue as mesmas regras e é documentado junto com elas: `pdf` (1.8) e `pptx` (1.58) para cirurgia de documentos on-device, `audio` (1.71) e `speech` (1.96) para análise de clipe e TTS/transcrição on-device, `viz` (1.72) para o contrato placeholder do MilkDrop, `codec` (1.100) e `layers` (1.102) para saída de bits profundos e bitmap em camadas, `upscale` (1.101) e `matte` (1.103) para os modelos on-device, `raster` (1.105) para hooks que fazem seu próprio trabalho de pixel, `connectors` (1.106) para setas seguras para exportação e `c2pa` (1.85) para assinar bytes finalizados. A contagem cresce; as regras não.

As capacidades declaráveis são: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, adicionada na 1.54, é captura de tela via `host.recorder` - o usuário escolhe uma tela/janela/aba na UI nativa do navegador; distinta de `capture`, que rasteriza uma URL que a própria ferramenta nomeia.)

A mesma ferramenta roda no navegador, no Tauri e na CLI headless porque cada shell implementa essa interface - a ferramenta nunca sabe em qual está.

A ponte é versionada. Adicionar métodos é uma versão menor. Remover ou mudar assinaturas é um salto de versão maior. Quando a v2 for lançada, a v1 deve continuar funcionando.

### 4. IDs de asset são para sempre

`suse/logo/primary` é um contrato. Uma vez publicado:
- O ID nunca muda, nunca é reutilizado.
- Mudanças de byte → incrementa `version` no manifesto.
- Substituído por um novo asset → define `deprecated: true` e opcionalmente `replacedBy`.
- Referências existentes sempre resolvem.

Isso torna os estados de ferramenta salvos e os links compartilhados por URL duráveis ao longo dos anos.

### 5. O modo URL é de primeira classe

Toda entrada precisa ser expressável como um parâmetro de URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Esse link sozinho, sem mais nada nele, é o asset finalizado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

O modo CLI é o modo URL sob um transporte diferente - o shell da CLI constrói um objeto de estado de URL a partir do argv e roda o **mesmo** pipeline do engine. Existe um único caminho de renderização. A CLI não pode divergir da GUI porque não é uma implementação separada.

`url-mode.ts` cuida do round-trip (parse e serialize). Um conjunto de **parâmetros reservados** nunca é repassado à ferramenta como entradas: os controles de saída (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), os controles de impressão e proveniência (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) e os portadores de estado (`template`, `z` - o token compactado do "Shortest link" - e `zx`, o mesmo criptografado com senha). O conjunto `RESERVED` em `engine/src/url-mode.ts` é a autoridade e é fixado por um teste; [URL Mode](/info/url-mode.html) documenta cada um deles, incluindo os poucos não listados aqui. As entradas de asset no modo URL são serializadas pelo seu `id`; o runtime as resolve via `host.assets.get()` antes da hidratação. `width`/`height` são valores em `unit` (padrão `px`, também `mm`/`cm`/`in`/`pt`/`pc`); com uma unidade física, `dpi` define a resolução de raster. Eles definem o tamanho do documento no canvas e pré-preenchem o painel de dimensões de exportação.

Como toda entrada viaja no link, uma mudança de parâmetro é um asset finalizado diferente. Toda essa paleta é uma cor semente, uma harmonia e uma contagem de passos:

![Nove passos em quatro tons, todos derivados da cor-semente única transportada no link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. O armazenamento passa pela bridge, não é direto

Web shell: IndexedDB. Tauri: sistema de arquivos. CLI: em memória. As ferramentas veem apenas `host.state.save(slot, data)` e `host.state.load(slot)`. `localStorage` não é usado - é pequeno demais e não consegue armazenar blobs.

Os usuários podem salvar múltiplos slots de edição nomeados por ferramenta e retomar cada sessão depois. Não é necessário criar conta; o estado é por dispositivo. Como a bridge é o único ponto de passagem, esse estado por dispositivo também é *portátil*: `shells/web/src/data-transfer.ts` lê tudo de volta via `host.profile`/`host.state`/`host.assets` para um único zip `lolly-backup` que pode ser importado em qualquer outra instalação - a resposta offline para "mudar de dispositivo" que não precisa de servidor (especificação completa: `docs/data-transfer.md`). A integração com o SUSE ID (sincronização multidispositivo) é um marco futuro construído em cima disso.

### 7. As tags de maturidade respondem ao risco de "aprovação de marca" por design

Toda ferramenta declara `status: official | community | experimental` no seu manifesto. A galeria ordena por status. Ferramentas experimentais aplicam marca d'água nas exportações automaticamente - a marca d'água é aplicada por `host.export.render`, não pela ferramenta, então não pode ser desativada por um autor de ferramenta não oficial.

Esta é uma resposta estrutural ao risco de percepção de que usar qualquer ferramenta implica aprovação de marca. Respostas de processo (uma fila de revisão, controle de acesso via SUSE ID) se somam a isso.

### 8. As entradas de ferramenta são tipadas via o manifesto, incluindo assets

As entradas declaram um `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` e `file`. O host renderiza um controle genérico por tipo a partir do manifesto - as ferramentas não escrevem nenhum código de controle. (Preencher previamente a partir do perfil do usuário não é um tipo - qualquer entrada pode carregar `bindToProfile`.) Três têm mais peso que as demais:

- **`asset`** (com `filter` e `allowUpload`) é a ponte para o sistema de assets global; `allowUpload: false` é a alavanca de aplicação de marca para casos como logos de patrocínio, onde apenas assets da biblioteca são permitidos. Uploads do usuário usam a mesma forma `AssetRef` que os assets da biblioteca, então as ferramentas os tratam de forma idêntica.
- **`blocks`** é um grupo de campos repetível - uma minitabela dentro de uma entrada, editada em um painel lateral, com um menu de adição tipado/discriminado e campos de asset por bloco. Clicar em um bloco renderizado no canvas foca a linha desse bloco. Usado por `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` e `digi-ad`.
- **`vector`** agrupa um conjunto fixo de números (por exemplo, uma transformação) em um controle composto único; **`file`** mantém o próprio arquivo do usuário como bytes em memória para utilitários de transformação no dispositivo (por exemplo, `strip-data` e `compress-pdf`).

### 9. Os templates não têm lógica (Handlebars, não EJS)

O Handlebars foi escolhido em vez do EJS deliberadamente:
- Sem lógica. Templates podem ser criados por não desenvolvedores.
- Seguro por padrão. `{{x}}` faz escape de HTML; `{{{x}}}` é bruto por opção explícita.
- Não haver JS arbitrário nos templates significa nenhuma superfície de auditoria de XSS por template.

A lógica vive em `hooks.js`, onde é explícita e revisável. Helpers Handlebars disponíveis: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (além dos helpers de formato de dados `icsStamp`/`rfcText`/`csvCell` usados pelos templates irmãos `.ics`/`.vcf`/`.csv`).

### 10. Ferramentas compõem ferramentas

Uma ferramenta pode incorporar a renderização de **outra** ferramenta sem imports entre ferramentas - a composição é resolvida pelo engine, nunca pelo código da ferramenta. Há duas superfícies:

- **Manifesto declarativo** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. O engine renderiza o filho nomeado e coloca o resultado no template sem lógica como `{{asset <id>}}`. `event-name-badge` compõe `qr-code` como SVG hoje.
- **URL de incorporação portátil** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. O shell renderiza esse filho **localmente** (um pixel de espaço reservado aparece até que a renderização local seja resolvida); nada é jamais buscado de `lolly.tools`.

Compõe a renderização de qualquer ferramenta: um filho em **SVG** permanece um vetor verdadeiro quando o pai exporta para SVG ou PDF e rasteriza com nitidez para PNG; filhos **PNG/JPG/WEBP** são incorporados como imagens. Requer a capacidade `compose`. Os filhos compostos são intermediários - nunca recebem marca d'água ou carimbo de proveniência - e a composição se degrada com elegância: um shell que não consegue renderizar um filho simplesmente omite o slot e o pai ainda assim renderiza.

---

## O que escolhemos explicitamente não fazer

- **Sem EJS / sem JS arbitrário em templates.** A superfície de XSS é zero. A lógica fica em `hooks.js`.
- **Sem CMS de ativos obrigatório.** Cada pessoa importa seus próprios arquivos criativos direto para o catálogo dentro do aplicativo (a visão [Catálogo](/info/using.html) e o Brand Studio) - sem servidor, sem console de administração. O trabalho é repassado como uma **sessão**: um link de compartilhamento carrega todo o estado, e a mesma sessão viaja em um backup ou por uma sessão de colaboração. Quem controla a implantação pode então travar uma sessão compartilhada como um **template** - abrir o link, registrar seus valores como uma entrada de template no diretório dessa ferramenta no pacote de marca e fazer o commit - depois disso ela aparece no seletor "New from template" da ferramenta e pode ser acessada por link direto como `?template=<id>`. O Git é a etapa de travamento de quem detém a implantação, nunca do criador. Para um catálogo *compartilhado e governado*, uma organização **pode** gerenciar o diretório de ativos da mesma forma e condicionar atualizações à revisão de PR - um modelo de governança disponível, não uma exigência do aplicativo.
- **Sem RBAC forçado.** O aplicativo aberto é de acesso público por padrão; o risco de marca é gerenciado por tags de maturidade + marcas d'água. Uma organização que quer controle mais rígido adiciona sua própria autenticação e o catálogo revisado por Git acima.
- **Sem banco de dados central.** Todo o estado do usuário é por dispositivo. A integração com SUSE ID está no roadmap, mas não é um bloqueador de lançamento.
- **Sem caminho de código compartilhado entre ferramentas/engine.** O engine é de código aberto, assim como as ferramentas agnósticas de marca em `community/`; um pacote de marca como o `brands/suse/` privado carrega suas próprias ferramentas e catálogo sob seus próprios termos. De qualquer forma a separação é aplicada (nenhuma importação cruzada de `engine/` para conteúdo de ferramenta), para que a divisão permaneça limpa.

---

## Ciclo de vida, do início ao fim

Um usuário abre `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** O web shell abre o IndexedDB, constrói a bridge de capacidades, sincroniza os catálogos de ferramentas e assets (ou carrega do cache quando offline).
2. **Roteamento.** O hash da URL → visão `tool`, com `qr-code` e os parâmetros de URL extraídos.
3. **Carregamento.** `loadTool('qr-code', fetchFile)` busca `tool.json`, valida contra o JSON Schema, busca `template.html`, `styles.css` e o código-fonte de `hooks.js`.
4. **Análise do estado da URL.** `parseUrlState` traduz os parâmetros de URL em valores de entrada iniciais. Referências de asset (`?logo=suse/logo/primary`) são interpretadas como objetos leves `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` constrói o modelo de entradas (mesclando dados de perfil, padrões e valores iniciais), resolve referências de asset via `host.assets.get()`, carrega os hooks (`host` com escopo de closure, não isolado em sandbox), chama `hooks.onInit`.
6. **Renderização.** O shell se inscreve no runtime; a cada mudança de estado recebe `{ model, hydrated }`. Ele renderiza os controles de entrada a partir do modelo e grava o HTML do template hidratado em `#tool-canvas`.
7. **Interação.** O usuário digita em uma entrada → `runtime.setInput(id, value)` → restrições aplicadas → `hooks.onInput` chamado → re-hidratação → nova renderização. O canvas atualiza ao vivo.
8. **Exportação.** O usuário clica em Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasteriza via dom-to-image-more; SVG/PDF passam por vetorizadores dedicados que percorrem o DOM) → blob → `host.export.download`. A gama de formatos que uma ferramenta pode adotar é ampla, e o enum `render.formats` em `schemas/tool.schema.json` é a autoridade sobre isso - rasters e float rasters, vetores e arquivos de corte, impressão/CMYK, movimento, documentos editáveis (`pptx`, `docx`, `odt`), saídas de paleta e dados/texto, arquivos de áudio e fonte. [URL Mode](/info/url-mode.html) nomeia todo id e o que ele produz. O áudio está nesse enum como qualquer outro (`wav`, `mp3`, `m4a`, `opus`, declarado pelo audiogram e pelas ferramentas de gravação); separadamente, o modo `render.capture` de uma ferramenta de gravação aciona `host.recorder`, cuja captura chega como um Blob finalizado no contêiner que o navegador gravou. (Ferramentas que definem `render.export: false` - por exemplo, Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - ocultam os controles de download/formato/dimensão.) As unidades físicas são convertidas por formato aqui (PDF → pontos de página reais, raster → pixels no DPI com um chunk `pHYs`). Metadados de autoria/proveniência (autor, ferramenta, fonte - construídos por `engine/src/metadata.ts`) são incorporados por formato: PNG iTXt, JPEG EXIF, dicionário de informações do PDF, `<metadata>` do SVG, comentário GIF. Ferramentas experimentais recebem uma marca d'água inserida pelo host, não pela ferramenta.

![O painel de exportação que `?options` abre: o par nome de arquivo e formato, o tamanho de saída e os controles que gravam o arquivo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Mesmo ciclo de vida no Tauri. Mesmo ciclo de vida no CLI - o jsdom fornece o DOM sem interface; a saída vai para um arquivo ou para o stdout.

---

## Status de código aberto

**O código é MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` e `docs/` são código aberto sob a **MPL-2.0** - uma plataforma de scaffolding neutra em relação a fornecedores para ferramentas de marca, com cada unidade distribuível em seu próprio repositório em [github.com/lolly-tools](https://github.com/lolly-tools).

**O conteúdo das ferramentas é distribuído como pacotes de marca**, cada um com seus próprios termos (veja o `NOTICE.md` do pacote). `community/` é o repositório público [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) e suas ferramentas agnósticas de marca também são MPL-2.0. `brands/suse/` é o pacote privado `suse-lolly`: as ferramentas SUSE e o catálogo SUSE, **proprietários da SUSE**, incluindo sua música licenciada da PremiumBeat. `brands/lolly-start/` é a marca inicial em branco que este repositório possui. As fontes são distribuídas dentro de um pacote sob a **SIL Open Font License 1.1** - o pacote SUSE carrega as famílias tipográficas SUSE e SUSE Mono.

As pastas `tools/` e `catalog/` na raiz do repositório são *visões* ignoradas pelo git: um perfil as monta a partir de `community/` mais o pacote de marca ativo, e é por isso que todo script e shell lê esses dois caminhos e nunca um pacote diretamente.

A separação é aplicada - não há importações cruzadas de `engine/` para o conteúdo das ferramentas - então o limite entre plataforma e conteúdo permanece limpo.

---

## Onde o engine termina e o host começa

Se você consegue descrever em dados puros + Handlebars → **engine**.
Se toca o DOM, o sistema de arquivos, a rede ou qualquer API de navegador/SO → **host**.

A linha é nítida de propósito. O engine é a parte open source. Tudo que conhece a SUSE, plataformas específicas ou ambientes de execução fica de fora dele.

Para o próximo nível de detalhe, [`engine/README.md`](../engine/README.md) enumera todo módulo do engine e pelo que ele é responsável, e [Threat Model & Trust Boundaries](/info/threat-model.html) registra onde essa mesma linha também funciona como fronteira de confiança.
