# Exportar um arquivo

Você criou algo e isso precisa sair do Lolly: um PNG para um chat, um PDF para a gráfica, um deck que um colega vai continuar editando. Pressione **Export**, a metade esquerda da pílula **Export | Save**. Escolha um formato ao lado do nome do arquivo e depois pressione **Download**. O arquivo é feito no seu dispositivo.

O que você vê no canvas é o que o arquivo contém. O menu de formatos lista apenas o que esta ferramenta consegue gerar neste navegador.

Para a maioria dos trabalhos, um de três formatos é o certo:

| Para | Escolha | Porque |
|---|---|---|
| Uma tela, uma mensagem ou um slide | **PNG** | Todo aplicativo abre, e mantém um fundo transparente quando a ferramenta oferece um |
| Uma página finalizada, ou qualquer coisa impressa | **PDF** | Um tamanho de página real que imprime como se vê; **Print PDF**, quando uma ferramenta oferece, é a versão CMYK para gráfica |
| Arte que precisa ficar nítida em qualquer tamanho | **SVG** | Formas vetoriais, nítidas de um selo a uma faixa |

::: check Confira o arquivo no tamanho em que será usado
Antes de enviá-lo, abra-o na tela para a qual foi feito, ou imprima-o no tamanho real.
:::

::: details Aprovações e entrega com o Lolly Work (opcional)
Uma [organização que executa o Lolly Work](/info/organisation.html) pode governar quais formatos e configurações de exportação os membros dela veem. Onde a aprovação é exigida, **Request approval** substitui **Download**. Siga a política que a sua instância mostrar.

O Lolly Work também pode entregar um arquivo a destinos S3, WebDAV e HTTP configurados, com etapas de aprovação, recibos de entrega e um registro de auditoria. Enviar um arquivo para esse fluxo o manda ao serviço da organização; um download comum fica no seu dispositivo. Os destinos pessoais de Send e a entrega da organização são configurados separadamente.

