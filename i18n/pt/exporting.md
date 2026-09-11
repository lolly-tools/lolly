# Exportação e Formatos

Como obter um arquivo finalizado de uma ferramenta - escolher o formato certo, definir o tamanho de saída e o que cada opção faz. Como tudo o mais, **a exportação acontece no seu dispositivo**; nada é enviado.

## Como a exportação funciona

A pré-visualização *é* o arquivo. Quando você exporta, o host renderiza essa tela no formato escolhido e entrega um download (ou coloca na sua área de transferência). Uma ferramenta só oferece os formatos que seu autor declarou, e o seletor esconde qualquer um que seu navegador não consiga produzir (veja [Vídeo](#video)).

Três caminhos produzem um arquivo. A maioria das ferramentas **renderiza a tela** no formato escolhido. Formatos de texto e dados (HTML, MD, TXT, JSON, CSV, ICS, VCF) são, em vez disso, **gerados a partir do conteúdo da ferramenta**, não rasterizados a partir da imagem. E utilitários de privacidade (por exemplo, *Strip Hidden Data*) usam um terceiro caminho: o arquivo que *você* escolhe é transformado byte a byte no dispositivo e devolvido diretamente - sem tela, sem marca d'água e sem metadados de proveniência adicionados, porque já é o seu próprio arquivo.

As ações nos controles de exportação:

- <!--i:download--> **Download** - salva o arquivo (a ação principal).
- <!--i:photos--> **Copy** - coloca a imagem na sua área de transferência para colar direto no Slack, e-mail, um documento. Onde um navegador não consegue copiar imagens, ele faz o download e avisa você.
- <!--i:folder--> **Save** - mantém o design atual como uma sessão de ferramenta salva na sua biblioteca.
- <!--i:link--> **Share** - abre o **Share dialog** (caixa de diálogo de compartilhamento): um link copiável que reproduz o design, opções de ativação na visita (tela cheia, painel de exportação, download ou cópia ao abrir) e um **Shortest link** opcional que compacta todo o estado em um token compacto (veja [URL Mode](/info/url-mode.html)).

(O autor da ferramenta escolhe quais destas aparecem; o conjunto padrão é Copy, Download e Save.)

![O painel de exportação - formato, tamanho e as ações Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share abre sobre a ferramenta, com o link já construído e as opções de ativação na visita logo abaixo.

### Renderizando vários de uma vez

Uma única exportação é um arquivo, mas você pode renderizar **vários** de uma só vez - cada lote entregue como um `.zip`:

- <!--i:folder--> **Projects → Render folder** exporta cada sessão salva em uma pasta (e suas subpastas) como um único zip aninhado; **Render selection** faz o mesmo para qualquer multisseleção; uma única sessão salva renderiza direto para seu próprio arquivo. Não precisa de Batch/Pro - veja [Usando o Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** renderiza uma grade de conjuntos de entrada - cada variante de um template de uma vez.

Uma sessão salva também pode ser recompartilhada como um link de ferramenta a partir de Projects (ele reconstrói a URL da ferramenta a partir das entradas salvas), então um link a reabre com exatamente as mesmas configurações.

## Escolhendo um formato

O nome do arquivo e o seletor de formato ficam no topo do painel como um par `name.format`, e o seletor lista apenas os formatos que o autor desta ferramenta declarou.

![O campo de nome do arquivo fundido ao seletor de formato, para que a exportação seja lida como um único par name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Você quer… | Use | Por quê |
|---|---|---|
| Logotipos / artes nítidas que escalam | **SVG** | Vetor - infinitamente escalável, pequeno, editável |
| Vetor para apps do Office / Windows | **EMF** | Cola como vetor editável no PowerPoint / Word; o texto permanece ativo e editável, e o Google Drive abre no Google Desenhos para Slides |
| Vetor para impressão / apps de design | **EPS**, ou **EPS (CMYK)** | Vetor PostScript para Illustrator / fluxos de gráfica |
| Vetor para corte / máquinas CAD | **DXF** | Cortadoras a laser, plotters de vinil, CNC - caminhos de contorno em milímetros |
| Uma apresentação de slides editável | **PowerPoint** (PPTX) | Texto e formas nativamente editáveis, com imagens e vetores mantidos extraíveis |
| Um curso que um LMS pode importar | **SCORM** (LMS) | Um zip com o manifesto, uma página de início, os slides e o filme narrado com legendas - a partir de uma apresentação do Design |
| Um documento de texto editável | **Word** (DOCX) ou **OpenDocument** (ODT) | Parágrafos e títulos reais que um editor de texto pode continuar editando (Doc Studio) |
| Uma foto ou imagem de uso geral | **PNG** (sem perdas) ou **JPG** (menor) | Raster universal |
| Imagens modernas menores | **WebP** / **AVIF** | Melhor compressão, alfa |
| Impressão | **PDF**, ou **Print PDF** (CMYK) | Tamanho real da página; CMYK para gráfica |
| Raster de impressão para uma gráfica | **Print TIFF** (CMYK) | Pixels DeviceCMYK para um RIP |
| Animado para a web | **GIF** | Funciona em qualquer lugar, arquivos maiores |
| Animado com cor completa + alfa real | **APNG** | PNG animado - sem limite de paleta, transparência verdadeira |
| Animado, menor arquivo | **WebP animado** | Cor completa + alfa, melhor compressão que GIF ou APNG |
| Vetor animado que escala | **SVG animado** | Autocontido; roda em loop num navegador ou `<img>`, sem codec, qualquer tamanho |
| Vídeo para redes sociais / compartilhamento | **MP4** ou **WebM** | Melhor qualidade por byte (veja abaixo) |
| Texto rico / assinatura de e-mail | **HTML** | Cola formatado em clientes de e-mail |
| Conteúdo simples | **MD** / **TXT** | Somente texto |
| Um evento de calendário | **ICS** | Importa em qualquer app de calendário |
| Um cartão de contato | **VCF** | Importa em Contatos / catálogos de endereços |
| Dados estruturados para reimportar | **JSON** / **CSV** | Faz o round-trip do conteúdo da ferramenta |
| Um favicon | **ICO** | Ícone de site multitamanho (**ZIP** empacota vários formatos) |

A primeira linha é o caso comum. Um wordmark composto na fonte da sua marca exporta como SVG, onde cada letra é um caminho vetorizado em vez de um pixel, então ele permanece nítido no tamanho de um cartão de visita e no tamanho de um envelopamento de prédio a partir do mesmo arquivo.

![Um wordmark de traço fino e espaçamento largo com o texto Aurora, o tipo de arte puramente vetorial de que trata a linha SVG da tabela](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Tamanho e unidades de impressão

Por padrão, as exportações usam o tamanho de pixel nativo da ferramenta. Onde uma ferramenta expõe **dimensões**, você pode definir largura × altura e uma **unidade**:

- **px** (padrão) - pixels exatos.
- **mm · cm · in · pt · pc** - tamanhos físicos/de impressão. Com uma unidade física você também define o **DPI** (padrão **300** para impressão); o engine converte corretamente por formato - **PDF** vira uma página real nesse tamanho, **raster** renderiza na contagem de pixels correta para o DPI (e incorpora a resolução), **SVG** mantém a unidade física com um viewBox em px.

Para obter um raster de maior resolução, digite uma largura/altura maior, ou escolha uma unidade física e aumente o DPI (pixels = tamanho × DPI). Não há um alternador de escala com um clique.

Exemplo: largura `210`, altura `297`, unidade `mm` → uma página A4.

![A linha de dimensões definida como 210 por 297 mm, com o campo DPI revelado porque a unidade é física](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Imagens estáticas a partir de uma composição temporizada

Uma **composição cronometrada** - uma linha do tempo [Sequência](/info/using.html#timeline-sequence) no Design, ou qualquer artboard orientado por linha do tempo - é algo em movimento, então uma exportação estática precisa responder "qual momento?". A regra é a que você esperaria: **o quadro no cursor de reprodução**. Posicione o cursor onde você quer a imagem e exporte; o que você vê é o que sai.

Quando você quer mais de um momento, o campo **Frames** aparece ao lado do tamanho de saída (apenas para uma composição temporizada, e apenas para um formato estático - PNG, JPG, WebP, SVG ou PDF). Deixe-o em `1` para o frame do cursor de reprodução. Aumente-o e você obtém essa quantidade de imagens estáticas amostradas em intervalos iguais ao longo de toda a sequência:

- **Raster e SVG** voltam como um único **zip** - `<name>-01.png`, `-02.png` e assim por diante.
- **PDF** volta como um **único documento com esse número de páginas**.

Útil para um storyboard, uma folha de miniaturas, um contact sheet para revisão ou um carrossel de redes sociais cortado direto de uma edição de vídeo.

A amostragem é feita no **ponto médio** de cada intervalo, e não nas bordas, porque o primeiro instante de uma sequência costuma ser uma transição de entrada que ainda não terminou de aparecer, e o último é o estado depois que todos os clipes já terminaram - amostrar nas extremidades gastaria duas das suas imagens em quadros quase em branco. A contagem tem um limite de **64** (um contact sheet é para um humano ler), e qualquer coisa sem sentido digitada no campo volta para `1` em vez de falhar a exportação. Cada frame é uma imagem estática comum, então Content Credentials, o imprint, as unidades físicas e o DPI se comportam exatamente como em uma exportação única.

O campo **Frames** é a maneira de obter uma folha hoje. O engine reserva um parâmetro de URL `cuts` correspondente, mas nenhum shell ainda o lê a partir de um link, então um link compartilhado sempre reabre no frame do cursor de reprodução - veja [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## PDF de múltiplas páginas

Algumas ferramentas constroem um **documento PDF de múltiplas páginas** em vez de uma única arte - uma capa, conteúdo que flui por quantas páginas forem necessárias e uma contracapa, tudo em um único arquivo (veja a ferramenta *Booklet*). Cada página é uma **página PDF verdadeira** dimensionada para a caixa daquela página, para que leitores e impressoras recebam páginas reais, não uma imagem comprida.

- **Páginas a partir do conteúdo.** Adicione blocos de texto e imagens; novas páginas são criadas automaticamente conforme os blocos vão preenchendo, e você pode forçar qualquer bloco a começar uma nova página.
- **Tamanhos de página reais.** Escolha A4, US Letter ou A5 (retrato - o layout de duas colunas é feito para isso) - cada página, e o PDF exportado, renderiza exatamente nesse tamanho.

PDFs de múltiplas páginas são documentos RGB e não carregam marcas de corte/sangria - essas pertencem ao caminho de página única do **Print PDF** acima. Eles carregam os mesmos **metadados PDF/X-4** de toda exportação em PDF (caixas de página, XMP, ID do documento, um output intent sRGB com perfil incorporado), e oferecem **Content Credentials** (abaixo) - na ferramenta *Booklet* a opção já vem pré-selecionada.

## Criando várias coisas de uma vez

O Lolly tem três formas distintas de trabalhar em volume, e elas resolvem tarefas diferentes - a edição em lote é uma capacidade de primeira classe da plataforma, não algo que cada ferramenta reinventa:

- <!--i:document--> **Um design × uma tabela de linhas → um documento de múltiplas páginas.** Ferramentas com uma entrada `table` (como *Battlecards*) transformam cada linha em uma página automaticamente - cole uma tabela da sua planilha, obtenha um PDF do tamanho de uma apresentação. Seu editor de lote de verdade continua sendo a planilha: corrija dez linhas lá, cole de novo. A própria ferramenta nunca gerencia páginas.
- <!--i:layers--> **Um design × um arquivo de dados → vários arquivos separados.** A grade de lote do `/pro` pega um CSV e renderiza uma exportação *por linha* - crachás com nomes, certificados, um arquivo cada.
- <!--i:sliders--> **Vários ativos diferentes, editados lado a lado.** O *Multi-edit* abre várias sessões salvas em uma única visualização para retoques coordenados em designs distintos.

Regra prática: linhas do mesmo design que pertencem a **um documento** → uma ferramenta orientada por tabela; linhas que precisam ser entregues como **arquivos separados** → `/pro`; **designs diferentes** que precisam do mesmo ajuste → multi-edit. (Uma opção de renderização "combine media" planejada vai ligar as duas primeiras - concatenando exportações do mesmo formato em um único PDF, um único vídeo ou um contact sheet de revisão.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart e Diagrams podem exportar uma **apresentação PowerPoint** - um slide por página. O objetivo não é uma captura de tela pixel-perfeita; é entregar a um colega uma apresentação que ele possa de fato **editar e extrair ativos**. Por isso cada página é decomposta em objetos nativos:

- <!--i:font--> **Texto** vira **caixas de texto do PowerPoint reais e editáveis** - com o tamanho de fonte, cor, peso, itálico e alinhamento do layout - para você corrigir um erro de digitação ou reestilizar no PowerPoint.
- <!--i:pentool--> **Vetores** (logotipos, ícones, a marca SUSE) são incorporados como **imagens SVG reais** - eles permanecem nítidos em qualquer tamanho, e o PowerPoint pode até *Converter em Forma* neles.
- <!--i:photos--> **Imagens** chegam na resolução nativa como suas próprias imagens extraíveis (um herói recortado com `cover` mantém a imagem completa por trás do recorte, para você poder reenquadrá-la), com qualquer tratamento aplicado na imagem (filtros, blends) incorporado fielmente.
- <!--i:layers--> **Fundos, bordas e regras** viram formas reais de retângulo/linha.

![O painel de exportação com PowerPoint selecionado: um slide por página, texto e formas mantidos editáveis](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

O layout é aproximado por design - o objetivo é **conteúdo** fiel e reutilizável, não uma captura de tela travada. Qualquer coisa que o walker não consiga expressar nativamente (uma região complexa com filtro ou máscara) é incorporada como imagem para que nada se perca. Um deck tem um único tamanho de slide, obtido a partir da primeira página.

O PowerPoint também é uma forma de **entrada**. Solte um `.pptx` em qualquer superfície de upload e escolha os slides que você quer - cada um vira um ativo para posicionar, ajustar ou usar como base. O **Markdown Slides** escreve uma apresentação nova a partir de Markdown (e fornece um modelo `.pptx` com a marca), e o utilitário **Rebrand** retematiza uma apresentação existente no lugar - paleta do tema, cores fixas no código e fontes - sem tocar em seus gráficos, SmartArt ou animações, devolvendo um `.pptx`. Veja [Importar um design → Apresentações e documentos](/info/design-import.html#decks-and-documents).

## Penpot

Qualquer ferramenta que pode exportar SVG também pode exportar um **arquivo Penpot** (`.penpot`) - o documento, pronto para continuar editando no Penpot em vez de apenas olhar.

- <!--i:layout--> A partir do **Design**, cada quadro vira um **board** do Penpot, cada caixa nele é transferida como sua própria forma editável - retângulo, elipse, texto, imagem ou caminho - e o resultado chega como um **componente** reutilizável no painel Assets, pronto para ser arrastado de novo.
- <!--i:pentool--> A partir de uma ferramenta cuja renderização é **geometria pura** - as ferramentas vetoriais como QR Code, Street Map, Wordmark e Palette Lab - todo caminho, retângulo, trecho de texto e gradiente é transferido da mesma forma, como sua própria forma editável.
- <!--i:font--> A partir de uma ferramenta que estrutura sua renderização em **HTML**, o **texto permanece texto** - um objeto de texto editável do Penpot por linha, não um contorno e não uma imagem plana. Uma peça de arte para a qual o Penpot não tem construção - uma ilustração complexa, um canvas ao vivo - segue por conta própria como imagem, para nunca achatar o texto e as caixas ao redor dela. Um layout inteiro que o Penpot não consegue separar fielmente ainda assim pode chegar como uma única imagem em fidelidade total, então nada é descartado.
- <!--i:palette--> Uma cor ou fonte que uma forma **herda de um token de marca** permanece **vinculada** a esse token no arquivo: mude o token no painel Tokens do Penpot e toda forma que o herda é repintada junto, enquanto uma cor literal isolada permanece exatamente onde está. As cores e tipografias da marca também chegam ao painel **Assets** e seu conjunto completo de tokens de design ao painel **Tokens** - o mesmo conjunto de tokens DTCG que a própria paleta do Lolly usa. O Penpot mantém sua própria cópia a partir daí: uma edição feita no seu painel Tokens retorna à marca pela [importação do Brand Studio](/info/design-import.html), não sozinha.

| O que você fez | No Penpot |
|---|---|
| Texto | Objetos de texto editáveis - corrija um erro de digitação ou reestilize |
| Formas, caminhos, gradientes, imagens | Suas próprias formas vetoriais editáveis |
| Uma cor ou fonte de um token de marca | Um vínculo de token ativo - edite o token, toda forma que o herda acompanha |
| O design inteiro | Um componente reutilizável no painel Assets |
| Uma ilustração complexa ou canvas ao vivo | Incorporado por conta própria como imagem, o conteúdo editável ao redor intacto |

![O painel de exportação com Penpot selecionado: o arquivo .penpot, e Enviar para o Penpot ao lado do download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para abri-lo, inicie o Penpot, escolha um projeto e selecione **Import**. Conectado ao Penpot a partir do painel de exportação, **Send to Penpot** faz essa etapa por você - escolha um projeto ali e o arquivo vai direto para ele.

## SCORM (pacotes de curso)

Uma apresentação do Design pode sair como um **pacote SCORM** - o zip que um sistema de gestão de aprendizagem importa, seja Moodle, Canvas, Blackboard ou um LMS corporativo. Escolha **SCORM (LMS)** no seletor de formato e a exportação grava:

- <!--i:layout--> **Os slides**, uma imagem por artboard, como vetor onde o artboard permite e como pixels somente onde não permite.
- <!--i:play--> **O filme narrado** com sua trilha de legendas - as notas do apresentador lidas por uma voz no dispositivo, exatamente como [Apresentando](/info/create/using.html#presenting) as reproduz.
- <!--i:file--> **Uma página de início** que percorre os slides, reproduz o filme e reporta a conclusão de volta ao LMS pelo runtime SCORM 1.2, a versão que todo LMS aceita.
- <!--i:font--> As fontes que a apresentação usa, para que a página de início renderize da mesma forma offline.

![O painel de exportação em uma apresentação do Design com SCORM (LMS) selecionado](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nada no pacote se conecta a um servidor externo: são arquivos em um zip, e ele roda dentro do LMS sem empacotador, sem CDN e sem conta. Os apps web e desktop o constroem; a CLI não, porque fotografar os artboards e codificar o filme exigem o navegador.

## DXF (arquivos de corte)

Ferramentas vetoriais (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, os lockups de logo, Diagram Builder) podem exportar **DXF** - o formato de intercâmbio AutoCAD R12 que cortadoras a laser, plotters de vinil e softwares CNC/CAD leem. A geometria é escrita como **caminhos em milímetros** de contorno (curvas achatadas com tolerância fina), o texto é convertido em caminhos de contorno e a cor é mapeada para o índice de cor AutoCAD (AutoCAD Color Index) mais próximo (que normalmente determina a ferramenta/operação em uma cortadora). O DXF é apenas arte de linha - uma região fotográfica ou filtrada não tem forma de caminho de corte e é descartada (o Lolly avisa), então use SVG/PDF quando precisar manter conteúdo raster.

Street Map é o caso mais claro: o design inteiro já é composto de traços, então cada rua e canal vira um caminho de corte sem nada a descartar.

::: showcase
![Uma renderização do Street Map de Paris em tinta sobre creme - pura arte de linha, então cada traço sobrevive à viagem até uma cortadora](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Ao rolar, a câmera se afasta através da geometria real: sete caminhos, nenhum pixel em lugar nenhum, cada traço nítido como fio de cabelo em qualquer zoom. Esse é o mesmo arquivo que uma cortadora lê.
:::

## SVG animado

Ferramentas de movimento (Animated Ad, Lottie Ad) podem exportar **SVG animado** - uma animação *vetorial* autocontida. Diferente de GIF/APNG/WebP (que amostram cada quadro em pixels), um SVG animado empilha instantâneos vetoriais com keyframes CSS embutidos, então **escala para qualquer tamanho sem codec e sem runtime externo** - ele reproduz em loop em uma aba do navegador ou em um `<img>`. O texto permanece contornado para renderizar em qualquer lugar. Ele compartilha os controles de **Duração** / taxa de quadros dos formatos animados e (sendo mais pesado por quadro que um bitmap) usa uma taxa de quadros padrão mais baixa.

## Transparência

Ferramentas que suportam oferecem um alternador de **fundo transparente** (por exemplo, *No BG*). A transparência é preservada por PNG, WebP, AVIF, SVG (estático e animado), APNG e WebP animado. JPG e PDF são sempre opacos, e TIFF é achatado sobre branco (sobre preto no caminho HDR - veja abaixo).

## Espaços de cor

Duas perguntas diferentes, que vale a pena manter separadas: em quais espaços de cor o Lolly consegue **ler e pensar**, e em quais ele **escreve**.

**Leitura.** Onde quer que uma cor seja escrita - a folha de estilo de uma ferramenta, o preenchimento de um SVG importado, o valor de um token de design, uma sombra ou gradiente dentro de um shorthand CSS - o Lolly lê o vocabulário completo do **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, as cores nomeadas do CSS e `color()` nos espaços predefinidos - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - incluindo componentes escritos como a palavra-chave `none`. Um único parser faz isso para toda a plataforma, então o navegador e todos os walkers de exportação concordam sobre o que uma string de cor significa.

Isso importa mais do que parece, porque um navegador resolve CSS moderno em CSS moderno. Escreva `color-mix(in oklab, …)` e o Chrome computa `oklab(…)`; use um token de marca armazenado como `oklch()` e esse é o valor literal que o walker de exportação vê. Cores nessas formas são lidas corretamente em vez de descartadas - o que fazia um walker que só entendia `rgb()`, exportando texto colorido pela marca como preto, perdendo painéis com matiz e regras de tabela e lendo `oklch(0.7 0.1 200) 0px 2px 4px` como um deslocamento de sombra de 0.7 por 0.1.

**Raciocínio.** A matemática de cor acontece de forma perceptual, e não em canais brutos. A derivação de paleta, rampas, harmonias e contraste rodam em **OKLCH/OKLab**, e uma cor fora do gamut é trazida para dentro do intervalo pelo próprio algoritmo de mapeamento de gamut do CSS Color 4 - redução de croma com verificação de distância perceptual - em vez de recorte de canais, então uma cor vívida se estabelece na cor mais próxima que você realmente aceitaria, em vez de uma achatada. Os gradientes interpolam em um espaço que você escolhe (OKLab por padrão, ou `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, com uma direção de percurso de matiz para os polares), e a mistura é **pré-multiplicada**, então um esmaecimento para transparente mantém a cor certa em vez de escurecer rumo ao preto no caminho. Um único interpolador atende tanto a prévia quanto os walkers de exportação - o que foi o que impediu um gradiente cônico de ser misturado de um jeito na tela e de outro no arquivo exportado.

**Escrita.** A saída é deliberadamente mais estreita que a entrada, porque um arquivo precisa ser legível por seja lá o que o abrir, e um espaço só é *declarado* na saída quando os números foram de fato convertidos para ele. Formatos de tela e web são escritos como **sRGB** e marcados como tal; os formatos de impressão são escritos como **CMYK** contra uma condição de prensa nomeada (abaixo); e o caminho HDR é **Rec.2100 PQ** (acima). Uma cor de gamute amplo que chega a uma exportação é mapeada para sRGB em vez de rotulada incorretamente - carregar `color(display-p3 …)` até um arquivo vetorial é uma extensão planejada, não algo que as exportações de hoje afirmam fazer. Um gradiente criado em OKLab é *pré-calculado* em paradas sRGB simples na saída, com paradas extras inseridas apenas onde o sRGB divergiria visivelmente da curva perceptual, porque um `<linearGradient>` de SVG e um shading axial de PDF não têm nenhuma configuração de espaço de interpolação para carregar a intenção. Um valor criado, três renderizadores, sem desvio.

## Perfis de cor

Para que as cores se reproduzam fielmente em aplicativos com gerenciamento de cor (gráficas, Photoshop, navegadores), as exportações são **marcadas com um perfil de cor**:

- **PNG / JPG** carregam um perfil ICC **sRGB** embutido - o espaço de cor em que a pré-visualização é de fato renderizada - para que nada fique por adivinhar. (Apenas marcação; os pixels não são recodificados.)
- **PDF de impressão (CMYK)** declara uma **condição de prensa** alvo em seu *OutputIntent* (padrão *Coated FOGRA39*), informando a um RIP/gráfica como suas tintas CMYK devem ser lidas. Amostras de marca com valores de tinta medidos são convertidas exatamente; outras cores usam uma conversão de dispositivo padrão. Essa declaração é um *nome*: nenhum perfil CMYK acompanha o Lolly, e o PDF/X-4 exige o perfil embutido, então uma condição nomeada escreve a intenção de saída sem alegar conformidade PDF/X-4. Carregue um perfil CMYK seu e escolha sua linha **Embed** no controle Perfil de cor, e ele é embutido como o *DestOutputProfile* do arquivo - nesse ponto o PDF pode genuinamente ser PDF/X-4, e o afirma sempre que o resto do arquivo permite. Três coisas retêm a alegação enquanto mantêm a intenção de saída (um RIP ainda quer isso): arte RGB que a passagem CMYK não conseguiu converter, o texto de crédito de margem de prova `prov` (desenhado em uma fonte padrão que não é embutida, e o X-4 não abre exceção para isso) e uma senha **Strong**, já que o X-4 proíbe criptografia. A condição que ele declara é então lida a partir desse perfil: um nome registrado onde o perfil comprova um, `Custom` sob o próprio nome do perfil onde não comprova, para que o arquivo nunca possa nomear uma condição de prensa enquanto carrega as medições de outra.
- **TIFF de impressão (CMYK)** escreve pixels **DeviceCMYK** não marcados e registra a mesma condição de prensa como proveniência em seus metadados TIFF (*ImageDescription*) em vez de embutir um perfil. O mesmo controle de Perfil de cor comanda os dois formatos CMYK - um TIFF não consegue embutir um perfil de prensa de forma alguma, então uma linha **Embed** apenas registra o próprio nome desse perfil ali, nada além disso.
- **TIFF (RGB)** é o irmão sRGB simples e não comprimido - um raster sem perdas no DPI escolhido para arquivamento ou uma ida e volta em um editor, com a proveniência registrada nos mesmos metadados TIFF. Qualquer transparência é achatada sobre branco (esse perfil não carrega alfa). Assim como o TIFF CMYK, é apenas para desktop, já que navegadores não conseguem pré-visualizar um TIFF e downloads no celular chegam a um beco sem saída.
- **SVG**, **EMF**, **EPS** e **DXF** são vetores independentes de resolução e perfil sem perfil embutido - as cores do SVG são sRGB simples, as do EMF e do EPS são RGB de dispositivo (e o **EPS (CMYK)** escreve DeviceCMYK ingênuo) e o **DXF** carrega o índice de cor AutoCAD mais próximo. (SVG, EPS e DXF, como o PDF, convertem qualquer texto em caminhos vetoriais, para que o resultado renderize mesmo onde a fonte não está instalada. O EMF, em vez disso, mantém o texto VIVO por padrão - registros de texto de metarquivo reais que permanecem selecionáveis e editáveis no Office e no Google Slides, recorrendo a contornos apenas para trechos que o formato não consegue expressar; a opção "Outline fonts" do painel de exportação força caminhos em todo lugar.) O **SVG** também reproduz o `box-shadow` do CSS a partir do HTML - cada sombra externa é pintada atrás da caixa, com deslocamento/espalhamento e desfoque gaussiano para corresponder ao navegador, e sombras internas são pintadas dentro dela da mesma forma.

Isso é automático - nenhuma configuração para mexer. Miniaturas e pré-visualizações pulam a marcação para permanecerem pequenas. Um perfil *é* uma escolha, porque muda os pixels em vez de apenas rotulá-los - veja **HDR** abaixo.

## HDR (cores vivas)

Exportações comuns são sRGB: branco é branco, e uma cor de marca saturada é tão brilhante quanto o branco normal da tela. Em um display com capacidade HDR há muito espaço de sobra acima disso, e o cartão **HDR** no painel de exportação usa isso - suas cores de marca e o texto branco são impulsionados em direção ao brilho máximo para que genuinamente *brilhem*, enquanto as áreas escuras permanecem escuras e dão contraste ao brilho.

![O cartão HDR no painel de exportação, ligado, com os controles White / Reach / Dark lift / Focus revelados abaixo dele](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formatos.** Os formatos raster com um lugar para carregar o sinal: **PNG**, **JPG**, **AVIF** e **TIFF**. (Não WebP - é de 8 bits sem caminho de decodificação HDR funcional, então um PQ WebP simplesmente pareceria escuro. Vetores e PDF não têm modelo de HDR algum.)
- **Desativado por padrão**, ao contrário da marcação de cor - ele altera os pixels, então é opt-in. Marque o cartão, ou passe `hdr=1` em um link compartilhado.
- **O que é de fato gravado.** Os pixels são recodificados para **Rec.2100 PQ** - primários BT.2020 com a curva de transferência SMPTE ST 2084 (PQ) - e o contêiner carrega o sinal correspondente para que um app com gestão de cor saiba lê-los dessa forma: um **perfil ICC v4 gerado com tag `cicp`** (JPG, TIFF), um **chunk `cICP`** (PNG) ou uma caixa `colr` reescrita (AVIF). O reforço é controlado pela **luminosidade perceptual (OKLab)**, então cores médias e acima ganham força até o pico e as escuras são acalmadas em vez de estouradas, e preserva o matiz - um verde da marca fica mais brilhante, não esverdeado tipo hortelã.
- **Os controles.** Quatro, revelados quando o cartão está ativo: **White** (o teto de brilho de pico, 400-2000 nits), **Reach** (até onde os tons o brilho se espalha), **Dark lift** (quanto as sombras clareiam - `0` as mantém escuras) e **Focus** (quanta riqueza de cor o reforço mantém). Eles viajam no mesmo parâmetro como um valor ajustado compacto - `hdr=1600-60-0-50` é White 1600, Reach 60, Dark lift 0, Focus 50 - para que um visual ajustado seja reproduzível a partir do link.
- **Onde você vai vê-lo.** Visualizadores com gestão de cor em uma tela HDR: Preview / Quick Look / Safari em dispositivos Apple, Chrome em um monitor HDR. Em uma tela SDR comum o arquivo ainda aparece como uma imagem normal.
- **Saiba antes de publicar.** Muitas plataformas **recodificam** o que você envia e removem o sinal HDR - redes sociais, apps de mensagens, alguns CMSes - o que pode deixar a imagem parecendo escura ou lavada. Use HDR onde você controla o destino (um site que você constrói, um painel de vídeo, uma apresentação em uma tela brilhante), não como padrão para tudo.
- **Transparência.** PNG e AVIF mantêm seu alfa; JPG é opaco como sempre. O caminho **TIFF** achata sobre **preto**, não sobre o branco do caminho SDR - em PQ, o branco é o código de 10.000 nits, então achatar sobre ele criaria um halo cegante em cada borda.
- **Os mesmos bytes a partir do terminal.** `--hdr=1` com `--export=png` ou `--export=jpg` grava o PNG Rec.2100 PQ de 16 bits e o JPEG com gain map ISO 21496-1 na [CLI](/info/cli.html) também, a partir dos mesmos codificadores do engine em vez de um navegador - então uma ferramenta nativa em `<svg>` produz um arquivo HDR sem nenhum Chromium em qualquer parte do caminho, e o PNG é byte a byte idêntico ao do shell web. AVIF e TIFF permanecem exportações exclusivas do shell web por enquanto.

## Vídeo

Ferramentas animadas exportam movimento como **MP4**, **WebM** ou **GIF** - e, onde oferecido, **APNG**, **WebP animado** ou o **SVG animado** vetorial (acima). Qual contêiner de vídeo você vê depende do seu navegador - o seletor só mostra o que ele consegue de fato gravar:

| Navegador | Mostra |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 e WebM** |
| Chrome mais antigo | **WebM** |

O GIF funciona em qualquer lugar (ótimo para chat/e-mail; maior e com menos cores que vídeo). Ferramentas animadas também expõem **Wait** (segundos para deixar a animação se estabilizar antes de gravar) e **Duration** (duração do clipe).

> Um link compartilhado `?format=…` que solicita um contêiner que seu navegador não consegue gravar recorre graciosamente ao outro e nomeia o arquivo de acordo.

**Som.** Exportações de vídeo não são silenciosas. Uma ferramenta pode colocar uma **trilha musical** sob o clipe - um ativo de áudio do catálogo, em loop ou cortado para a duração do clipe, com fade-in/out, volume e ducking automático sob o som da própria filmagem - e as ferramentas de gravação levam o áudio ao vivo de sua filmagem direto para o arquivo. **MP4** e **WebM** mantêm a faixa mixada; GIF e os formatos de imagem animada (APNG, WebP animado, SVG animado) são silenciosos por natureza.

## Áudio

Algumas ferramentas exportam **áudio sozinho**, não apenas como faixa de vídeo. O **Voice Recorder** captura uma gravação de microfone com um medidor de nível ao vivo e orientação suave, então a salva como **MP3** (o padrão, transcodificado no seu navegador) ou em seu contêiner nativo - **M4A** (AAC), **OGG** ou **WebM** (Opus), o que quer que seu navegador tenha gravado. Como em tudo o mais, a codificação acontece no seu dispositivo - nada é enviado.

O áudio que você *traz* é igualmente amplo. O seletor de ativos aceita **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** e **FLAC** (mantidos byte a byte e decodificados no dispositivo), **MIDI** (`.mid` - convertido na importação para uma pequena faixa de sintetizador no dispositivo) e **módulos tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (decodificados no dispositivo por um player embutido, alguns kilobytes de dados de música). Qualquer um desses pode virar a **trilha musical** sob uma exportação de vídeo, ou tocar no player ambiente do Modo Neurospicy.

O áudio *é* parte do pipeline `format=` / `--export=` abaixo: `wav`, `mp3`, `m4a` e `opus` são ids de formato comuns, então uma exportação só de áudio é tão compartilhável e programável quanto um PNG. O que sai é apenas o som, sem imagem.

## Proveniência e marca d'água

Onde o formato suporta, as exportações carregam **metadados de proveniência** - software, origem, o nome da ferramenta e sua linha de crédito de perfil - embutidos nativamente (PNG iTXt, JPEG EXIF, info do PDF, `<metadata>` do SVG, comentário do GIF). É apenas autoria; nada é enviado. Ferramentas **Experimental** também estampam uma marca d'água visível, aplicada pelo host para que não possa ser removida editando a ferramenta.

**O Lolly Imprint.** Exportações raster também carregam a própria **marca d'água de pixel invisível** do Lolly - o *Lolly Imprint* - **ligada por padrão**, assim como o Content Credentials. Enquanto a credencial e os metadados de proveniência viajam *ao lado* dos pixels e se perdem em um re-salvamento, uma captura de tela ou uma remoção de metadados, o Imprint vive *dentro* dos pixels e sobrevive à recompressão - então uma cópia da imagem ainda pode ser reconhecida como feita pelo Lolly mais tarde. É uma pista durável, não uma garantia criptográfica, e é apenas de presença (não carrega nenhum dado pessoal). Ele viaja em **PNG, JPG, WebP, AVIF, TIFF e BMP**, e nos rasters renderizados pelo Lolly compostos em um **PDF ou PPTX** - nunca em uma imagem que *você* incorporou, apenas no que o próprio Lolly renderiza. Desmarque o cartão **Lolly Imprint** no painel de exportação para pular, ou passe `imprint=0` em um link de compartilhamento. (A sobrevivência do AVIF através de recodificação ainda não está calibrada; a detecção em PDF/PPTX cobre os rasters Lolly embutidos.) [/verify](/verify) detecta no dispositivo - veja [Identidade do Content Credentials](/info/content-credentials-identity.html#the-lolly-imprint).

**A credencial durável.** Uma segunda marca, mais pesada, fica ao lado do Imprint: **Durable credential**, que usa um modelo neural no dispositivo (formato TrustMark) para escrever o id do Lolly *nos* pixels para que o vínculo "feito com o Lolly" sobreviva a uma remoção de metadados, uma recodificação e uma nova leitura por ferramentas cientes de TrustMark além das próprias do Lolly. É **desligada por padrão** - diferente do Imprint em JavaScript puro, ela custa uma passagem neural por exportação mais um download único de modelo, então é um opt-in deliberado em vez de uma taxa silenciosa. Apenas raster (**PNG, JPG, WebP, AVIF, TIFF**), marcada no painel de exportação ou passada como `durable=1` em um link de compartilhamento. Nos apps de desktop e mobile o cartão fica completamente oculto em vez de exibido como um no-op, porque não há origem de onde buscar o modelo offline.

**Proteção de conteúdo.** No painel de exportação, *Password protect*, **C2PA Credentials**, o **Lolly Imprint** e o **Durable credential** se dobram em um único grupo **Content protection** colapsado e ciente do formato, para que as opções de proveniência e proteção de um arquivo fiquem em um só lugar - o grupo mostra apenas os cartões que se aplicam ao formato escolhido, e se esconde inteiramente quando nenhum deles se aplica. As marcas de impressão deliberadamente *não* estão nele: são geometria de produção de impressão, não proteção, então **Print marks & bleed** - a medida de sangria em milímetros mais Crop, Registration, Bleed, Colour bars e Stamp details - mantém seu próprio cartão de nível superior nos formatos de impressão.

![O grupo Content protection aberto em uma exportação PNG, mostrando apenas os cartões que se aplicam a ela](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Antes de exportar (preflight de impressão).** Ative o **Print preflight** (`export-preflight`) nas feature flags do seu Perfil - ele está **desligado por padrão**, para que uma pessoa exportando um PNG para uma mensagem de chat nunca seja emboscada por achados de pré-impressão, e um plano de controle de implantação ([lolly.work](https://lolly.work)) pode deixá-lo ligado por padrão para seus membros - e um cartão **Before you export** aparece ao pé do painel, imediatamente acima dos botões, sempre que as regras de impressão têm algo verdadeiro a dizer sobre o trabalho: formato, tamanho e sangria, depois áreas de corte e sangria, cobertura de tinta, contagem de chapas e contagem de páginas, com um veredito ao lado do seu título. Ele fica sob toda configuração porque é uma afirmação *sobre* essas configurações, não mais uma delas - e nunca bloqueia uma exportação. Ele diz o que uma gráfica está prestes a ver.

**Custo, calculado a partir da sua tabela de preços.** Abaixo do preflight - por último, ainda acima dos botões - fica um cartão que transforma essas mesmas contagens em dinheiro, e só a partir de preços que alguém realmente informou. Ele lê o que quer que a passagem de preflight tenha contado, esteja o próprio cartão de preflight ligado ou não, e precisa de duas coisas verdadeiras: o trabalho tem algo que uma lista de preços pode de fato precificar (chapas, folhas, área, páginas, linhas de variante ou arquivos de saída - então um PNG de logotipo simples nunca o mostra), **e** uma **tabela de preços** está presente. Uma tabela de preços é uma lista de preços em JSON da sua gráfica. Uma build padrão não traz nenhuma e não tem forma no app de carregar uma: ela chega ou como um ativo de catálogo que uma implantação distribui, ou através da extensão opcional de tabela de preços que um auto-hospedeiro ou plano de controle ativa. Sem uma tabela de preços, nada é mostrado - nem uma solicitação, nem uma tabela vazia.

A regra em torno da qual tudo isso é construído é que ela **nunca inventa dinheiro**. Cada valor é uma taxa que você forneceu vezes uma quantidade que o Lolly contou - `4 chapas × €35,00` - e o total nomeia a própria fonte na mesma frase que o valor: o emissor que a tabela nomeia, e a data em que a tabela diz que suas taxas são de. Não há moeda padrão, nenhum placeholder e nenhum zero substituindo um preço ausente. O que o arquivo diz sobre si mesmo permanece como discurso reportado: *"O arquivo diz: … O Lolly não verificou isso."*

E quando não consegue calcular honestamente, a tabela de trabalho **desaparece** em vez de degradar-se em um valor acinzentado ou preenchido:

- Linhas que a tabela não precifica significam **nenhum total**, apenas um título dizendo quantas delas não têm preço. Uma soma parcial não é uma resposta menor, é uma resposta errada.
- Uma quantidade que é um teto em vez de uma contagem exata carrega **"até"** até o seu subtotal, para que um limite nunca seja disfarçado em um valor fixo.
- Taxas passadas de sua data de validade mostram **apenas contagens**, até você clicar em *Use these rates anyway* - e então a data de expiração viaja junto com o valor, para que um total vencido não possa ser lido como um atual.
- Aberto por um **link**, o dinheiro fica oculto até você pedi-lo neste dispositivo. Nem o cartão nem essa revelação jamais viajam em uma URL - a mesma razão pela qual a CLI aceita `--rate-card=<file.json>` como uma flag de arquivo local e nunca como um parâmetro de link.

O cartão é chrome, nunca conteúdo: ele é removido de todo estágio de exportação, então não pode mover um único pixel do arquivo que você baixa. E é aritmética, não um orçamento - só a sua gráfica pode te dar um.

**Renderizações compostas.** Quando uma ferramenta incorpora a saída de outra ferramenta (por exemplo, um *Event Name Badge* incorporando um *QR Code*), a renderização aninhada é embutida na exportação do pai - ela permanece um **vetor verdadeiro** em SVG e PDF e rasteriza com nitidez em PNG/JPG/WebP. O filho incorporado é um intermediário: ele não recebe *nenhuma* marca d'água e *nenhuma* proveniência própria; só o ativo pai finalizado recebe. (A composição cobre SVG e os formatos raster; HTML/MD/TXT não podem ser compostos.)

## Proteção por senha

Dois tipos independentes de bloqueio, ambos inteiramente no dispositivo.

**Senha de abertura do PDF** - o cartão *Password protect* do painel de exportação oferece dois níveis:

![O cartão Password protect expandido em uma exportação de PDF, com o campo de senha e os dois níveis de bloqueio](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - um bloqueio básico de 40 bits (RC4). Abre em *qualquer* app de PDF e - por ser um deterrente leve, não uma proteção real - pode viajar em um link de compartilhamento (texto claro, por design). Somente `pdf` RGB.
- **Strong** - AES-256 (PDF 2.0). Sua senha é digitada na exportação e **nunca** vai para um link; abre apenas em apps de PDF mais novos (Acrobat / Preview ~2018 em diante), e apps mais antigos podem reportar o arquivo como corrompido. Strong também se aplica a **PDFs Print / CMYK** e a **cada PDF dentro de um zip em lote** (o diálogo de confirmação do lote coleta a senha). Como o PDF/X-4 proíbe criptografia, um PDF Print bloqueado com Strong mantém seu CMYK, marcas e output-intent, mas perde a conformidade PDF/X-4.

Qualquer um dos níveis é mutuamente exclusivo com Content Credentials (um PDF criptografado não pode receber a credencial).

**Downloads bloqueados (zip inteiro + defesa em profundidade)** - uma exportação em **ZIP** (o formato *ZIP* do painel de exportação, que agrupa vários formatos de uma ferramenta), um download de **pasta** (Projects → Download) ou a **grade de lote** podem bloquear o zip inteiro com uma senha, em dois níveis:

- **Standard** - **ZipCrypto** tradicional: abre em *qualquer* ferramenta de descompactação, incluindo a extração nativa do Windows Explorer, mas é fraco (um deterrente). Sua senha pode viajar em um link de compartilhamento `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): forte, mas **não** abre na extração nativa do Windows Explorer - o destinatário precisa de 7-Zip / WinZip / Keka / macOS. Digitada na exportação, nunca vai para um link.

O mesmo cartão *Password protect* no painel de exportação controla os bloqueios de PDF e ZIP, reformulando-se para o formato escolhido. A senha protege **todos** os membros - imagens, SVG, tudo, PDFs inclusive (apenas o container zip pode proteger arquivos que não são PDF, que não têm bloqueio próprio). E é **defesa em profundidade**: qualquer PDF interno também é bloqueado individualmente com AES-256 usando a mesma senha, então um PDF continua bloqueado mesmo depois de o zip ser descompactado. O prompt aparece ao iniciar o download; uma senha em branco significa nenhum bloqueio.

**Links de compartilhamento protegidos por senha** - qualquer link de compartilhamento pode ser criptografado para que abri-lo peça uma senha ao destinatário. Todo o estado do link é criptografado em AES-256 sob uma chave derivada da senha (PBKDF2); apenas o texto cifrado viaja, então a **senha nunca está no link** e a descriptografia acontece **no navegador do destinatário** - o servidor que serve o link vê apenas o texto cifrado na URL, nunca a senha nem o design decifrado. Ative isso no diálogo **Share**. Um link criptografado só pode ser *aberto* no Lolly (não pode ser incorporado como imagem, já que esse caminho não pode pedir a senha). Veja [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Exportações podem carregar **Content Credentials** - um manifesto [C2PA](https://c2pa.org) assinado, embutido no arquivo, que registra, de forma à prova de adulteração, que o arquivo foi feito com o Lolly e não foi alterado desde então. É a versão padronizada dos metadados de proveniência acima: uma afirmação criptográfica (o que fez o arquivo, quando, por quem e onde) vinculada a um hash dos bytes do arquivo, de modo que qualquer edição posterior é detectável por um visualizador compatível com C2PA. O padrão é mantido pela [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon e outras), então as mesmas credenciais que o Lolly grava são as que câmeras, redações e suítes criativas estão adotando.

![O cartão C2PA Credentials, pré-marcado, com a vida útil da credencial ao lado](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formatos.** Todo container com incorporação C2PA: **PDF** (RGB e Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB e Print), **WebP** (estático e animado), **AVIF**, **MP4**, **WebM** e os containers de áudio **MP3**, **WAV**, **M4A** e **OGG/Opus** - então um clipe de voz gravado ou sintetizado sai com a mesma credencial que uma imagem. Um pacote **ZIP** carimba cada membro compatível individualmente, o que também é onde um **Animated SVG** recebe uma (por baixo é um documento SVG comum; uma exportação direta de Animated SVG não oferece cartão próprio). MP4, AVIF e M4A usam o binding BMFF da especificação e MP3 seu mapeamento ID3v2, então `c2patool` e outros visualizadores compatíveis com C2PA os verificam; **WebM** e **OGG/Opus** ainda não têm mapeamento C2PA padronizado, então o Lolly carrega o manifesto como um anexo Matroska e um campo OpusTags, respectivamente, que o próprio verificador do Lolly (e o CLI) checam. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, os formatos do Office e os formatos de texto/dados não têm container C2PA.)
- **Ativado por padrão.** O cartão **C2PA Credentials** no painel de exportação vem pré-selecionado para quase toda ferramenta - desmarque para pular a credencial em uma única exportação (ou passe `c2pa=off` em um link de compartilhamento). Uma ferramenta pode optar por não usar isso de vez, no seu manifesto.
- **O que registra.** A ferramenta e o app que fizeram o arquivo, o horário de assinatura, a superfície de exportação (família do motor do navegador + família do SO - propositalmente genérico, nunca uma impressão digital) e - somente quando *Profile → Use my details* está ativo - seu nome e e-mail como autor da obra.
- **O que os destinatários veem.** Ferramentas que inspecionam content credentials (apps da Adobe, `c2patool`, contentcredentials.org/verify) leem o manifesto e mostram a afirmação. Como o Lolly assina com uma chave gerada **no seu dispositivo** - não um certificado de uma lista de confiança - os visualizadores reportam como uma credencial *não verificada*. A estrutura e a evidência de adulteração são reais; a identidade do assinante simplesmente não é atestada por uma autoridade. Para melhorar isso, você pode registrar uma **identidade verificada** (Profile → Content Credentials): um certificado de curta duração da Lolly CA vincula seu e-mail às suas exportações, enquanto a chave de assinatura ainda nunca sai do seu dispositivo - veja [Content Credentials Identity](/info/content-credentials-identity.html).
- **Verificando um arquivo.** O Lolly também verifica suas próprias credenciais: solte qualquer arquivo em [/verify](/verify) (ou execute `lolly validate <file>` no CLI) para um relatório no dispositivo - com destaque para se o arquivo foi genuinamente feito com o Lolly e não mudou desde então. A visualização Verify web vai muito além da credencial: ela sinaliza **conteúdo gerado por IA**, detecta o **Lolly Imprint**, checa assinaturas **SEAL** e (opcional) marcas d'água de pixel de terceiros, e revela **dados ocultos** - tudo no dispositivo, nada é enviado. Veja [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privacidade.** Tudo acontece no seu dispositivo: a chave de assinatura é criada para a exportação e nunca sai do navegador, nada é enviado e a afirmação contém apenas o que os metadados de proveniência já carregam. Utilitários de privacidade (transformações no dispositivo dos *seus próprios* arquivos) nunca adicionam credenciais, e *Strip Hidden Data* remove um manifesto C2PA como qualquer outro metadado embutido.
- **Interações.** Para PDFs, Content Credentials e **proteção por senha** (qualquer um dos níveis - veja acima) são mutuamente exclusivos (um PDF criptografado não pode receber o anexo da credencial). A credencial é adicionada como etapa final sobre os bytes finalizados - depois da marcação de DPI/EXIF/perfil de cor, metadados PDF/X e marcas de impressão.

## No celular

Os controles de exportação ficam atrás do botão flutuante **Render**, que abre a folha **Export** - mesmos formatos, tamanho, copiar, download e compartilhar, dimensionada para toque.

## Referência de formatos

Todo id que o host consegue renderizar, agrupado. Também são os valores do parâmetro de URL `format=` e da flag `--export=` do CLI - veja [URL Mode](/info/url-mode.html) e [CLI](/info/cli.html). Uma ferramenta oferece apenas o subconjunto que sua autora declarou, então o seletor é sempre menor que esta lista.

| Tipo | Ids |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (TIFF RGB) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vetor | `svg` · `svgz` (SVG compactado com gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (arquivo de corte) |
| Página e documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (pacote de curso SCORM, um zip) · `penpot` (arquivo de design Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Movimento | `gif` · `apng` (PNG animado) · `webp-anim` (WebP animado) · `svg-anim` (SVG animado) · `webm` · `mp4` |
| Áudio | `wav` · `mp3` · `m4a` · `opus` |
| Texto e dados | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (paleta do GIMP) |
| Pacote | `zip` |

Alguns ids adicionais vêm do **hook de exportação próprio de uma ferramenta**, e não do caminho de renderização compartilhado: `ase` (Adobe Swatch Exchange, do Palette Lab), `exr` e `hdr` (rasteres de alta faixa dinâmica do Darkroom) e `ttf` / `otf` / `woff` (Font Convert). Eles são escolhidos da mesma forma - o seletor, `format=`, `--export=` - os bytes é que são construídos pela ferramenta. Font Convert é a única exceção: ela transforma um arquivo de fonte que *você* fornece, então não há nada para uma URL simples renderizar.
