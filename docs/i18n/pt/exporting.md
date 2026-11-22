# Exporte um arquivo

Pressione **Export**, a metade esquerda da pílula **Export | Save**, escolha um formato ao lado do nome do arquivo e pressione **Download**. O arquivo é feito no seu dispositivo.

O arquivo contém o que você vê no canvas. O menu de formatos lista apenas o que esta ferramenta consegue gerar neste navegador.

A maioria dos trabalhos precisa de um de três formatos:

| Para | Escolha | Porque |
|---|---|---|
| Uma tela, uma mensagem ou um slide | **PNG** | Todo app abre, e ele mantém um fundo transparente quando a ferramenta oferece um |
| Uma página finalizada ou qualquer coisa impressa | **PDF** | Um tamanho de página real que imprime como se vê; **Print PDF**, quando uma ferramenta oferece, é a versão CMYK para gráfica |
| Arte que precisa ficar nítida em qualquer tamanho | **SVG** | Formas vetoriais |

::: check Confira o arquivo no tamanho em que será usado
Antes de enviar o arquivo, abra-o na tela para a qual foi feito ou imprima-o no tamanho real.
:::

::: details Aprovações e entrega com o Lolly Work (opcional)
Uma [organização que usa o Lolly Work](/info/organisation.html) pode escolher quais formatos e configurações de exportação seus membros veem. Onde a aprovação é exigida, **Request approval** substitui **Download**. Siga a política que sua instância mostra.

O Lolly Work também pode entregar um arquivo a destinos S3, WebDAV e HTTP configurados, com etapas de aprovação, recibos de entrega e um registro de auditoria. Essa entrega envia o arquivo ao serviço da organização. Um download comum fica no seu dispositivo. Os destinos pessoais de Send e a entrega da organização são configurados separadamente.