Os operadores configuram isso com o [guia de entrega da organização](/info/work-delivery.html). Para renderizações e lotes em fila no servidor, veja [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Como a exportação funciona

Quando você exporta, o canvas da ferramenta é renderizado no formato que você escolheu e entregue como um download, ou colocado na sua área de transferência.

Três caminhos produzem um arquivo. A maioria das ferramentas **renderiza o canvas**. Os formatos de texto e de dados (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) são **gerados a partir do conteúdo da ferramenta** em vez de desenhados a partir da imagem. Os utilitários de privacidade como o *Strip Hidden Data* **transformam o arquivo que você escolheu**, no seu dispositivo, e o devolvem sem canvas, marca d'água nem metadados adicionados, porque já é o seu próprio arquivo.

![Três caminhos de exportação convergem em um arquivo final: renderizar o canvas, gerar texto ou dados a partir do conteúdo, ou transformar no dispositivo um arquivo escolhido.](/info/diagrams/concepts/three-export-paths.svg)

O painel de exportação oferece estas ações. O autor de uma ferramenta escolhe quais aparecem; o conjunto padrão é Copy, Download e Save.

- <!--i:download--> **Download** salva o arquivo. Se depois você não conseguir encontrá-lo, veja [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** coloca a imagem na sua área de transferência, pronta para colar em um chat, um e-mail ou um documento. Onde um navegador não consegue copiar imagens, ele baixa e avisa você.
- <!--i:folder--> **Save** guarda o design atual em Projects com um clique e nunca baixa um arquivo. **Save as**, ao lado de **Download**, pergunta onde (veja [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** abre a caixa Share: um link que reproduz o design, as opções de ao abrir (tela cheia, painel de exportação, baixar ou copiar ao abrir) e um **Shortest link** opcional que compacta todo o estado em um token curto (veja [URL Mode](/info/url-mode.html)).

![O painel de exportação - formato, tamanho e as ações Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Quando um design incorpora a renderização de outra ferramenta, como uma caixa de imagem do Design que contém um link do QR Code, a renderização aninhada é desenhada na exportação do pai. Ela continua vetorial de verdade em SVG e PDF e é rasterizada com nitidez em PNG, JPG e WebP. A renderização incorporada não recebe marca d'água nem procedência própria; apenas o arquivo final recebe. As exportações em HTML, Markdown e TXT não conseguem conter uma renderização composta.

## Escolha um formato

O nome do arquivo e o menu de formato ficam juntos como um único par `name.format`, abaixo de **Baixar**.

![O campo de nome do arquivo fundido ao seletor de formato, para que a exportação seja lida como um único par name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Comece por onde o arquivo vai. Cada cartão lista os formatos adequados a esse destino; uma ferramenta mostra apenas os que consegue gerar.

::: figure exporting-format-chooser
Seis destinos e os formatos adequados a cada um.
:::

Um logotipo composto na fonte do seu sistema de design é exportado em SVG com cada letra como um caminho contornado, de modo que um único arquivo continua nítido no tamanho de um cartão de visita e no de uma empena de prédio.

![Um logotipo fino e de espaçamento largo que diz Aurora, o tipo de arte vetorial pura de que trata a linha SVG da tabela](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Todos os formatos e para que servem
| Você quer | Use | Por quê |
|---|---|---|
| Logotipos ou arte nítidos que escalam | **SVG** | Vetorial: escalável, pequeno e editável; um efeito que a exportação vetorial não consegue desenhar é incorporado como imagem |
| Vetor para Office e apps do Windows | **EMF** | Cola como vetor editável no PowerPoint e no Word, com texto vivo; o Google Drive o abre no Google Drawings |
| Vetor para impressão e apps de design | **EPS**, ou **EPS (CMYK)** | Vetor PostScript para Illustrator e fluxos de gráfica |
| Vetor para máquinas de corte | **DXF** | Cortadoras a laser, plotters de vinil e CNC: caminhos de contorno em milímetros |
| Um deck de slides editável | **PowerPoint** (PPTX) | Texto e formas nativos editáveis, com imagens e vetores que podem ser extraídos |
| Um documento de texto editável | **Word** (DOCX) ou **OpenDocument** (ODT) | Parágrafos e títulos reais que um processador de texto pode continuar editando (Doc Studio) |
| Um layout para o InDesign | **InDesign IDML (static subset)** | Texto, retângulos, ovais e imagens, uma página dupla por prancheta (Design) |
| Um documento Penpot editável | **Penpot** | Pranchetas, formas, texto e tokens vinculados |
| Uma foto ou imagem de uso geral | **PNG** (sem perdas) ou **JPG** (menor) | Raster universal |
| Imagens modernas menores | **WebP** ou **AVIF** | Melhor compressão, com transparência |
| Impressão | **PDF**, ou **Print PDF** (CMYK) | Tamanho de página real; CMYK para uma gráfica |
| Raster de impressão para uma gráfica | **Print TIFF** (CMYK) | Pixels DeviceCMYK para um RIP |
| Animado para a web | **GIF** | Roda em qualquer lugar; arquivos maiores |
| Animado com cor total e transparência real | **APNG** | PNG animado: sem limite de paleta |
| Animado, menor arquivo | **Animated WebP** | Cor total e transparência, menor que GIF ou APNG |
| Vetor animado que escala | **Animated SVG** | Autocontido; repete em loop em um navegador ou em um `<img>`, em qualquer tamanho (Lottie Ad) |
| Uma animação que continua editável | **dotLottie** | Formas, caminhos e chaves de transformação externas da linha do tempo do Design |
| Uma entrega para o Premiere | **Premiere XML + media** | Clipes cronometrados e mídia original para o Premiere (Design) |
| Vídeo para redes sociais e compartilhamento | **MP4** ou **WebM** | Melhor qualidade para o tamanho do arquivo (veja [Video](#video)) |
| Legendas | **SRT** ou **VTT** | Texto cronometrado para um player de vídeo (Captions, Audiogram e Record) |
| Um curso de treinamento | **SCORM (LMS)** | Um site versionado, ou um pacote SCORM ou xAPI (veja [SCORM](#scorm-course-packages)) |
| Texto formatado ou uma assinatura de e-mail | **HTML** | Cola formatado em clientes de e-mail |
| Conteúdo em texto simples | **MD** ou **TXT** | Somente texto |
| Um evento de calendário | **ICS** | Importa em qualquer app de calendário |
| Um cartão de contato | **VCF** | Importa em agendas de contatos |
| Dados estruturados para reimportar | **JSON** ou **CSV** | Faz o ciclo completo do conteúdo da ferramenta |
| Um favicon | **ICO** | Ícone de site com vários tamanhos; **ZIP** reúne vários formatos |
:::

### Transparência

As ferramentas que a aceitam oferecem uma chave de fundo transparente, como **No BG**. PNG, WebP, AVIF, SVG, APNG e Animated WebP mantêm a transparência, e o GIF mantém uma borda dura. JPG e PDF são sempre opacos. O TIFF achata sobre branco, ou sobre preto no caminho HDR descrito em [HDR](#hdr-bright-colours).

## Tamanho e unidades de impressão

As exportações usam o tamanho de pixels nativo da ferramenta, a menos que ela ofereça **dimensions**. Então você define largura, altura e uma **unit**:

- **px** (o padrão) são pixels exatos.
- **mm, cm, in, pt** e **pc** são tamanhos físicos. Com uma unidade física, você também define o **DPI** (300 por padrão). Um **PDF** vira uma página real nesse tamanho, um **raster** recebe a contagem de pixels para esse DPI e registra a resolução, e um **SVG** mantém a unidade física com um viewBox em pixels.

Para um raster de resolução maior, digite uma largura e altura maiores, ou escolha uma unidade física e aumente o DPI (pixels = tamanho × DPI). Largura `210`, altura `297` e unidade `mm` formam uma página A4.

![A linha de dimensões definida como 210 por 297 mm, com o campo DPI revelado porque a unidade é física](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Imagens estáticas a partir de uma composição temporizada

Uma composição cronometrada, como uma linha do tempo [Sequence](/info/sequence-editor.html) no Design, se move, então uma exportação estática precisa escolher um momento: **o quadro no cabeçote de reprodução**. Estacione o cabeçote onde você quer a imagem e exporte.

Para mais de um momento, o campo **Frames** aparece ao lado do tamanho de saída. Ele só aparece para uma composição cronometrada e um formato estático (PNG, JPG, WebP, SVG ou PDF). Deixe em `1` para o quadro do cabeçote. Aumente e você recebe esse número de imagens estáticas, distribuídas por igual ao longo de toda a sequência:

- PNG, JPG, WebP e SVG voltam em um único ZIP: `<name>-01.png`, `-02.png` e assim por diante.
- O PDF volta como um documento com essa quantidade de páginas.

Cada imagem vem do meio da sua fatia da linha do tempo, então o primeiro quadro nunca é uma entrada meio esmaecida e o último nunca é o momento vazio depois que todos os clipes terminaram.

::: figure exporting-contact-sheet
Frames: 4 corta a sequência em quatro fatias iguais e pega o meio de cada uma.
:::

Use para um storyboard, uma folha de contato de revisão ou um carrossel social cortado de uma edição de vídeo. A contagem é limitada a 64, e qualquer outra coisa digitada no campo volta para `1`. Cada quadro é uma imagem estática comum, então credenciais, o Imprint, unidades físicas e DPI se comportam como em uma única exportação. Um link de exportação, a CLI e o MCP pedem a mesma folha com `cuts=` (veja [Contact sheets](/info/url-export.html#contact-sheets)).

## Muitos arquivos de uma vez

O Lolly tem três formas de trabalhar em volume, cada uma para um trabalho diferente:

::: cols
## Uma tabela vira um documento
Uma ferramenta com uma entrada de tabela, como **Battlecards**, transforma cada linha em uma página. Cole uma tabela da sua planilha e receba um PDF. Corrija as linhas na planilha e cole de novo.
## Um CSV vira um arquivo por linha
O **Batch** (`#/batch`) recebe um CSV e renderiza uma exportação por linha: crachás ou certificados, um arquivo cada, entregues em um ZIP. Veja [Batch](/info/batch.html#make-many-versions-of-one-design).
## Vários designs recebem uma edição
O **Multi-edit** abre várias sessões salvas lado a lado para o mesmo retoque em designs diferentes. Veja [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Em **Projects**, **Render folder** exporta todas as sessões salvas de uma pasta e de suas subpastas em um único ZIP aninhado, e **Render selection** faz o mesmo para qualquer seleção múltipla; uma sessão salva é renderizada no próprio arquivo. Uma sessão salva também pode ser compartilhada de novo como um link de ferramenta a partir de Projects, que a reabre com as mesmas configurações.

## Arquivos que continuam editáveis em outro lugar

Alguns formatos entregam o seu trabalho a outro aplicativo como conteúdo editável, e não como imagem.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart e Agenda exportam um deck do PowerPoint, um slide por página. Cada página é desmontada em objetos nativos, para que um colega possa editar o deck e extrair recursos dele:

- <!--i:font--> O **texto** vira caixas de texto editáveis do PowerPoint, com o tamanho de fonte, a cor, o peso, o itálico e o alinhamento do layout.
- <!--i:pentool--> Os **vetores**, como logotipos e ícones, são incorporados como imagens SVG; continuam nítidos, e o PowerPoint pode usar *Convert to Shape* neles.
- <!--i:photos--> As **imagens** chegam na resolução nativa como imagens próprias. Uma imagem principal recortada mantém a imagem completa por trás do recorte, e qualquer filtro ou mistura aplicada a ela é incorporado.
- <!--i:layers--> **Fundos, bordas e filetes** viram formas de retângulo e linha.

![O painel de exportação com PowerPoint selecionado: um slide por página, texto e formas mantidos editáveis](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

O layout é aproximado; o objetivo é conteúdo reutilizável. Tudo o que o walker não consegue expressar nativamente, como uma região complexa com filtro ou máscara, é incorporado como imagem, para que nada se perca. Um deck tem um único tamanho de slide, tirado da primeira página.

O PowerPoint também é uma porta de entrada: [Rebrand a deck](/info/rebrand.html) leva um deck para o seu sistema de design, e [Import a design](/info/design-import.html) abre um no Design.

### Penpot

A maioria das ferramentas que exportam SVG também exporta um **arquivo Penpot** (`.penpot`), pronto para continuar a edição no Penpot.

| O que você criou | No Penpot |
|---|---|
| Texto | Objetos de texto editáveis: corrija um erro de digitação ou mude o estilo |
| Formas, caminhos, gradientes e imagens | Formas vetoriais editáveis próprias |
| Uma cor ou fonte de um token do sistema de design | Um vínculo vivo de token: edite o token e toda forma que o herda o acompanha |
| O design inteiro | Um componente reutilizável no painel Assets |
| Uma ilustração complexa ou um canvas vivo | Incorporado sozinho como imagem, com o conteúdo editável ao redor intocado |

A partir do Design, cada quadro vira uma prancheta do Penpot. As cores e tipografias do sistema de design vão para o painel Assets e o conjunto completo de tokens para o painel Tokens. A partir daí o Penpot mantém a própria cópia: um token editado no Penpot volta pela importação no [Design System Setup](/info/brand-studio.html).

![O painel de exportação com Penpot selecionado: o arquivo .penpot, e Enviar para o Penpot ao lado do download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para abrir o arquivo, inicie o Penpot, escolha um projeto e selecione **Import**. Com login no Penpot a partir do painel de exportação, **Send to Penpot** faz essa etapa por você.

### Word, OpenDocument e InDesign

O **Doc Studio** exporta **Word** (DOCX) e **OpenDocument** (ODT) com parágrafos e títulos reais.

O **Design** exporta **InDesign IDML (static subset)**: texto, retângulos, ovais e imagens PNG ou JPEG, uma página dupla por prancheta. A formatação inline compatível continua editável, as imagens viajam em `Links` e as coordenadas viram pontos do InDesign. Revinculação, substituição de fontes e mudanças na quebra de texto podem exigir atenção. Efeitos, animação, histórias compostas e geometria não compatível interrompem a exportação com um relatório que os lista. O IDML não preserva o documento original, então envie PDF para a arte final.

### Linhas do tempo: dotLottie e Premiere

Da linha do tempo do Design, **dotLottie** grava uma animação que continua editável em ferramentas Lottie; [Lottie animations](/info/sequence-editor.html#lottie-animations) lista o que ele mantém. **Premiere XML + media** empacota clipes cronometrados e a mídia original deles para o Premiere; veja [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pacotes de curso)

A exportação de cursos fica desativada até você ativar **Training and courses** em Settings → Preferences → Feature flags.

Depois escolha **Export course** em uma ferramenta compatível, uma pasta de projeto ou uma seleção. No Design, escolher **SCORM (LMS)** e **Download** abre o mesmo fluxo de curso. O Lolly salva o trabalho, deixa você revisar o conteúdo e a ordem do curso e depois abre o módulo e a caixa de exportação dele.

- <!--i:layers--> Escolha uma versão para cada origem: páginas estáticas, movimento como vídeo, áudio ou um recurso para download. Adicione texto de aula e alternativas de leitura no módulo.
- <!--i:clock--> Visualize o player do aluno e revise descrições e legendas. O movimento é incluído como vídeo, inclusive a animação silenciosa.
- <!--i:document--> Escolha Website, SCORM 1.2, SCORM 2004 4th Edition ou um destino xAPI experimental. Confira o conteúdo e o tamanho do ZIP, depois salve e baixe a versão conferida.
- <!--i:check--> A conclusão exige reconhecer todas as aulas obrigatórias e escolher Finish.

![O painel de exportação em um deck do Design com SCORM (LMS) escolhido](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

O pacote guarda o conteúdo final e não precisa de conta no Lolly. Coloque um ZIP Website em um host HTTP(S); importe um ZIP de LMS sem alterações. Teste o destino antes de compartilhar o curso. Para um curso montado a partir de várias criações salvas, veja [Create a training course](/info/training-creators.html).

### DXF (arquivos de corte)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding e Wordmark exportam **DXF**, o formato de intercâmbio AutoCAD R12 que cortadoras a laser, plotters de vinil e softwares CNC leem. A geometria é gravada como caminhos de contorno em milímetros, o texto é contornado e a cor é mapeada para o AutoCAD Color Index mais próximo, que costuma conduzir a operação da cortadora. O DXF é apenas arte de linhas: uma região fotográfica ou com filtro não tem caminho de corte e é descartada, com um aviso. Use SVG ou PDF para manter conteúdo raster.

O Street Map é o caso mais claro. O design inteiro já é feito de traços, então cada rua e canal vira um caminho de corte.

::: showcase
![Uma renderização do Street Map de Paris em tinta sobre creme - pura arte de linha, então cada traço sobrevive à viagem até uma cortadora](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Ao rolar, a câmera se afasta através da geometria real: sete caminhos, nenhum pixel em lugar nenhum, cada traço nítido como fio de cabelo em qualquer zoom. Esse é o mesmo arquivo que uma cortadora lê.
:::

## Impressão

O **Print PDF** grava CMYK contra uma condição de impressão nomeada, **Coated FOGRA39** por padrão. As amostras da marca com valores de tinta medidos são convertidas com exatidão; as outras cores usam uma conversão de dispositivo padrão. O **Print TIFF** grava pixels DeviceCMYK para um RIP e registra a mesma condição de impressão nos metadados do TIFF. O controle Colour profile conduz os dois; [Colour profiles](#colour-profiles) traz o detalhe.

**Print marks & bleed** tem um cartão próprio nos formatos de impressão: a sangria em milímetros mais marcas de corte, de registro, de sangria, barras de cor e detalhes de carimbo.

Algumas ferramentas montam um **PDF de várias páginas**: uma capa, conteúdo que flui por quantas páginas precisar e uma contracapa, como na ferramenta *Booklet*. Cada página é uma página de PDF vertical real em A4, US Letter ou A5, e você pode forçar qualquer bloco a uma nova página. São documentos RGB sem marcas de corte nem sangria, que pertencem ao Print PDF de página única. Um PDF do Design também pode ser um **Notes handout**: uma página vertical para cada slide com as notas do apresentador embaixo.

**Antes de exportar.** Um cartão **Before you export** no rodapé do painel diz o que uma gráfica está prestes a ver: formato, tamanho e sangria, áreas de corte e sangria, cobertura de tinta, contagem de chapas e de páginas, com um veredito ao lado do título. Ele nunca bloqueia uma exportação. O Design sempre mostra o cartão com as próprias verificações, incluindo as regras da casa do sistema de design camada por camada e o sinal de escrita do texto do documento ([Before you export](/info/design.html#before-you-export)), e acrescenta estas verificações de impressão quando **Print preflight** está ativado. Em outras ferramentas, ative **Print preflight** em Settings → Preferences → Feature flags; ele vem desativado por padrão, e uma implantação do Lolly Work pode ativá-lo para seus membros.

**Depois de exportar.** Quando o arquivo está pronto, o Lolly o lê de volta e o compara com o que você escolheu: formato, tamanho em pixels ou da página, duração do clipe, fundo transparente, cor CMYK, HDR, Content Credentials e senha de PDF ou ZIP. Tudo o que difere é escrito no cartão de exportação. Cada medida vem do arquivo, nunca da configuração, e uma propriedade que o arquivo não consegue responder não conta como correspondente. A linha de comando grava a comparação completa com `--export-report` (veja [Render with the CLI](/info/cli-rendering.html)).

As verificações do inspetor do Design e a comparação de marca no Design System Setup são verificações separadas: elas olham o design, enquanto estes dois cartões olham o arquivo.

::: details Custo a partir de uma tabela de preços
Abaixo do preflight, um cartão de custo transforma as mesmas contagens em dinheiro, usando apenas preços que alguém forneceu. Ele lê essas contagens mesmo quando o próprio cartão de preflight está desativado. Precisa de duas coisas: um trabalho que uma lista de preços consiga precificar (chapas, folhas, área, páginas, linhas de variantes ou arquivos de saída, então um simples PNG de logotipo nunca o mostra) e uma **rate card**, uma lista de preços em JSON da sua gráfica. Uma compilação padrão não traz nenhuma e não tem como carregar uma dentro do app. Uma rate card chega como um recurso de catálogo que uma implantação entrega, ou pela extensão opcional de rate card que um auto-hospedeiro ou plano de controle ativa. Sem rate card, nada é mostrado.

Cada valor é uma tarifa que você forneceu vezes uma quantidade que o Lolly contou, como `4 plate × €35.00`, e o total traz a sua origem: o emissor do cartão e a data das tarifas. Não há moeda padrão nem preço de exemplo. O que o arquivo diz sobre si mesmo continua sendo discurso relatado: *"The file says: … Lolly has not verified this."*

Quando um valor não pode ser calculado, a tabela é retirada em vez de preenchida:

- Linhas que o cartão não precifica significam **nenhum total**, apenas um título dizendo quantas não têm preço.
- Uma quantidade que é um teto leva **"up to"** para o subtotal.
- Tarifas depois da data de validade mostram **apenas contagens** até você pressionar *Use these rates anyway*; a data de expiração então acompanha o valor.
- Aberto por um **link**, o dinheiro fica oculto até você pedir neste dispositivo. A CLI recebe `--rate-card=<file.json>` como arquivo local e nunca como parâmetro de link.

O cartão é removido de todas as etapas de exportação, então nunca altera o arquivo. É aritmética, não um orçamento; só a sua gráfica pode orçar.
:::

## Movimento e som

### Vídeo

As ferramentas animadas exportam **MP4** e **WebM**. O seletor mostra apenas os contêineres que este navegador consegue gerar, e um link `?format=` compartilhado que peça um que ele não consegue gerar recorre ao outro, com um nome de arquivo correspondente. As ferramentas animadas também oferecem **Start after**, que mantém o canvas parado por um momento para que animações e fontes se assentem antes da gravação, e **Duration**, a duração do clipe final. **Motion blur** (Off, Draft quality, Standard ou High, com um **Shutter angle**) desfoca movimentos rápidos ao custo do tempo de renderização. Onde o navegador permite, **Record live** grava a prévia na tela em tempo real por meio de um compartilhamento de tela.

![As configurações de tempo de uma exportação animada: Start after, Duration, Motion blur com seu Shutter angle e Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** escolhe Smaller file, Balanced ou Best quality. **Advanced** abre **Codec**, **Frame rate**, **Rate mode** e **Hardware acceleration**. Onde uma ferramenta tem legendas, **Captions** escolhe uma **Embedded track** ou um **Sidecar .vtt + .srt** ao lado do vídeo. Um link carrega a qualidade, o codec, a taxa de quadros, a duração e o atraso de início como `vq`, `codec`, `fps`, `seconds` e `wait` ([URL parameters](/info/url-parameters.html)).

As exportações de vídeo mantêm o som. Uma ferramenta pode colocar uma **base musical** sob o clipe: um recurso de áudio repetido ou cortado até a duração do clipe, com fades, volume e ducking sob o som do próprio material. As ferramentas de gravação levam o áudio ao vivo até o arquivo.

Um deck do Design que continua sendo um deck de cliques ainda pode sair como vídeo. **Export slides as video**, no menu Present, abre a folha de exportação em MP4. Cada slide toca pelo próprio tempo de permanência, ou pela Duration da folha de exportação quando não tem nenhum, e a transição de slide do deck acontece entre eles como uma dissolução. O documento em si não muda.

### Imagens animadas

O **GIF** toca em qualquer lugar e serve para chat e e-mail; é maior e tem menos cores que o vídeo. **APNG** e **Animated WebP** mantêm cor total e transparência. O **Lottie Ad** também exporta **Animated SVG**: quadros vetoriais com quadros-chave CSS incorporados, então escala para qualquer tamanho e repete em loop em uma aba do navegador ou em um `<img>`, sem codec. O texto é contornado, e ele usa uma taxa de quadros padrão menor porque cada quadro é mais pesado que um bitmap. Todos estes são silenciosos.

### Áudio

Algumas ferramentas exportam só o som. O **Voice Recorder** captura uma gravação de microfone com medidor de nível ao vivo e a salva como **MP3**, **WAV**, **M4A (AAC)** ou **Opus (WebM)**, codificada no seu dispositivo. `wav`, `mp3`, `m4a` e `opus` são ids de formato comuns, então uma exportação de áudio é tão compartilhável e programável quanto um PNG.

O seletor de recursos aceita uma ampla variedade de áudio para uma base musical, de MP3 e FLAC a MIDI e módulos tracker; [Formats](/info/formats.html) os lista. Uma [música do Rondocode](/info/rondocode.html) toca na duração que o clipe dela pedir.

## Cor e HDR

O Lolly lê toda cor CSS moderna, faz a matemática de cor de forma perceptual e grava cada arquivo em um espaço que um leitor consegue abrir: sRGB para telas, CMYK para impressão e Rec.2100 PQ para HDR. [Colour in the engine](/info/colour-engine.html) explica como. Um documento do Design definido como **Wide colour / HDR** segue as próprias regras, descritas em [Wide colour and HDR editing](/info/hdr-editing.html).

### Perfis de cor

As exportações recebem um perfil de cor, para que apps com gerenciamento de cor, como gráficas, Photoshop e navegadores, leiam as cores como você as viu. Isso acontece automaticamente; miniaturas e prévias dispensam a etiqueta para continuarem pequenas.

- **PNG e JPG** carregam um perfil ICC **sRGB** incorporado, o espaço em que a prévia é desenhada. Os pixels são etiquetados, não recodificados.
- O **Print PDF (CMYK)** declara a condição de impressão no *OutputIntent*, informando à gráfica como as tintas CMYK devem ser lidas.
- O **Print TIFF (CMYK)** grava pixels DeviceCMYK sem etiqueta e registra a condição de impressão nos metadados do TIFF. Um TIFF não consegue incorporar um perfil de impressão, então uma linha **Embed** registra apenas o nome desse perfil.
- O **TIFF (RGB)** é o irmão sRGB sem compressão, para arquivo ou um vaivém com um editor. Ele achata a transparência sobre branco. Os dois TIFFs são exclusivos do desktop, porque os navegadores não conseguem visualizar um TIFF.
- **SVG**, **EMF**, **EPS** e **DXF** são vetores sem perfil incorporado: as cores do SVG são sRGB, EMF e EPS usam RGB de dispositivo, **EPS (CMYK)** grava DeviceCMYK e o DXF usa o AutoCAD Color Index. SVG, EPS e DXF contornam o texto em caminhos. O EMF mantém o texto vivo e editável no Office e no Google Slides, recorrendo a contornos apenas para trechos que o formato não consegue expressar; a opção **Outline fonts** do painel de exportação força caminhos em todos os casos. O SVG também reproduz sombras de caixa CSS, internas e externas.

::: details PDF/X-4 e o seu próprio perfil de impressão
Nenhum perfil CMYK acompanha o Lolly. Uma condição de impressão nomeada grava o output intent sem afirmar conformidade com PDF/X-4, porque o PDF/X-4 exige o perfil incorporado.

Carregue um perfil CMYK seu e escolha a linha **Embed** dele no controle Colour profile. Ele é incorporado como o *DestOutputProfile* do arquivo, e o PDF afirma PDF/X-4 sempre que o restante do arquivo permitir. A condição de impressão que ele declara é lida a partir desse perfil: um nome registrado onde o perfil o comprova, ou `Custom` sob o nome do próprio perfil.

Três coisas retêm a afirmação mantendo o output intent: arte RGB que a passagem CMYK não conseguiu converter, o texto de crédito de margem de prova `prov` (desenhado em uma fonte padrão que não é incorporada) e uma senha **Strong**, já que o PDF/X-4 proíbe criptografia. Todo PDF também carrega metadados PDF/X-4: caixas de página, XMP, um ID de documento e um output intent sRGB com o respectivo perfil.
:::

### HDR (cores brilhantes)

Este é o cartão **HDR** do painel de exportação, que intensifica a arte comum para telas HDR. Manter os originais HDR durante a edição é outro recurso: [Wide colour and HDR editing](/info/hdr-editing.html).

Uma exportação comum é sRGB: uma cor saturada da marca é tão brilhante quanto o branco normal da tela. Uma tela HDR tem margem acima disso. O cartão **HDR** intensifica as cores da sua marca e o texto branco em direção ao brilho máximo, enquanto as áreas escuras continuam escuras e dão contraste ao brilho.

![O cartão HDR no painel de exportação, ligado, com os controles White / Reach / Dark lift / Focus revelados abaixo dele](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formatos.** PNG, JPG, AVIF e TIFF. O WebP é de 8 bits sem caminho de decodificação HDR funcional, e vetores e PDF não têm modelo HDR.
- **Desativado por padrão**, porque altera os pixels. Marque o cartão ou passe `hdr=1` em um link de compartilhamento.
- **Os controles.** **White** (o teto de brilho máximo, de 400 a 2000 nits), **Reach** (até onde nos tons o brilho se espalha), **Dark lift** (quanto os escuros clareiam; `0` os mantém escuros) e **Focus** (quanta riqueza de cor a intensificação mantém). Eles viajam como um único valor: `hdr=1600-60-0-50` é White 1600, Reach 60, Dark lift 0 e Focus 50.
- **O que é gravado.** O PNG recebe Rec.2100 PQ de 16 bits com um chunk `cICP`. O JPG é um JPEG com mapa de ganho ISO 21496-1: uma imagem SDR comum mais um mapa de ganho anexado. O AVIF recebe uma caixa `colr` reescrita. O TIFF recebe pixels PQ com um perfil ICC v4 gerado que carrega uma etiqueta `cicp`, e achata sobre preto, porque o branco é o código de 10.000 nits no PQ e criaria um halo em todas as bordas. A intensificação segue a luminosidade perceptual (OKLab) e mantém o matiz, então um verde da marca fica mais brilhante, não esbranquiçado.
- **Onde o brilho aparece.** Em visualizadores com gerenciamento de cor em uma tela HDR: Preview, Quick Look e Safari em dispositivos Apple, ou Chrome em um monitor HDR. Uma tela SDR mostra uma imagem normal.
- **Antes de publicar.** Muitas plataformas recodificam os envios e removem o sinal HDR, o que pode deixar a imagem escura ou desbotada. Use HDR onde você controla o destino, como o seu próprio site, um painel de vídeo ou um deck em uma tela brilhante.
- **Pelo terminal.** `--hdr=1` com `--export=png` ou `--export=jpg` grava o mesmo PNG e JPEG com mapa de ganho na [CLI](/info/cli.html), pelos mesmos codificadores do motor, sem navegador no caminho. AVIF e TIFF continuam sendo exportações da web por enquanto.

## O que viaja com o seu arquivo

Um arquivo final pode carregar vários registros além da imagem. Alguns viajam ao lado dos pixels e desaparecem quando o arquivo é salvo de novo ou limpo; duas marcas vivem nos próprios pixels.

::: figure exporting-what-travels
Onde cada registro vive, se vem ativado por padrão e qual parâmetro de link controla cada um.
:::

O painel de exportação reúne **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, o **Lolly Imprint** e a **Durable credential** em um único grupo **Content protection** que mostra apenas os cartões que o formato escolhido pode usar. Ele abre sozinho quando um link ou documento já declara uma licença, ou quando uma origem precisa de uma decisão sua. O cartão **Design system** fica fora do grupo, à vista em toda exportação.

![O grupo Content protection aberto em uma exportação PNG, mostrando apenas os cartões que se aplicam a ela](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Procedência e marca d'água

Onde o formato tem os campos, as exportações carregam **metadados de procedência**: o software, a origem, o nome da ferramenta e a sua linha de crédito do perfil, gravados em iTXt do PNG, EXIF do JPEG, info do PDF, `<metadata>` do SVG ou um comentário do GIF. Ele registra apenas autoria, e nada é enviado. As ferramentas **Experimental** também carimbam uma marca d'água visível, aplicada pelo host, de modo que editar a ferramenta não consegue remover a marca.

**O Lolly Imprint** é uma marca d'água invisível nos pixels, **ativada por padrão**. A credencial e os metadados viajam ao lado dos pixels e se perdem em um novo salvamento, uma captura de tela ou uma limpeza de metadados. O Imprint vive nos pixels e sobrevive à recompressão, então uma cópia ainda pode ser reconhecida como feita no Lolly. É uma indicação e não uma garantia criptográfica, e não carrega dados pessoais. Ele vai em JPEG XL, PNG, JPG, WebP, AVIF, TIFF e BMP, e nos rasters que o Lolly renderiza dentro de um PDF ou PPTX, nunca em uma imagem que você incorporou. Desmarque **Lolly Imprint** ou passe `imprint=0` para deixar o Imprint de fora. A sobrevivência do AVIF à recodificação ainda não foi calibrada. O [Verify](/verify) o detecta no seu dispositivo; veja [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**A Durable credential** grava o id do Lolly nos pixels com um modelo neural no dispositivo no formato TrustMark, para que o link "made with Lolly" sobreviva a uma limpeza de metadados e a uma recodificação e possa ser lido por ferramentas compatíveis com TrustMark. Vem **desativada por padrão**, porque custa uma passagem neural por exportação e um download único do modelo. Cobre PNG, JPG, WebP, AVIF e TIFF; marque-a no painel ou passe `durable=1`. Os apps desktop e mobile ocultam o cartão, porque não têm origem de onde buscar o modelo offline.

**Licença.** Escolha como outros podem usar o seu trabalho: *None (all rights reserved)* por padrão, CC0 1.0, a Public Domain Mark 1.0, ou uma licença Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). O nome da licença e um link para o resumo dela vão para os metadados de licença do arquivo (EXIF, XMP e RIFF onde o formato os tem) e para a Content Credential dele. A escolha é salva com o documento e viaja em um link como `licence=`. O Lolly grava a licença que você escolheu; não verifica nem impõe os termos. Uma ferramenta com campo de licença próprio, como o Claim, mantém esse campo.

### O registro do sistema de design

Uma exportação registra o sistema de design que criou o arquivo: o nome dele, a versão publicada de onde foi desenhado (quando não é a versão de trabalho) e a [variação de cores](/info/colourways.html) em que foi desenhado. Qualquer outra escolha de tema que um sistema de design declare, como uma densidade, é registrada do mesmo modo. A escolha entre claro e escuro fica de fora, porque a imagem já mostra qual foi usada.

**Você vê o registro antes de qualquer coisa ser gravada.** O cartão **Design system**, marcado por padrão, mostra as palavras exatas que o arquivo vai carregar, como *Records: Acme · Colourway: Beach*, e a descrição como ela será lida. O nome de um sistema de design é o que os responsáveis por ele digitaram, então o cartão o mostra como foi escrito. Desmarque o cartão para deixar o registro fora dessa exportação. O painel de documento do Design lista as mesmas palavras em *Embedded in exports*.

**A descrição informa a variação de cores ao lado da ferramenta.** Com o cartão marcado, *"Made with https://lolly.tools : Chart"* vira *"Made with https://lolly.tools : Chart (Beach colourway)"*. O nome do próprio sistema de design fica no registro, não na descrição. Uma descrição sem nome de ferramenta, ou uma que a ferramenta escreve a partir das próprias entradas, fica como está. Uma ferramenta que ignora variações de cores por meio de `tokenAxes` não registra nenhuma, e o crédito de prova do PDF (a marca de impressão `prov`) segue a mesma regra.

**Brand skills que guiaram um agente.** Quando um agente criou a peça e nomeou as [brand skills](/info/brand-skills.html) que leu e seguiu, o registro também lista cada skill com a sua revisão, como *Guided by: acme-brand 1.0*. As palavras significam que a skill guiou o trabalho. Não são uma verificação: o Lolly não testa a peça contra uma skill. Somente a declaração do próprio agente acrescenta a lista, o que hoje significa o argumento `brandSkills` do `lolly_render` do [servidor MCP](/info/mcp.html), então uma peça feita no app ou a partir de um link de compartilhamento não carrega nenhuma. A Content Credential guarda a lista como `brandSkills`, um valor JSON com o id, o nome, a revisão e o hash SHA-256 de cada skill. O pacote XMP e os metadados do SVG guardam o mesmo valor como `lolly:BrandSkills`, um PDF gravado a partir do registro ganha uma palavra-chave por skill e a descrição continua como estava. Uma skill interna é registrada pelo id, nome, revisão e hash, nunca pelo texto. As mesmas chaves deixam a lista de fora junto com o restante do registro: o cartão **Design system**, `_madewith=0`, `--no-madewith` e `madeWith: false`. Quando o servidor MCP desenha o arquivo em um navegador (um PDF, um JPEG e os outros formatos que o caminho sem navegador não consegue gravar), os metadados do próprio arquivo não guardam lista, e somente uma Content Credential consegue guardar uma. Passe `c2pa` para manter o registro; sem uma credencial, a renderização avisa que as brand skills não foram registradas.

**Ler o registro de volta.** O [Verify](/verify) lista o registro como **Design system** nos detalhes da credencial de um arquivo e as brand skills como **Guided by**. *Recreate with these settings* reabre a ferramenta na versão e na variação de cores registradas. O link abre com o sistema de design registrado quando este dispositivo guarda um com o mesmo id e nome; caso contrário, abre com o seu sistema de design ativo.

::: details O que é gravado onde, e quais execuções deixam o registro de fora
| Onde | O que é gravado |
|---|---|
| Content Credential | `designSystem` (o id), `designSystemLabel`, `designVersion` e `themes` na asserção `tools.lolly.export`, cada um um valor de texto simples; `themes` é uma lista JSON das escolhas |
| PNG, JPEG, WebP e JXL | Os mesmos quatro valores como propriedades `lolly:` do pacote XMP do arquivo, no namespace `https://lolly.tools/ns/export/1.0/` |
| SVG | As mesmas propriedades `lolly:` dentro do bloco `<metadata>` |
| PDF | Palavras-chave como *Design system: Acme* e *Colourway: Beach* |
| Todo formato com campo de descrição | A descrição, com a variação de cores ao lado da ferramenta |

O cartão só aparece quando há algo a registrar e o formato consegue guardar o registro. CSV, JSON, um arquivo de calendário e outros formatos de texto ou de dados não guardam metadados, e EPS, EMF, DXF e BMP não têm campo para o registro. HTML, Markdown e CSS guardam o registro apenas na Content Credential, então para eles o cartão não mostra linha de descrição e se oculta enquanto **C2PA Credentials** está desativado. Um campo que o sistema de design não fornece fica fora do arquivo.

Um link de compartilhamento desativa o registro com `_madewith=0` ([URL parameters](/info/url-parameters.html)); a linha de comando aceita `--no-madewith`, o `lolly_render` do [servidor MCP](/info/mcp.html) aceita `madeWith: false`, e o painel de exportação do app de terminal tem uma linha **Design system**. A linha de comando imprime no erro padrão as palavras que um arquivo final carrega, para uma renderização de ferramenta e para cada arquivo que o `lolly run` exporta de uma sessão salva do Design, e uma renderização MCP as imprime ao lado do arquivo, ambas lidas de volta do arquivo. Um PNG que a linha de comando desenha sem navegador não carrega metadados de arquivo, então o registro viaja só na credencial. Os utilitários no dispositivo não adicionam metadados.

Execuções sem o cartão **Design system** deixam o registro de fora: uma execução do Batch, uma pasta exportada de Projects e uma exportação de coleção 3D, e no app de terminal um lote CSV, uma exportação de pasta ou seleção de Projects e a visão de renderizar tudo. Exporte um arquivo a partir da ferramenta para registrar o sistema de design.
:::

### Content Credentials (C2PA)

As exportações podem carregar **Content Credentials**: um manifesto [C2PA](https://c2pa.org) assinado que registra o que criou o arquivo, quando e onde, vinculado a um hash dos bytes do arquivo para que qualquer edição posterior seja detectável. A especificação é publicada pela C2PA, e o Lolly grava manifestos padrão que qualquer leitor C2PA pode inspecionar.

![O cartão C2PA Credentials, marcado, com a duração da credencial ao lado da caixa de seleção](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Ativado por padrão.** O cartão **C2PA Credentials** já vem selecionado para quase todas as ferramentas. Desmarque-o para uma exportação ou passe `c2pa=off` em um link. Uma ferramenta pode desativá-lo no manifesto.
- **Formatos.** PDF (RGB e Print), PNG e APNG, JPG, GIF, SVG, TIFF (RGB e Print), WebP (estático e animado), AVIF, MP4, WebM, os contêineres de áudio MP3, WAV, M4A, OGG/Opus e FLAC, e HTML, Markdown e CSS. Um ZIP carimba cada membro compatível, que é como um Animated SVG recebe uma. MP4, AVIF e M4A usam o vínculo BMFF padrão e o MP3 usa o mapeamento ID3v2, então o `c2patool` e outros leitores os verificam. WebM e OGG/Opus ainda não têm mapeamento padrão, então o Lolly leva o manifesto como um anexo Matroska e um campo OpusTags, que o verificador do próprio Lolly confere. ICO, EPS, EMF, DXF, BMP, PPTX, os formatos do Office e os demais formatos de texto e de dados não têm contêiner C2PA.
- **O que registra.** A ferramenta e o app que criaram o arquivo, o horário da assinatura, o shell que o exportou, o [sistema de design e a variação de cores](#the-design-system-record) enquanto o cartão **Design system** está marcado, e impressões digitais das entradas ativas. O texto das entradas, campos vinculados ao perfil, controles inativos, versões de navegador e detalhes do sistema operacional ficam de fora. Seu nome e e-mail aparecem como autor somente quando **Use my details to create** está ativado em Settings → Preferences → Your details. As fontes que uma exportação inclui viajam como ingredientes: [obras creditadas](#source-credits), como emoji, e [músicas do Rondocode](/info/rondocode.html#songs-in-the-credential) em uma exportação de vídeo ou áudio.
- **O que os destinatários veem.** Ferramentas C2PA como apps da Adobe, o `c2patool` e o contentcredentials.org/verify leem o manifesto e mostram a declaração. O Lolly assina com uma chave criada no seu dispositivo, não com um certificado de uma lista de confiança, então os visualizadores informam uma credencial *unverified*: a estrutura e a evidência de adulteração são reais, mas o signatário não tem aval. Para mudar isso, cadastre uma **verified identity** em Settings → Preferences → Content Credentials; veja [Content Credentials Identity](/info/content-credentials-identity.html).
- **Verificar um arquivo.** Solte qualquer arquivo no [Verify](/verify), ou execute `lolly validate <file>`, para um relatório no dispositivo que começa por saber se o Lolly criou o arquivo e se ele mudou desde então. O Verify também olha além da credencial; veja [What Verify checks](/info/what-verify-checks.html).
- **Privacidade.** A chave de assinatura é criada para a exportação e nunca sai do seu dispositivo, e a declaração guarda apenas o que os metadados de procedência já carregam. Os utilitários de privacidade que transformam os seus próprios arquivos não adicionam credencial, e o *Strip Hidden Data* remove um manifesto C2PA como qualquer outro metadado. O utilitário Rondocode cria áudio novo, então assina o que grava ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interações.** Um PDF protegido por senha não pode carregar Content Credentials, em nenhum dos dois níveis. A credencial é adicionada por último, sobre os bytes finalizados, depois de DPI, EXIF, perfil de cor, metadados PDF/X e marcas de impressão.

### Source credits (créditos de origem)

Uma exportação que inclui o trabalho de outra pessoa registra essa origem na credencial. Um emoji desenhado do conjunto de emoji escolhido é o caso do dia a dia: a obra, o criador dela, a licença, de onde vieram os bytes exatos e o que mudou, tudo viaja com o arquivo. O texto em uma ferramenta cujo template é um SVG mantém o emoji do próprio sistema, então nada é creditado ali. A linha **Source credits** diz o que as origens pedem da entrega antes de você baixar e, depois do download, lê os bytes entregues de volta antes de dizer que os créditos estão no arquivo. Uma licença que pede que você escolha, como um glifo CC BY-SA recolorido que você está prestes a compartilhar, recebe um cartão com as opções; o download nunca é bloqueado. [Creative rights and credits](/info/creative-rights.html) traz o texto, as licenças revisadas e o que continua sendo seu.

## Proteção por senha

Dois tipos de bloqueio, ambos feitos no seu dispositivo. O cartão *Password protect* do painel de exportação controla os dois.

![O cartão Password protect expandido em uma exportação de PDF, com o campo de senha e os dois níveis de bloqueio](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Uma senha de abertura de PDF** tem dois níveis assim que você digita uma senha:

- **Weak**: RC4 de 40 bits, um desestímulo e não uma proteção. A senha pode viajar em um link de compartilhamento, em texto claro. Somente `pdf` RGB.
- **Strong**: AES-256 (PDF 2.0). Digitada na exportação e nunca colocada em um link. Também vale para PDFs de impressão e para cada PDF dentro de um ZIP de lote. Um PDF de impressão com bloqueio Strong mantém o CMYK, as marcas e o output intent, mas perde a afirmação PDF/X-4.

**Um ZIP bloqueado** cobre uma exportação ZIP, o download de uma pasta de Projects ou de um lote, com uma senha em dois níveis: **Weak** (ZipCrypto, um desestímulo; pode viajar em um link `?password=`) ou **Strong** (AES-256, digitada na exportação, nunca em um link). A senha protege todos os membros, e qualquer PDF dentro também é bloqueado com AES-256 por conta própria, de modo que continua bloqueado depois que o ZIP é desempacotado. O aviso aparece quando o download começa; uma senha em branco significa sem bloqueio.

**Um link de compartilhamento protegido por senha** pede uma senha ao destinatário antes de abrir. Todo o estado do link é criptografado com AES-256 sob uma chave derivada da senha (PBKDF2), então apenas texto cifrado viaja e a descriptografia acontece no navegador do destinatário. O servidor que serve o link nunca vê a senha nem o design. Ative na caixa **Share**. Um link criptografado só abre no Lolly, nunca como imagem incorporada. Veja [URL Mode](/info/url-mode.html).

## No celular

Os controles de exportação ficam atrás do botão flutuante **Export**, que abre a folha **Export**: os mesmos formatos, tamanho, copiar, baixar e compartilhar, dimensionados para toque.

## Ids de formato para links e para a CLI

Estes são os valores do parâmetro de URL `format=` e do sinalizador `--export=` da CLI (veja [URL parameters](/info/url-parameters.html) e [CLI](/info/cli.html)). O menu de uma ferramenta mostra apenas os formatos que ela consegue gerar, então é sempre mais curto que esta lista.

| Tipo | Ids |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (TIFF RGB) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vetor | `svg` · `svgz` (SVG compactado com gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (arquivo de corte) |
| Página e documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (arquivo de design Penpot) · `scorm` (pacote de curso, um ZIP) |
| Movimento | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Áudio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Texto e dados | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (paleta GIMP) |
| Pacotes | `zip` · `rpm` e `tar.gz` (a renderização selada em um pacote Linux) |

Alguns ids vêm do código de exportação da própria ferramenta: `ase` (Adobe Swatch Exchange, do Palette Lab) e `exr` e `hdr` (rasters de alto alcance dinâmico, do Darkroom). O **Convert Font** grava `ttf`, `otf` e `woff` a partir de um arquivo de fonte que você fornece, então um link simples não tem nada para ele renderizar.