Os operadores configuram isso com o [guia de entrega da organização](/info/work-delivery.html). Para renderizações e lotes em fila no servidor, veja [Lotes e automação pela CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Como a exportação funciona

Três caminhos produzem um arquivo. A maioria das ferramentas **renderiza o canvas**. Os formatos de texto e dados (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) são **gerados a partir do conteúdo da ferramenta**. Utilitários de privacidade como o *Lolly Strip Hidden Data* **transformam o arquivo que você escolheu** no seu dispositivo. O resultado não tem canvas, marca d'água nem metadados adicionados.

![Três caminhos de exportação convergem em um arquivo final: renderizar o canvas, gerar texto ou dados a partir do conteúdo ou transformar um arquivo escolhido no dispositivo.](/info/diagrams/concepts/three-export-paths.svg)

O autor de uma ferramenta escolhe quais ações o painel de exportação oferece. O conjunto padrão é Copy, Download e Save.

- <!--i:download--> **Download** salva o arquivo. Se você não conseguir encontrá-lo depois, veja [Encontre um arquivo que você baixou](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** coloca a imagem na sua área de transferência. Quando um navegador não consegue copiar imagens, Copy baixa o arquivo e avisa você.
- <!--i:folder--> **Save** guarda o design atual em Projects e nunca baixa um arquivo. **Save as**, ao lado de **Download**, pergunta onde (veja [Salvando e continuando](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** abre a caixa Share: um link que reproduz o design, os alternadores para ações ao abrir (tela cheia, painel de exportação, baixar ou copiar ao abrir) e um **Shortest link** opcional que compacta o estado em um token curto (veja [Modo URL](/info/url-mode.html)).

**Send to**, um cartão no painel de exportação, envia o arquivo a um serviço que você conectou. Depois de um envio ao Google Drive, Nextcloud, um bucket S3, Dropbox ou OneDrive, **Create a share link** pode criar um link lá sem um segundo upload. A seção **Share through your cloud** da caixa Share envia um arquivo `.lolly` e cria seu link em uma etapa. O painel de links mostra quem pode abrir o link, onde o arquivo fica e quando o link expira. **Links you've shared**, na caixa Share, permite parar de compartilhar. Links do Nextcloud podem ter uma senha e uma data de expiração. Links S3 duram de 1 a 7 dias e não podem ser desativados antes. O Lolly não guarda cópia do arquivo nem token de login em um servidor. [Privacidade](/info/privacy.html#every-network-request-the-app-can-make) lista o que cada serviço recebe.

![O painel de exportação - formato, tamanho e as ações Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Quando um design incorpora a renderização de outra ferramenta, como uma caixa de imagem do Lolly Design que contém um link do QR Code, a exportação do pai desenha a renderização aninhada. Ela permanece vetorial em SVG e PDF e é rasterizada em PNG, JPG e WebP. A renderização incorporada não recebe marca d'água nem procedência própria; apenas o arquivo final recebe. Exportações em HTML, Markdown e TXT não conseguem conter uma renderização composta.

<!--i:eti-file-->
## Escolha um formato

O nome do arquivo e o menu de formato ficam juntos como um único par `name.format`, abaixo de **Download**.

![O campo de nome do arquivo unido ao seletor de formato, para que a exportação apareça como um único par name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Comece pelo destino do arquivo. Cada cartão lista os formatos adequados para esse destino.

::: figure exporting-format-chooser
Seis destinos e os formatos adequados para cada um.
:::

Um logotipo composto na fonte do seu sistema de design é exportado como SVG com cada letra como um caminho contornado. O arquivo continua nítido em qualquer tamanho.

O texto em outro idioma depende das fontes que você tem. Quando uma fonte do seu sistema de design tem as letras, SVG e PDF as desenham como contornos, moldadas e na ordem de leitura, inclusive linhas da direita para a esquerda. Quando nenhuma tem, o Lolly usa uma [fonte de reserva](/info/fallback-fonts.html), e o cartão de exportação mostra essa fonte. O texto que nenhuma fonte de reserva cobre continua como texto ativo em um SVG, desenhado pelas fontes do próprio visualizador. Em um PDF, EPS ou WMF, e em um EMF com **Outline fonts** ativado, esse texto vira imagem. Essas palavras ficam como na página, mas não podem ser selecionadas nem pesquisadas. O cartão de exportação lista essas escritas. Adicione uma fonte com essas letras para mantê-las como texto vetorial.

![Um logotipo de traços finíssimos e espaçamento amplo que diz Aurora, o tipo de arte puramente vetorial de que trata a linha SVG da tabela](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Todos os formatos e para que servem
| Você quer | Use | Por quê |
|---|---|---|
| Logotipos nítidos ou arte que escala | **SVG** | Vetorial: escalável, pequeno e editável; um efeito que a exportação vetorial não consegue desenhar é incorporado como imagem |
| Vetor para Office e apps do Windows | **EMF** | Cola como vetor editável no PowerPoint e no Word, com texto ativo; o Google Drive o abre no Google Drawings |
| Vetor para impressão e apps de design | **EPS**, ou **EPS (CMYK)** | Vetor PostScript para Illustrator e fluxos de gráfica |
| Vetor para máquinas de corte | **DXF** | Cortadoras a laser, plotters de vinil e CNC: caminhos de contorno em milímetros |
| Um deck de slides editável | **PowerPoint** (PPTX) | Texto e formas nativos editáveis, com imagens e vetores que podem ser extraídos |
| Um documento de texto editável | **Word** (DOCX) ou **OpenDocument** (ODT) | Parágrafos e títulos que um processador de texto pode continuar editando (Lolly Doc Studio) |
| Um layout para InDesign | **InDesign IDML (static subset)** | Texto, retângulos, ovais e imagens, uma página dupla por prancheta (Lolly Design) |
| Um documento Penpot editável | **Penpot** | Pranchetas, formas, texto e tokens vinculados |
| Uma foto ou imagem de uso geral | **PNG** (sem perdas) ou **JPG** (menor) | Raster universal |
| Imagens modernas menores | **WebP** ou **AVIF** | Melhor compressão, com transparência |
| Impressão | **PDF**, ou **Print PDF** (CMYK) | Tamanho de página real; CMYK para uma gráfica |
| Raster de impressão para uma gráfica | **Print TIFF** (CMYK) | Pixels DeviceCMYK para um RIP |
| Animado para a web | **GIF** | Roda em qualquer lugar; arquivos maiores |
| Animado com cor total e transparência real | **APNG** | PNG animado: sem limite de paleta |
| Animado, menor arquivo | **Animated WebP** | Cor total e transparência, menor que GIF ou APNG |
| Vetor animado que escala | **Animated SVG** | Autocontido; repete em loop em um navegador ou em um `<img>`, em qualquer tamanho (Lottie Ad) |
| Uma animação que continua editável | **dotLottie** | Formas, caminhos e chaves de transformação externas da linha do tempo do Lolly Design |
| Uma entrega para o Premiere | **Premiere XML + media** | Clipes temporizados e mídia original para o Premiere (Lolly Design) |
| Vídeo para redes sociais e compartilhamento | **MP4** ou **WebM** | Melhor qualidade para o tamanho do arquivo (veja [Vídeo](#video)) |
| Legendas | **SRT** ou **VTT** | Texto temporizado para um reprodutor de vídeo (Captions, Audiogram e Record) |
| Legendas para transmissão | **TTML** ou **SCC** | Texto temporizado IMSC1.1 ou legendas pop-on CEA-608 (Captions; veja [Legendas para transmissão](#broadcast-captions)) |
| Um curso de treinamento | **SCORM (LMS)** | Um site ou pacote SCORM ou xAPI com versões (veja [SCORM](#scorm-course-packages)) |
| Texto formatado ou uma assinatura de e-mail | **HTML** | Cola com formatação em clientes de e-mail |
| Uma animação que roda em um navegador | **HTML** | Um reprodutor em um só arquivo, da linha do tempo do Lolly Design ou do Snippet (veja [Vídeo](#video)) |
| Conteúdo simples | **MD** ou **TXT** | Apenas texto |
| Um evento de calendário | **ICS** | Importa em qualquer app de calendário |
| Um cartão de contato | **VCF** | Importa em agendas de contatos |
| Dados estruturados para reimportar | **JSON** ou **CSV** | Permite exportar e reimportar o conteúdo da ferramenta |
| Um favicon | **ICO** | Ícone de site em vários tamanhos; **ZIP** reúne vários formatos |
:::

### Transparência

As ferramentas que oferecem suporte têm um alternador de fundo transparente, como **No BG**. PNG, WebP, AVIF, SVG, APNG e Animated WebP mantêm a transparência, e GIF mantém bordas sem suavização. JPG e PDF são sempre opacos. TIFF achata sobre branco ou sobre preto no caminho [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Tamanho e unidades de impressão

As exportações usam o tamanho nativo da ferramenta em pixels, a menos que ela ofereça **dimensões**. Nesse caso, você define largura, altura e uma **unidade**:

- **px** (o padrão) são pixels exatos.
- **mm, cm, in, pt** e **pc** são tamanhos físicos. Com uma unidade física, você também define o **DPI** (300 por padrão). Um **PDF** se torna uma página real nesse tamanho. Um **raster** recebe a quantidade de pixels para esse DPI e registra a resolução. Um **SVG** mantém a unidade física com um viewBox em pixels.

Para um raster de maior resolução, digite uma largura e uma altura maiores ou escolha uma unidade física e aumente o DPI (pixels = tamanho × DPI). Largura `210`, altura `297` e unidade `mm` criam uma página A4.

![A linha de dimensões definida como 210 por 297 mm, com o campo DPI visível porque a unidade é física](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Imagens estáticas de uma composição temporizada

Em uma composição temporizada, como uma linha do tempo [Sequence](/info/sequence-editor.html) no Lolly Design, uma exportação estática captura **o quadro na posição do cursor de reprodução**. Posicione o cursor de reprodução onde você quer a imagem e exporte.

Para mais de um momento, use o campo **Frames** ao lado do tamanho da saída. Ele aparece apenas para uma composição temporizada e um formato estático (PNG, JPG, WebP, SVG ou PDF). `1` fornece o quadro na posição do cursor de reprodução. Um número maior fornece essa quantidade de imagens estáticas, distribuídas uniformemente pela sequência:

- PNG, JPG, WebP e SVG são entregues em um único ZIP: `<name>-01.png`, `-02.png` e assim por diante.
- PDF é entregue como um único documento com essa quantidade de páginas.

Cada imagem estática vem do meio do seu trecho da linha do tempo, então a primeira nunca é uma entrada parcialmente esmaecida e a última nunca é o momento vazio depois que os clipes terminam.

::: figure exporting-contact-sheet
Frames: 4 divide a sequência em quatro trechos iguais e captura o meio de cada um.
:::

Use Frames para um storyboard, uma folha de contato para revisão ou um carrossel para redes sociais extraído de uma edição de vídeo. O limite é 64. Qualquer outro valor digitado no campo retorna a `1`. Cada quadro é uma imagem estática comum, então as credenciais, o Imprint, as unidades físicas e o DPI funcionam como em uma exportação única. Um link de exportação, a CLI e o MCP solicitam a mesma folha com `cuts=` (veja [Folhas de contato](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Muitos arquivos de uma vez

O Lolly tem três formas de trabalhar em volume:

::: cols
## Uma tabela vira um documento
Uma ferramenta criada para paginar uma tabela de entrada transforma cada linha em uma página. Cole uma tabela da sua planilha para obter um único PDF. Para corrigir linhas, edite a planilha e cole novamente. Battlecards é a ferramenta de referência. Ela fica na pasta de código aberto `community` e não está listada em lolly.tools.
## Um CSV vira um arquivo por linha
**Batch** (`#/batch`) recebe um CSV e renderiza uma exportação para cada linha, como crachás ou certificados, entregue em um ZIP. Veja [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Vários designs recebem uma edição
**Lolly Multi-edit** abre várias sessões salvas lado a lado para fazer a mesma alteração em cada uma. Veja [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Uma ferramenta com várias páginas, como Booklet, Print Sheet, Lolly Doc Studio ou Lolly Markdown Slides, exporta PNG, JPG, WebP, SVG e os outros formatos de imagem única como um arquivo por página, em um ZIP quando há várias. Print Sheet mantém a folha inteira e as marcas de corte no DPI escolhido.

Em **Projects**, **Render folder** exporta cada sessão salva em uma pasta e suas subpastas como um único ZIP com a mesma estrutura. **Render selection** faz o mesmo para uma seleção múltipla. Uma sessão salva é renderizada em seu próprio arquivo. Projects também pode compartilhar novamente uma sessão salva como um link de ferramenta que reabre a sessão com as mesmas configurações.

<!--i:eti-pen-->
## Arquivos que continuam editáveis em outros apps

Alguns formatos entregam seu trabalho a outro aplicativo como conteúdo editável em vez de uma imagem.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart e Agenda exportam um deck de PowerPoint, com um slide por página. Cada página é dividida em objetos nativos que um colega pode editar e extrair:

- <!--i:font--> **Texto** vira caixas de texto editáveis do PowerPoint com o tamanho de fonte, a cor, o peso, o itálico e o alinhamento do layout. Um deck do Lolly Design define a fonte da marca em cada trecho de texto, mesmo sem um slide mestre.
- <!--i:pentool--> **Vetores**, como logotipos e ícones, são incorporados como imagens SVG, e o PowerPoint pode aplicar *Convert to Shape* a eles.
- <!--i:photos--> **Imagens** são transferidas como imagens separadas na resolução nativa. Uma imagem de destaque cortada mantém a imagem inteira por trás do corte. Qualquer filtro ou mesclagem em uma imagem é incorporado a ela.
- <!--i:layers--> **Fundos, bordas e linhas divisórias** viram formas de retângulos e linhas. Círculos, elipses e pílulas do Lolly Design continuam como formas nativas editáveis.

![O painel de exportação com PowerPoint escolhido: um slide por página, com texto e formas mantidos editáveis](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

O layout é aproximado. Tudo o que o walker não consegue expressar de forma nativa, como uma região complexa com filtro ou máscara, é incorporado como imagem. Um deck tem um único tamanho de slide, obtido da primeira página.

O PowerPoint também é uma forma de entrada: [Adapte um deck à sua marca](/info/rebrand.html) transfere um deck para o seu sistema de design, e [Importe um design](/info/design-import.html) abre um no Lolly Design.

### Penpot

A maioria das ferramentas que exportam SVG também exporta um **arquivo Penpot** (`.penpot`).

| O que você criou | No Penpot |
|---|---|
| Texto | Objetos de texto editáveis |
| Formas, caminhos, gradientes e imagens | Formas vetoriais editáveis |
| Uma cor ou fonte de um token do sistema de design | Um vínculo ativo com o token: edite o token e toda forma que o herda acompanha a mudança |
| O design inteiro | Um componente reutilizável no painel Assets |
| Uma ilustração complexa ou um canvas ao vivo | Uma imagem incorporada; o conteúdo ao redor continua editável |

No Lolly Design, cada quadro se torna uma prancheta do Penpot. As cores e tipografias do sistema de design vão para o painel Assets e seu conjunto completo de tokens vai para o painel Tokens. O Penpot mantém sua própria cópia. Um token editado no Penpot volta pela importação no [Lolly Design System Setup](/info/brand-studio.html).

![O painel de exportação com Penpot escolhido: o arquivo .penpot e Send to Penpot ao lado do download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para abrir o arquivo, inicie o Penpot, escolha um projeto e selecione **Import**. Se você entrar no Penpot pelo painel de exportação, **Send to Penpot** importa o arquivo para você.

### Word, OpenDocument e InDesign

**Lolly Doc Studio** exporta **Word** (DOCX) e **OpenDocument** (ODT) com parágrafos e títulos editáveis. O arquivo Word define as fontes e a cor de texto da marca pelos estilos do documento, segue o tamanho de página que você escolhe e adiciona um PNG ao lado de um logotipo SVG para apps que não conseguem desenhar SVG.

**Lolly Design** exporta **InDesign IDML (static subset)**: texto, retângulos, ovais e imagens PNG ou JPEG, uma página dupla por prancheta. A formatação em linha compatível continua editável, as imagens vão em `Links` e as coordenadas se tornam pontos do InDesign. Revinculação, substituição de fontes e mudanças nas quebras de linha podem precisar de atenção. Efeitos, animação, fluxos de texto compostos e geometria sem suporte interrompem a exportação com um relatório que os lista. IDML não preserva o documento original. Envie PDF para arte finalizada.

### Linhas do tempo: dotLottie e Premiere

A partir da linha do tempo do Lolly Design, **dotLottie** grava uma animação que continua editável em ferramentas Lottie; [Animações Lottie](/info/sequence-editor.html#lottie-animations) lista o que ela mantém. **Premiere XML + media** empacota clipes temporizados e sua mídia original para o Premiere; veja [Intercâmbio XML com o Premiere](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pacotes de cursos)

A exportação de cursos fica desativada até você ativar **Training and courses** em Settings → Preferences → Feature flags.

Depois escolha **Export course** em uma ferramenta compatível, uma pasta de projeto ou uma seleção. No Lolly Design, escolher **SCORM (LMS)** e **Download** abre o mesmo fluxo de curso. O Lolly salva o trabalho, mostra o conteúdo e a ordem do curso para revisão, depois abre o módulo e sua caixa de exportação.

- <!--i:layers--> Escolha uma representação para cada fonte: páginas estáticas, movimento como vídeo, áudio ou um recurso para download. Adicione texto de aula e alternativas de leitura no módulo.
- <!--i:clock--> Veja a prévia do reprodutor do aluno e revise descrições e legendas. O movimento, inclusive animação sem som, é incluído como vídeo.
- <!--i:document--> Escolha Website, SCORM 1.2, SCORM 2004 4th Edition ou um destino xAPI experimental. Confira o conteúdo e o tamanho do ZIP, depois salve e baixe a versão verificada.
- <!--i:check--> A conclusão exige confirmar cada aula obrigatória e escolher Finish.

![O painel de exportação em um deck do Lolly Design com SCORM (LMS) escolhido](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

O pacote contém seu conteúdo finalizado e não precisa de uma conta Lolly. Coloque um ZIP de Website em um host HTTP(S); importe um ZIP de LMS sem alterações. Teste o destino antes de compartilhar o curso. Para um curso feito a partir de várias criações salvas, veja [Crie um curso de treinamento](/info/training-creators.html).

### Legendas para transmissão

A ferramenta Captions também pode exportar **TTML** e **SCC**. Ambos são gravados a partir da mesma lista de legendas que os arquivos SRT e VTT, então as palavras e os tempos correspondem.

- **TTML** é o IMSC1.1 Text Profile, com tempos de relógio relativos à mídia e uma região central inferior. Ele não inclui cor, fonte ou posição por legenda, porque as legendas do Lolly contêm apenas início, fim e texto.
- **SCC** inclui legendas pop-on CEA-608 no canal 1 a 29,97 quadros por segundo com timecode drop-frame. Ele aceita os caracteres norte-americanos básicos, além dos especiais e estendidos. Se uma legenda tiver um caractere que não pertence ao conjunto, a exportação para e informa qual caractere. Cada legenda quebra em 32 colunas e no máximo 15 linhas. Uma legenda que não consegue carregar antes do seu início é atrasada em alguns quadros.
- Legendas roll-up e paint-on não são gravadas.

::: note SCC não foi verificado em uma ferramenta de transmissão
Também não foi testado em um decodificador de hardware. Teste um arquivo no seu próprio fluxo antes da entrega.
:::

### DXF (arquivos de corte)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding e Wordmark exportam **DXF**, o formato de intercâmbio AutoCAD R12 que cortadoras a laser, plotters de vinil e softwares CNC leem. A geometria é gravada como caminhos de contorno em milímetros e o texto é convertido em contornos. A cor é mapeada para o AutoCAD Color Index mais próximo, que geralmente determina a operação da cortadora. DXF contém apenas arte em linhas: uma região fotográfica ou com filtro não tem caminho de corte e é descartada com um aviso. Use SVG ou PDF para manter conteúdo raster. Texto que nenhuma fonte cobre, nem mesmo uma [fonte de reserva](/info/fallback-fonts.html), interrompe a exportação com uma mensagem que cita o texto.

Um design do Street Map é feito só de traços, então cada rua e canal vira um caminho de corte.

::: showcase
![Uma renderização de Paris no Street Map em tinta sobre creme - arte feita só de linhas, então cada traço se mantém ao chegar a uma cortadora](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Role, e a câmera se afasta através da geometria: sete caminhos e nenhum pixel. Uma cortadora lê o mesmo arquivo.
:::

<!--i:eti-stamp-->
## Impressão

**Print PDF** grava CMYK para uma condição de impressão nomeada, **Coated FOGRA39** por padrão. Amostras de cor da marca com valores de tinta medidos mantêm esses valores. Outras cores são convertidas por um perfil de impressão: o perfil Coated FOGRA39 do próprio Lolly por padrão, ou o seu próprio perfil quando você escolhe a linha **Embed** dele. Cinzas e preto ficam apenas na chapa preta, então letras pequenas não podem ficar fora de registro. FOGRA51, SWOP e GRACoL usam uma conversão padrão de dispositivo. O texto preto também é sobreimpresso na cor abaixo dele, então uma impressora um pouco desalinhada não deixa bordas brancas ao redor das letras. **Print TIFF** grava pixels DeviceCMYK para um RIP. O controle Colour profile determina ambos ([Perfis de cor](#colour-profiles)). Print TIFF e **EPS (CMYK)** separam as cores pelo mesmo perfil de impressão que Print PDF.

**Print marks & bleed** tem seu próprio cartão nos formatos de impressão: a sangria em milímetros mais Crop, Registration, Bleed, Colour bars e Stamp details. Stamp details imprime a data, a ferramenta e seu nome na margem. Um nome ou nome de ferramenta em caracteres que a fonte da margem não tem, como árabe, chinês, cirílico ou um emoji, é desenhado como imagem no mesmo cinza. O cartão de exportação lista essas escritas.

Algumas ferramentas, como *Booklet*, criam um **PDF de várias páginas**: uma capa, conteúdo que flui por quantas páginas forem necessárias e uma contracapa. Cada página é uma página PDF real em orientação retrato, em A4, US Letter ou A5. Você pode forçar qualquer bloco a começar em uma nova página. São documentos RGB sem marcas de corte ou sangria; essas marcas pertencem ao Print PDF de página única. Um PDF do Lolly Design também pode ser um **Notes handout**: uma página em retrato para cada slide, com suas notas do apresentador abaixo.

**Antes de exportar.** Um cartão **Before you export** no rodapé do painel mostra o que uma gráfica verá: formato, tamanho e sangria, áreas de corte e sangria, cobertura de tinta, quantidade de chapas e número de páginas, com um parecer ao lado do título. O cartão nunca bloqueia uma exportação. O Lolly Design sempre mostra o cartão com suas próprias verificações, incluindo as regras do sistema de design camada por camada e o indicador de escrita do texto do documento ([Antes de exportar](/info/design.html#before-you-export)). O Lolly Design adiciona essas verificações de impressão quando **Print preflight** está ativado. Em outras ferramentas, ative **Print preflight** em Settings → Preferences → Feature flags. Ele fica desativado por padrão, e uma implantação do Lolly Work pode ativá-lo para seus membros.

**Depois de exportar.** O Lolly lê o arquivo finalizado e o compara com o que você escolheu: formato, tamanho em pixels ou de página, duração do clipe, fundo transparente, cor CMYK, HDR, Content Credentials e senha de PDF ou ZIP. Qualquer diferença é registrada no cartão de exportação. Cada medição vem do arquivo, nunca da configuração. Uma propriedade que o arquivo não consegue informar não é contada como correspondência. A linha de comando grava a comparação completa com `--export-report` (veja [Renderize com a CLI](/info/cli-rendering.html)).

::: details Verificações de acessibilidade de PDF pela linha de comando
**Verificações de acessibilidade de PDF.** Para um PDF, a linha de comando também lista 32 verificações de acessibilidade no arquivo `--export-report`, em `pdfAccessibility`. Cada verificação tem um id, uma descrição simples, um resultado e o local do arquivo onde encontrou um problema:

- **Passed**: a verificação analisou algo e não encontrou nada errado.
- **Failed**: a verificação encontrou um problema. Os números das páginas ou as tags são listados.
- **Not applicable**: o arquivo não tinha nada desse tipo para analisar, como verificações de tabelas em um arquivo sem tabelas. Isso não diz nada sobre o arquivo.
- **Needs a person**: seis verificações não podem ser avaliadas por um programa (ordem de leitura, contraste de cores, flashes, scripts, limites de tempo e links repetidos).

A lista não é um parecer. Ela não diz que um PDF atende ao PDF/UA ou que pessoas que usam tecnologia assistiva conseguem usar o PDF. Uma pessoa ainda precisa conferir o arquivo com um leitor de tela. Os próprios PDFs do Lolly falham nas verificações de tags hoje, porque os exportadores ainda não gravam tags. A verificação lê o arquivo no seu dispositivo e não altera nada. Arquivos que precisam de senha são identificados como não verificados, não como aprovados. Para conferir um PDF que você recebeu, solte-o no [Lolly Strip Hidden Data](/info/utilities.html), que mostra a mesma lista em **PDF accessibility checks**.
:::

As verificações do Inspector do Lolly Design e a comparação de marca no Lolly Design System Setup analisam o design. Esses dois cartões analisam o arquivo.

::: details Custo a partir de uma tabela de preços
Abaixo da verificação de impressão, um cartão de custo transforma as mesmas contagens em dinheiro, mesmo quando o cartão de verificação está desativado. Ele precisa de duas coisas: um trabalho ao qual uma lista de preços possa atribuir um valor (chapas, folhas, área, páginas, linhas de variantes ou arquivos de saída, então um simples PNG de logotipo nunca mostra o cartão) e uma **tabela de preços**, uma lista de preços em JSON da sua gráfica. Uma compilação padrão não inclui tabela de preços nem tem uma forma de carregar uma pelo app. Uma tabela de preços chega como um recurso de catálogo incluído em uma implantação ou pela extensão opcional de tabela de preços que o responsável pela hospedagem própria ou o plano de controle ativa. Sem tabela de preços, nada é mostrado.

Cada valor é um preço que você forneceu multiplicado por uma quantidade que o Lolly contou, como `4 plate × €35.00`. O total mostra sua fonte: o emissor da tabela e a data dos preços. Não há moeda padrão nem preço provisório. O que o arquivo diz sobre si mesmo continua sendo uma declaração do arquivo: *"O arquivo diz: … O Lolly não verificou isso."*

Quando um valor não pode ser calculado, a tabela é retirada em vez de preenchida:

- Linhas sem preço na tabela significam **nenhum total**, apenas um título dizendo quantas estão sem preço.
- Uma quantidade que é um limite máximo leva **"até"** para seu subtotal.
- Preços cuja validade expirou mostram **apenas contagens** até você pressionar *Use these rates anyway*; a data de expiração passa a acompanhar o valor.
- Quando aberto por um **link**, os valores monetários ficam ocultos até você solicitá-los neste dispositivo. A CLI recebe `--rate-card=<file.json>` como um arquivo local e nunca como um parâmetro de link.

A tabela é removida de todas as etapas de exportação e nunca altera o arquivo. É um cálculo, não um orçamento. Só sua gráfica pode fazer um orçamento.
:::

<!--i:eti-film-->
## Movimento e som

### Vídeo

Ferramentas animadas exportam **MP4** e **WebM**. Um link compartilhado com `?format=` que pede um contêiner que este navegador não consegue gerar usa o outro, com um nome de arquivo correspondente. **Start after** mantém o canvas parado para que animações e fontes se estabilizem antes da gravação. **Duration** define a duração do clipe finalizado. **Motion blur** (Off, Draft quality, Standard ou High, com um **Shutter angle**) desfoca movimentos rápidos e torna a renderização mais lenta. Quando o navegador oferece suporte, **Record live** grava a prévia na tela em tempo real por um compartilhamento de tela.

![As configurações de tempo para uma exportação animada: Start after, Duration, Motion blur com seu Shutter angle e Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** permite escolher Smaller file, Balanced ou Best quality. **Advanced** abre **Codec**, **Frame rate**, **Rate mode** e **Hardware acceleration**. Quando uma ferramenta tem legendas, **Captions** permite escolher uma **Embedded track** ou um **Sidecar .vtt + .srt** ao lado do vídeo. Um link inclui qualidade, codec, taxa de quadros, duração e atraso inicial como `vq`, `codec`, `fps`, `seconds` e `wait` ([Parâmetros de URL](/info/url-parameters.html)).

As exportações de vídeo mantêm seu som. Uma ferramenta pode colocar uma **trilha de fundo** sob o clipe: um recurso de áudio repetido em loop ou cortado na duração do clipe, com fades, volume e redução automática sob o som da própria filmagem. As ferramentas de gravação levam seu áudio ao vivo para o arquivo.

Um deck do Lolly Design que avança por cliques também pode ser exportado como vídeo. **Export slides as video** no menu Present abre o painel de exportação em MP4. Cada slide roda pelo seu próprio tempo de permanência ou pela Duration do painel de exportação quando não tem um. A transição do deck é reproduzida entre os slides como uma dissolução. O documento não muda.

**HTML** de um documento temporizado do Lolly Design ou do Snippet é um reprodutor em um só arquivo: controles de reprodução, navegação e som sobre a animação, com suas fontes compatíveis, imagens e som incorporados. O arquivo roda offline. Um filme do Lolly Design com cenas adiciona um menu dessas cenas. Uma sequência que contém um clipe de vídeo, Lottie ou 3D ainda não pode ser exportada como HTML; exporte a sequência como vídeo.

### Imagens animadas

**GIF** roda em qualquer lugar e serve para chat e e-mail; ele é maior e tem menos cores que vídeo. **APNG** e **Animated WebP** mantêm cor total e transparência. **Lottie Ad** também exporta **Animated SVG**: quadros vetoriais com quadros-chave CSS incorporados que escalam para qualquer tamanho e repetem em loop em uma aba do navegador ou em um `<img>`, sem codec. Seu texto é convertido em contornos. Ele usa uma taxa de quadros padrão mais baixa porque cada quadro é mais pesado que um bitmap. Todos esses formatos são sem som.

### Áudio

Algumas ferramentas exportam apenas som. **Lolly Voice Recorder** captura uma tomada de microfone com um medidor de nível ao vivo e a salva como **MP3**, **WAV**, **M4A (AAC)** ou **Opus (WebM)**, codificada no seu dispositivo. `wav`, `mp3`, `m4a` e `opus` são ids de formato comuns, então uma exportação de áudio pode ser compartilhada e automatizada por scripts como um PNG.

O seletor de recursos aceita muitos formatos de áudio para uma trilha de fundo, de MP3 e FLAC a MIDI e módulos de tracker; [Formatos](/info/formats.html) lista todos eles. Uma [música do Lolly Rondocode](/info/rondocode.html) toca pela duração que seu clipe pede.

<!--i:eti-palette-->
## Cor e HDR

O Lolly lê todas as cores CSS modernas, faz seus cálculos de cor de forma perceptual e grava cada arquivo em um espaço que um leitor consegue abrir: sRGB para telas, CMYK para impressão e Rec.2100 PQ para HDR ([Cor no motor](/info/colour-engine.html)). Um documento do Lolly Design definido como **Wide colour / HDR** segue suas próprias regras: veja [Edição com ampla gama de cores e HDR](/info/hdr-editing.html).

### Perfis de cor

As exportações são marcadas com um perfil de cor, para que apps com gerenciamento de cor, como os de gráficas, o Photoshop e os navegadores, leiam as cores como você as viu. Miniaturas e prévias dispensam essa marcação para ficarem pequenas.

- **PNG e JPG** incluem um perfil ICC **sRGB** incorporado, o espaço em que a prévia é desenhada. Os pixels são marcados, não recodificados.
- **Print PDF (CMYK)** declara sua condição de impressão no *OutputIntent*, informando à gráfica como suas tintas CMYK devem ser interpretadas.
- **Print TIFF (CMYK)** grava pixels DeviceCMYK sem marcação e registra a condição de impressão nos metadados TIFF. Um TIFF não pode incorporar um perfil de impressão, então uma linha **Embed** registra apenas o nome desse perfil.
- **TIFF (RGB)** é a versão sRGB sem compressão para arquivamento ou para editar e trazer de volta. Ambos os TIFFs são exclusivos do desktop, porque navegadores não conseguem mostrar a prévia de um TIFF.
- **SVG**, **EMF**, **EPS** e **DXF** são vetores sem perfil incorporado: as cores do SVG são sRGB, EMF e EPS usam RGB de dispositivo, **EPS (CMYK)** grava DeviceCMYK e DXF usa o AutoCAD Color Index. SVG, EPS e DXF convertem o texto em caminhos de contorno. EMF mantém o texto ativo e editável no Office e no Google Slides e só converte em contornos os trechos que o formato não consegue expressar. A opção **Outline fonts** do painel de exportação força caminhos em todo o texto, assim como `_text=outline` em um link e `--text=outline` na linha de comando. SVG também reproduz sombras de caixa CSS, internas e externas.

::: details PDF/X-4 e seu próprio perfil de impressão
O Lolly inclui um perfil CMYK, ajustado aos dados de caracterização FOGRA39 da Fogra e publicado sob CC0, e converte as cores por ele para a condição de impressão padrão. O perfil não é incorporado porque é ICC versão 4.3 e PDF/X-4 aceita versões até 4.2. Uma condição de impressão nomeada, portanto, grava a intenção de saída sem declarar conformidade com PDF/X-4.

Carregue seu próprio perfil CMYK e escolha a linha **Embed** dele no controle Colour profile. Ele é incorporado como *DestOutputProfile* do arquivo, e o PDF declara PDF/X-4 sempre que o restante do arquivo permite. A condição de impressão declarada é lida desse perfil: um nome registrado quando o perfil comprova um, ou `Custom` sob o nome do próprio perfil.

Três coisas impedem essa declaração, mas mantêm a intenção de saída: arte RGB que a etapa CMYK não conseguiu converter, o texto de crédito `prov` na margem de prova (desenhado em uma fonte padrão que não é incorporada) e uma senha **Strong**, já que PDF/X-4 proíbe criptografia. Todo PDF também inclui metadados PDF/X-4: caixas de página, XMP, um ID de documento e uma intenção de saída sRGB com seu perfil.
:::

### Tintas especiais em quadricromia

Um sistema de design pode atribuir a uma cor uma tinta especial, como uma cor Pantone ou HLC. O **Print PDF** então imprime essa cor em uma chapa própria. O Lolly Demo atribui uma tinta especial a cada cor, exceto aos seus brancos, Sugar e Daylight, e ao seu preto, Void. Um Print PDF feito no Lolly Demo imprime a maioria das cores em chapas de tintas especiais e o preto na chapa de preto.

Para um arquivo simples em quatro cores, marque **Print spot inks as process** no cartão Profile do painel de exportação. Cada tinta especial passa a ser impressa com ciano, magenta, amarelo e preto, usando a composição CMYK que o sistema de design fornece para essa cor. Uma cor sem composição própria usa a conversão do perfil de impressão, como qualquer outra cor da arte. O arquivo passa a ter apenas as quatro chapas de quadricromia. A opção vem desativada por padrão. O painel mostra a caixa apenas para **Print PDF** e somente quando o sistema de design atribui uma tinta especial a uma cor.

Um acabamento não é uma tinta. Hot stamping, alto-relevo, baixo-relevo, verniz localizado, toque suave, corte com faca, vinco e perfuração mantêm suas próprias chapas nomeadas com a caixa marcada, porque um acabamento impresso em quadricromia colocaria sua máscara preta na página.

O cartão **Before you export** e `lolly preflight` contam as chapas que o arquivo terá. Com a caixa marcada, contam as quatro chapas de quadricromia e as chapas de acabamento e informam que as tintas especiais são impressas em quadricromia e não acrescentam chapas. Com a caixa desmarcada, contam até uma chapa de tinta especial para cada tinta especial fornecida pelo sistema de design. Uma tabela de preços calcula o valor dessas contagens, então nunca cobra por uma chapa de tinta especial que o arquivo não terá.

O **Print TIFF** e o **EPS (CMYK)** não têm chapas nomeadas, então imprimem todas as tintas em quadricromia, com ou sem a opção. Para esses dois formatos, o cartão e `lolly preflight` contam as quatro chapas de quadricromia e nunca uma chapa de tinta especial ou de acabamento. Um acabamento entra neles como sua máscara preta na chapa de preto, e o cartão informa isso como um erro.

Um link solicita o mesmo arquivo com `_spots=process`, a linha de comando com `--spots=process`, o [servidor MCP](/info/mcp.html) com `spots: "process"` e o app de terminal com sua linha **Spot inks**. Nenhuma informação sobre a escolha entra no arquivo: só as tintas mudam.

### HDR (cores brilhantes)

O cartão **HDR** do painel de exportação aumenta o brilho de artes comuns para telas HDR. Para manter originais HDR durante a edição, veja [Edição com ampla gama de cores e HDR](/info/hdr-editing.html).

Uma exportação comum é sRGB: uma cor saturada da marca tem o mesmo brilho que o branco normal da tela. Uma tela HDR pode brilhar mais. O cartão **HDR** aumenta o brilho das cores da sua marca e do texto branco em direção ao brilho máximo. As áreas escuras continuam escuras.

![O cartão HDR no painel de exportação, ativado, com os controles White / Reach / Dark lift / Focus exibidos abaixo dele](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formatos.** PNG, JPG, AVIF e TIFF. WebP é de 8 bits, sem um caminho funcional de decodificação HDR, e vetores e PDF não têm modelo HDR.
- **Desativado por padrão**, porque muda os pixels. Marque o cartão ou passe `hdr=1` em um link de compartilhamento.
- **Os controles.** **White** (o limite de brilho máximo, de 400 a 2000 nits), **Reach** (até onde o brilho se espalha pelos tons mais baixos), **Dark lift** (quanto os tons escuros clareiam; `0` os mantém escuros) e **Focus** (quanto da riqueza de cores o aumento preserva). Eles viajam como um único valor: `hdr=1600-60-0-50` é White 1600, Reach 60, Dark lift 0 e Focus 50.
- **O que é gravado.** PNG recebe Rec.2100 PQ de 16 bits com um bloco `cICP`. JPG é um JPEG com mapa de ganho ISO 21496-1: uma imagem SDR comum com um mapa de ganho anexado. AVIF recebe uma caixa `colr` reescrita. TIFF recebe pixels PQ com um perfil ICC v4 gerado que contém uma tag `cicp`. TIFF achata a imagem sobre preto, porque branco é o código de 10.000 nits em PQ e colocaria um halo ao redor de cada borda. O aumento segue a luminosidade perceptual (OKLab) e mantém o matiz, então o verde de uma marca fica mais brilhante, sem ficar verde-menta.
- **Onde o brilho aparece.** Visualizadores com gerenciamento de cores em uma tela HDR: Preview, Quick Look e Safari em dispositivos Apple, ou Chrome em um monitor HDR. Uma tela SDR mostra uma imagem normal.
- **Pelo terminal.** `--hdr=1` com `--export=png` ou `--export=jpg` grava o mesmo PNG e JPEG com mapa de ganho na [CLI](/info/cli.html) com os mesmos codificadores do mecanismo, sem navegador. Por enquanto, AVIF e TIFF só podem ser exportados pela web.

::: warning Muitas plataformas removem o sinal HDR
Uma plataforma que recodifica uploads pode deixar a imagem escura ou desbotada. Use HDR onde você controla o destino, como seu próprio site, um painel de vídeo ou um deck em uma tela de alto brilho.
:::

<!--i:eti-badge-check-->
## O que acompanha seu arquivo

Um arquivo finalizado pode ter vários registros. Alguns ficam junto aos pixels e desaparecem quando o arquivo é salvo de novo, capturado em tela ou tem seus metadados removidos. Duas marcas ficam nos pixels.

::: figure exporting-what-travels
Onde cada registro fica, se vem ativado por padrão e qual parâmetro de link controla cada um.
:::

O painel de exportação reúne **Licence**, **Source credits**, **Password**, **C2PA Credentials**, o **Lolly Imprint** e a **Durable credential** em um grupo **Content protection** que mostra apenas os cartões que o formato escolhido pode usar. O grupo se abre sozinho quando um link ou documento já declara uma licença, ou quando uma fonte precisa da sua decisão. O cartão **Design system** fica fora do grupo, visível em toda exportação.

![O grupo Content protection aberto em uma exportação PNG, mostrando apenas os cartões que se aplicam a ela](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Procedência & marca d'água

Quando o formato tem os campos, as exportações carregam **metadados de procedência**: o software, a fonte, o nome da ferramenta e a linha de crédito do seu perfil, gravados em PNG iTXt, JPEG EXIF, informações do PDF, `<metadata>` do SVG ou um comentário GIF. Eles registram apenas a autoria. Nada é enviado. Ferramentas **Experimental** também aplicam uma marca d'água visível. O host aplica a marca d'água, então editar a ferramenta não pode remover a marca.

**O Lolly Imprint** é uma marca d'água invisível nos pixels, **ativada por padrão**. Ela resiste à recompressão, então uma cópia ainda pode ser reconhecida como feita no Lolly. É um indício, não uma garantia criptográfica, e não contém dados pessoais. Ela é gravada em JPEG XL, PNG, JPG, WebP, AVIF, TIFF e BMP e nas imagens raster que o Lolly renderiza em um PDF ou PPTX, nunca em uma imagem que você incorporou. Desmarque **Lolly Imprint** ou passe `imprint=0` para deixar o Imprint de fora. A resistência do AVIF à recodificação ainda não foi calibrada. O [Lolly Verify](/#/verify) detecta o Imprint no seu dispositivo; veja [O Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**A Durable credential** grava o id do Lolly nos pixels com um modelo neural no dispositivo no formato TrustMark, para que o vínculo "feito com Lolly" resista à remoção de metadados e à recodificação e possa ser lido por ferramentas compatíveis com TrustMark. Ela vem **desativada por padrão**, porque exige uma passagem pelo modelo neural por exportação e um único download do modelo. Ela cobre PNG, JPG, WebP, AVIF e TIFF. Marque-a no painel ou passe `durable=1`. Os apps para desktop e celular ocultam o cartão, porque não têm uma origem de onde buscar o modelo offline.

**Licence.** Escolha como outras pessoas podem usar seu trabalho: *None (all rights reserved)* por padrão, CC0 1.0, Public Domain Mark 1.0 ou uma licença Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). O nome da licença e um link para seu resumo entram nos metadados de licença do arquivo (EXIF, XMP e RIFF quando o formato os tem) e em sua Content Credential. A escolha é salva com o documento e viaja em um link como `licence=`. O Lolly grava a licença que você escolheu. O Lolly não verifica nem impõe os termos. Uma ferramenta com seu próprio campo de licença, como Claim, mantém esse campo.

### O registro do sistema de design

Uma exportação registra o sistema de design que criou o arquivo: seu nome, a versão publicada da qual ele foi desenhado (quando não é a versão de trabalho) e a [variação de cores](/info/colourways.html) em que foi desenhado. Qualquer outra escolha de tema que um sistema de design declare, como uma densidade, é registrada da mesma forma. A escolha entre claro e escuro fica de fora, porque a imagem já mostra qual foi usada.

**Você vê o registro antes que qualquer coisa seja gravada.** O cartão **Design system**, marcado por padrão, mostra as palavras exatas que o arquivo carregará, como *Registros: Acme · Variação de cores: Beach*, e a descrição. O nome de um sistema de design é o que seus proprietários digitaram, e o cartão mostra o nome como foi escrito. Desmarque o cartão para deixar o registro fora dessa exportação. O painel de documento do Lolly Design lista as mesmas palavras em *Embedded in exports*.

**A descrição informa a variação de cores ao lado da ferramenta.** Com o cartão marcado, *"Feito com https://lolly.tools : Chart"* vira *"Feito com https://lolly.tools : Chart (variação de cores Beach)"*. O nome do próprio sistema de design fica no registro, não na descrição. Uma descrição sem nome de ferramenta, ou uma que a ferramenta escreve a partir de suas próprias entradas, não muda. Uma ferramenta que ignora variações de cores por meio de `tokenAxes` não registra nenhuma, e o crédito da prova em PDF (a marca de impressão `prov`) segue a mesma regra.

::: details Skills de marca, páginas de marca e empresas parceiras no registro
**Skills de marca que orientaram um agente.** Quando um agente criou a peça e nomeou as [skills de marca](/info/brand-skills.html) que leu e seguiu, o registro também lista cada skill com sua revisão, como *Orientado por: acme-brand 1.0*. As palavras significam que a skill orientou o trabalho. O Lolly não testa a peça em relação a uma skill. Só a declaração do próprio agente acrescenta a lista. Hoje isso é o argumento `brandSkills` de `lolly_render` do [servidor MCP](/info/mcp.html), então uma peça feita no app ou a partir de um link de compartilhamento não carrega nenhuma. A Content Credential contém a lista como `brandSkills`, um valor JSON com o id, o nome, a revisão e o hash SHA-256 de cada skill. O pacote XMP e os metadados SVG contêm o mesmo valor como `lolly:BrandSkills`. Um PDF gravado a partir do registro ganha uma palavra-chave por skill. A descrição não muda. O texto de uma skill interna nunca é registrado. Os mesmos controles deixam a lista de fora junto com o restante do registro: o cartão **Design system**, `_madewith=0`, `--no-madewith` e `madeWith: false`. Quando o servidor MCP desenha o arquivo em um navegador (um PDF, um JPEG e os outros formatos que seu caminho sem navegador não consegue gravar), os metadados do próprio arquivo não contêm lista. Só uma Content Credential pode conter a lista nesse caso. Passe `c2pa` para manter o registro. Sem uma credencial, a renderização avisa que as skills de marca não foram registradas.

**A página de marca, quando seu publicador opta por incluí-la.** O publicador de um sistema de design pode escolher registrar o endereço de sua [página de marca](/info/brand-page.html#lead-back-from-your-files) nas exportações. A configuração é por sistema de design e vem desativada por padrão. O cartão então acrescenta o endereço à mesma linha, como *Registros: Acme · Variação de cores: Beach · Página de marca: https://acme.example/brand/acme/*. Desmarcar o cartão remove o endereço junto com o restante. O registro contém o endereço e nada mais sobre a página. Nada mais no arquivo muda. Um sistema de design sem endereço grava o mesmo arquivo de antes.

**O endereço não viaja com um pacote.** Um registro em um arquivo assinado é interpretado como sendo do próprio signatário. Um endereço não pode se ativar sozinho para alguém que não escolheu esse endereço, e um pacote não pode apontar os arquivos de outras pessoas para uma página de sua escolha. Um pacote `.lolly`, uma cópia ou um fork de um sistema de design, **Try these colours**, um backup restaurado e um arquivo de tokens fornecido para uma execução chegam todos com a configuração desativada. Você pode ativar a configuração por conta própria, com um endereço que digitar. Um sistema de design gerenciado é a única exceção: ele mantém o endereço que seu administrador definiu nos tokens de origem. [Leve de volta a partir dos seus arquivos](/info/brand-page.html#lead-back-from-your-files) tem os detalhes.

**A empresa parceira, em um programa de parceiros do Lolly Work.** Uma peça feita para uma empresa parceira registra a empresa e seu programa na mesma linha, como *Registros: Acme · Variação de cores: Beach · Parceiro: Northwind IT (Revendedores, EMEA)*, com a revisão dos dados da empresa no arquivo. O registro não contém pessoas, dados de contato, endereço nem moeda. Com o kit de parceiro da empresa anexado, a linha acrescenta a revisão do kit, como *, revisão do kit 2*, e a credencial contém o id e a revisão do kit, nunca suas cores ou regras. Desmarcar o cartão remove o parceiro junto com o restante do registro. Um PDF ganha a palavra-chave *Parceiro: Northwind IT*, e o [Lolly Verify](/info/what-verify-checks.html#partner) mostra o registro como **Partner** ([O registro do parceiro nos arquivos](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Lendo o registro de volta.** O [Lolly Verify](/#/verify) lista o registro como **Design system** nos detalhes da credencial de um arquivo e as skills de marca como **Guided by**. Uma página de marca aparece separadamente, como [o registro de um endereço pelo signatário](/info/what-verify-checks.html#brand-page). *Recreate with these settings* reabre a ferramenta na versão e na variação de cores registradas. O link abre com o sistema de design registrado quando este dispositivo contém um com o mesmo id e nome; caso contrário, abre com seu sistema de design ativo.

::: details O que é gravado em cada lugar e quais execuções deixam o registro de fora
| Onde | O que é gravado |
|---|---|
| Content Credential | `designSystem` (o id), `designSystemLabel`, `designVersion` e `themes` na declaração `tools.lolly.export`, cada um como um valor de texto simples; `themes` é uma lista JSON das escolhas. `brandPage` quando o publicador optou por incluí-la |
| PNG, JPEG, WebP e JXL | Os mesmos valores como propriedades `lolly:` do pacote XMP do arquivo, no namespace `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` quando o publicador optou por incluí-la |
| SVG | As mesmas propriedades `lolly:` dentro do bloco `<metadata>` |
| PDF | Palavras-chave como *Sistema de design: Acme*, *Variação de cores: Beach* e, quando o publicador optou por incluí-la, *Página de marca: https://acme.example/brand/acme/* |
| Todo formato com um campo de descrição | A descrição, com a variação de cores ao lado da ferramenta |

O cartão aparece apenas quando há algo para registrar e o formato pode conter o registro. CSV, JSON, um arquivo de calendário e outros formatos de texto ou dados não contêm metadados, e EPS, EMF, DXF e BMP não têm campo para o registro. HTML, Markdown e CSS contêm o registro apenas em sua Content Credential, então, para eles, o cartão não mostra linha de descrição e fica oculto enquanto **C2PA Credentials** está desativado. Um campo que o sistema de design não fornece fica fora do arquivo.

Um link de compartilhamento desativa o registro com `_madewith=0` ([Parâmetros de URL](/info/url-parameters.html)). A linha de comando aceita `--no-madewith`, `lolly_render` do [servidor MCP](/info/mcp.html) aceita `madeWith: false` e o painel de exportação do app de terminal tem uma linha **Design system**. A linha de comando imprime na saída de erro padrão as palavras que um arquivo finalizado carrega, tanto para uma renderização de ferramenta quanto para cada arquivo que `lolly run` exporta de uma sessão salva do Lolly Design. Uma renderização MCP imprime as palavras ao lado do arquivo. Ambos leem as palavras de volta do arquivo. Um PNG que a linha de comando desenha sem navegador não carrega metadados de arquivo, então seu registro viaja apenas na credencial. Utilitários no dispositivo não acrescentam metadados.

Execuções sem o cartão **Design system** deixam o registro de fora: uma execução do Lolly Batch, uma pasta exportada de Projects e uma exportação de coleção 3D e, no app de terminal, um lote CSV, uma exportação de pasta ou seleção de Projects e a visualização que renderiza tudo. Exporte um arquivo pela ferramenta para registrar o sistema de design.
:::

### Content Credentials (C2PA)

As exportações podem carregar **Content Credentials**: um manifesto [C2PA](https://c2pa.org) assinado que registra o que criou o arquivo, quando e onde, vinculado a um hash dos bytes do arquivo para que qualquer edição posterior seja detectável. O Lolly grava manifestos padrão que qualquer leitor C2PA pode inspecionar.

![O cartão C2PA Credentials, marcado, com o prazo de validade da credencial ao lado da caixa de seleção](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Ativado por padrão.** O cartão **C2PA Credentials** vem marcado para quase todas as ferramentas. Desmarque-o para uma exportação ou passe `c2pa=off` em um link. O arquivo fica sem credencial, e um SVG que incorpora arte com credencial, como um logotipo do catálogo, também perde a credencial dessa arte. O Lolly Imprint e os outros metadados do arquivo permanecem. Uma ferramenta pode desativar isso em seu manifesto.
- **Formatos.** PDF (RGB e Print), PNG e APNG, JPG, GIF, SVG e SVGZ, TIFF (RGB e Print), WebP (estático e animado), AVIF, MP4, WebM, HTML, Markdown, CSS e os contêineres de áudio MP3, WAV, M4A, OGG/Opus e FLAC. Um ZIP aplica a credencial a cada arquivo compatível, que é como um Animated SVG recebe uma credencial. MP4, AVIF e M4A usam a vinculação BMFF padrão e MP3 seu mapeamento ID3v2, então `c2patool` e outros leitores os verificam. WebM e OGG/Opus ainda não têm mapeamento padrão, então o Lolly carrega o manifesto como um anexo Matroska e um campo OpusTags, que o próprio verificador do Lolly confere. Um SVGZ é um SVG comprimido. A especificação C2PA não define uma forma comprimida, então a credencial é gravada no SVG antes da compressão. O verificador do Lolly lê o arquivo como está; `c2patool` lê a mesma credencial depois que o arquivo é descomprimido (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, os formatos Office e os outros formatos de texto e dados não têm contêiner C2PA.
- **O que registra.** A ferramenta e o app que criaram o arquivo, o momento da assinatura e o shell que exportou o arquivo. Para uma página do Lolly Design exportada como imagem, SVG ou PDF, o renderizador que desenhou a página (`route` na declaração `tools.lolly.export`: `gpu` para o renderizador de páginas por GPU, `operations` para as operações de desenho gravadas como vetores, `compatibility` para o próprio renderizador do navegador) e a versão desse renderizador (`renderer`: a receita da GPU, `design-draw-v` e sua versão, ou `dom-to-image` e `dom-walker`). O [sistema de design e a variação de cores](#the-design-system-record) enquanto o cartão **Design system** estiver marcado. As configurações ativas: escolhas de menu, números, chaves e cores como estão, e tudo o que foi digitado (títulos, nomes, notas, links e datas) apenas como uma impressão digital, para que as palavras não estejam no arquivo. Campos vinculados ao perfil, controles inativos, versões do navegador e detalhes do sistema operacional ficam de fora. Seu nome e e-mail aparecem como autor apenas quando **Use my details to create** está ativado em Settings → Preferences → Your details. As fontes que uma exportação insere viajam como ingredientes. Cada imagem na página que carrega uma Content Credential própria é registrada como um componente da página, com essa credencial e qualquer tipo de fonte de IA que ela declare. Isso vale para PNG, JPEG, WebP, AVIF, TIFF, SVG ou PDF e para GIF, APNG, WebP animado, MP4 ou WebM quando a imagem é desenhada em pelo menos um quadro do intervalo exportado. Já a única imagem que uma ferramenta como Darkroom, Filter ou Asset Export modifica é registrada como a origem do arquivo, aberta primeiro e seguida pelo que a ferramenta fez com ela. Outros ingredientes são [obras creditadas](#source-credits), como emojis, [músicas do Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) em uma exportação de vídeo ou áudio e [melodias salvas](/info/generated-music.html#what-a-track-records) em uma exportação de vídeo ou áudio. Cada melodia salva tem seu nome, a licença quando a melodia registra uma, o SHA-256 de sua receita, a versão do mecanismo e a classificação como mídia algorítmica. O criador de uma melodia salva (o nome de perfil com que ela foi salva) só é acrescentado enquanto **Use my details to create** está ativado, como seu próprio nome. Só então o painel de exportação mostra o criador antes de você exportar.
- **Uma aprovação, quando foi registrada.** Um arquivo aprovado pelo [Lolly Work](/info/work-approvals.html#review-an-exported-file) pode carregar um segundo registro assinado sobre essa credencial: o id da aprovação, a data da decisão e o resumo criptográfico do arquivo revisado. Ele não tem nomes, e-mails, grupos, comentários nem nomes de cadeias. Vem marcado por padrão na caixa de solicitação e pode ser desmarcado para uma solicitação ou desativado para uma instância. Registra que um signatário declarou uma decisão. Não diz que o trabalho atende a qualquer padrão.
- **O que foi solicitado, para um arquivo feito a partir de uma [intenção](/info/visual-intent.html#what-goes-in-the-file).** A finalidade, a superfície, a ferramenta, o idioma, as versões das regras e do vocabulário e o resumo criptográfico da intenção. Ocasião, público, região e o prompt são apenas impressões digitais, a menos que a pessoa ou o agente que executa essa renderização peça para registrar as palavras do prompt. Só uma renderização que começou a partir de uma intenção carrega esse registro. A execução informa o que registrou, e o registro pode ser deixado de fora.
- **O que os destinatários veem.** Ferramentas C2PA, como os apps da Adobe, `c2patool` e contentcredentials.org/verify, leem o manifesto e mostram a declaração. O Lolly assina com uma chave criada no seu dispositivo, não com um certificado de uma lista de confiança, então os visualizadores informam uma credencial *não verificada*. A estrutura e a evidência de adulteração são válidas, mas ninguém atesta o signatário. Para mudar isso, cadastre uma **identidade verificada** em Settings → Preferences → Content Credentials; veja [Identidade de Content Credentials](/info/content-credentials-identity.html).
- **Verificar um arquivo.** Solte qualquer arquivo no [Lolly Verify](/#/verify), ou execute `lolly validate <file>`, para obter um relatório no dispositivo que começa informando se o Lolly criou o arquivo e se ele mudou desde então. O Lolly Verify também olha além da credencial; veja [O que o Lolly Verify verifica](/info/what-verify-checks.html).
- **Privacidade.** A chave de assinatura é criada para a exportação e nunca sai do seu dispositivo. A declaração contém apenas o que os metadados de procedência já carregam. Utilitários de privacidade que transformam seus próprios arquivos não acrescentam credenciais, e o *Lolly Strip Hidden Data* remove um manifesto C2PA como qualquer outro metadado. O utilitário Rondocode cria áudio novo, então assina o que grava ([Músicas do Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). O gerador de música assina cada download WAV ou M4A. A credencial registra que o gerador de música do Lolly criou a faixa e a licença sob a qual a música é distribuída, CC BY 4.0, com seu crédito ([O que uma faixa registra](/info/generated-music.html#what-a-track-records)).
- **Interações.** Um PDF protegido por senha não pode carregar Content Credentials em nenhum dos níveis. A credencial é acrescentada por último, sobre os bytes finalizados, depois de DPI, EXIF, perfil de cores, metadados PDF/X e marcas de impressão.

### Créditos das fontes

Uma exportação que insere o trabalho de outra pessoa registra essa fonte na credencial. O caso comum é um emoji do conjunto de emojis escolhido: a obra, seu criador, a licença, de onde vieram os bytes exatos e o que mudou acompanham o arquivo. O texto em uma ferramenta cujo template é um SVG mantém os emojis do próprio sistema, então nada é creditado ali. Antes de você baixar, a linha **Source credits** informa o que as fontes exigem da entrega. Depois do download, a linha lê os bytes entregues de volta antes de dizer que os créditos estão no arquivo. Uma licença que pede uma escolha, como a de um glifo CC BY-SA recolorido que você está prestes a compartilhar, recebe um cartão com as opções. O download nunca é bloqueado. [Direitos criativos e créditos](/info/creative-rights.html) traz os textos, as licenças revisadas e o que continua sendo seu.

<!--i:eti-lock-->
## Proteção por senha

O Lolly cria dois tipos de bloqueio, ambos no seu dispositivo. O cartão **Password** do painel de exportação configura os dois.

![O cartão Password expandido em uma exportação PDF, com o campo de senha e os dois níveis de bloqueio](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Uma senha de abertura de PDF** tem dois níveis depois que você digita uma senha:

- **Weak**: RC4 de 40 bits, para `pdf` RGB sem marcas de impressão nem sangria e senhas apenas com caracteres ASCII. Uma senha com outros caracteres passa para Strong, porque os leitores não conseguem abrir um arquivo bloqueado dessa forma nesse nível. Só os primeiros 32 caracteres contam.
- **Strong**: AES-256 (PDF 2.0). Também se aplica a Print PDFs e a cada PDF dentro de um ZIP de lote. Um Print PDF bloqueado com Strong mantém seu CMYK, suas marcas e sua intenção de saída, mas remove a declaração PDF/X-4.

::: warning Weak dificulta o acesso, mas não protege
Use **Strong** para um arquivo confidencial.
:::

**Um ZIP bloqueado** cobre uma exportação ZIP, um download de pasta de Projects ou um lote, com uma senha em dois níveis: **Weak** (ZipCrypto, que dificulta o acesso) ou **Strong** (AES-256). A senha protege cada arquivo. Qualquer PDF dentro dele também é bloqueado individualmente com AES-256, então o PDF continua bloqueado depois que o ZIP é descompactado. A solicitação aparece quando o download começa. Uma senha em branco significa nenhum bloqueio.

**Uma senha digitada fica fora dos links nos dois níveis.** Se um arquivo chega por um link `?password=`, o Lolly lê o valor e o remove do endereço imediatamente. Um link que pede um bloqueio que seu arquivo não pode conter não grava nenhum arquivo e informa o motivo (veja [`password`](/info/url-parameters.html)).

**Um link de compartilhamento protegido por senha** pede uma senha ao destinatário antes de abrir. O estado do link é criptografado com AES-256 usando uma chave derivada da senha (PBKDF2). Só o texto cifrado viaja, e a descriptografia acontece no navegador do destinatário. O servidor que fornece o link nunca vê a senha nem o design. Ative-o na caixa **Share**. Um link criptografado abre apenas no Lolly, nunca como uma imagem incorporada. Veja [Modo URL](/info/url-mode.html).

<!--i:eti-monitor-->
## No celular

Os controles de exportação ficam atrás do botão flutuante **Export**, que abre o painel **Export**: os mesmos formatos, tamanho, copiar, baixar e compartilhar, dimensionados para toque.

<!--i:eti-code-->
## Ids de formato para links e a CLI

Estes são os valores para o parâmetro de URL `format=` e a flag de CLI `--export=` (veja [Parâmetros de URL](/info/url-parameters.html) e [CLI](/info/cli.html)). O menu de uma ferramenta mostra apenas os formatos que ela pode criar.

| Tipo | Ids |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vetor | `svg` · `svgz` (SVG comprimido com gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (arquivo de corte) |
| Página e documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (arquivo de design Penpot) · `scorm` (pacote de curso, um ZIP) |
| Movimento | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + mídia) |
| Áudio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (notas MIDI, do Lolly Rondocode) |
| Texto e dados | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (paleta GIMP) |
| Pacotes e conjuntos | `zip` · `rpm` e `tar.gz` (a renderização selada em um pacote Linux) |

Alguns ids vêm do código de exportação da própria ferramenta: `ase` (Adobe Swatch Exchange, do Lolly Palette Lab) e `exr` e `hdr` (imagens raster de alta faixa dinâmica, do Lolly Darkroom). **Convert Font** grava `ttf`, `otf` e `woff` a partir de um arquivo de fonte que você fornece, então um link sem esse arquivo não dá à ferramenta nada para renderizar.
